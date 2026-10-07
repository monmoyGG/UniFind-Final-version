"""FEATURE 3 — claiming and status tracking.

The case flow this drives:
    OPEN -> Claim Submitted -> PENDING -> Verified -> RESOLVED
"""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user, get_verified_user
from database import get_db
from helpers import FALLBACK_NAME, create_notification, serialize_item
from models import Claim, ClaimAnswer, ClaimDecision, ClaimQuestion, Item, User
from schemas import (
    ClaimCreate, ClaimOut, ClaimReview, ClaimQuestionOut,
    ClaimQuestionsAdminOut, ClaimQuestionsUpdate,
)
from routers.items import _get_item_or_404

router = APIRouter(tags=["claims"])

# The only transition a claim has. "submitted" is where every claim starts, and
# approved/rejected are both final — a decision a student can see is a decision
# that must not quietly change afterwards.
FINAL_CLAIM_STATUSES = ("approved", "rejected")


def _record_decision(
    db: Session,
    claim: Claim,
    *,
    from_status: str,
    to_status: str,
    actor_id: int | None,
    actor_role: str,
    reason: str | None,
) -> None:
    """Write one audit row. Added to the session, committed by the caller.

    Sharing the caller's transaction is the point: a decision that was applied
    but not recorded would be exactly the case the audit exists to answer.
    """
    db.add(
        ClaimDecision(
            claim_id=claim.id,
            actor_id=actor_id,
            from_status=from_status,
            to_status=to_status,
            actor_role=actor_role,
            reason=reason,
        )
    )


def _serialize_claim(db: Session, claim: Claim, item: Item, viewer_id: int) -> dict:
    """Claim JSON for one viewer. Only the poster or an admin sees the quiz result."""
    claimant = db.get(User, claim.claimant_id)
    viewer = db.get(User, viewer_id)
    result = None
    if viewer_id != claim.claimant_id and (item.owner_id == viewer_id or (viewer and viewer.role == "admin")):
        answers = db.query(ClaimAnswer).filter(ClaimAnswer.claim_id == claim.id).all()
        if answers:
            result = {"correct": sum(answer.is_correct for answer in answers), "total": len(answers)}
    return {
        "verification_result": result,
        "id": claim.id,
        "item_id": claim.item_id,
        "claimant_id": claim.claimant_id,
        "claimant_name": claimant.name if claimant else FALLBACK_NAME,
        "verification_message": claim.verification_message,
        "status": claim.status,
        "direction": "sent" if claim.claimant_id == viewer_id else "received",
        "item": serialize_item(db, item, viewer_id),
        "created_at": claim.created_at,
    }


def _question_item(db: Session, item_id: int) -> Item:
    """Load an item for the claim-question endpoints; a removed item counts as missing."""
    item = _get_item_or_404(db, item_id)
    if item.is_removed:
        raise HTTPException(status_code=404, detail="This item report no longer exists.")
    return item


def _question_rows(db: Session, item_id: int) -> list[ClaimQuestion]:
    """The item's verification questions, in order."""
    return db.query(ClaimQuestion).filter(ClaimQuestion.item_id == item_id).order_by(ClaimQuestion.id).all()


def _question_dict(question: ClaimQuestion, include_key: bool = False) -> dict:
    """One question as JSON. The correct answer is included only when include_key is true."""
    result = {"id": question.id, "prompt": question.prompt, "options": json.loads(question.options)}
    if include_key:
        result["correct_option"] = question.correct_option
    return result


def _require_question_manager(item: Item, user: User) -> None:
    """Only the poster or an administrator may edit an item's questions."""
    if item.owner_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the poster or an administrator can manage claim questions.")


@router.get("/api/items/{item_id}/claim-questions", response_model=list[ClaimQuestionOut])
def get_claim_questions(
    item_id: int,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """The questions a claimant must answer. The correct answers are never sent."""
    _question_item(db, item_id)
    return [_question_dict(question) for question in _question_rows(db, item_id)]


@router.get("/api/items/{item_id}/claim-questions/manage", response_model=ClaimQuestionsAdminOut)
def manage_claim_questions(
    item_id: int,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """The poster's editing view: questions with answers, and a `locked` flag once the item is resolved or has a claim."""
    item = _question_item(db, item_id)
    _require_question_manager(item, user)
    return {
        "questions": [_question_dict(question, True) for question in _question_rows(db, item_id)],
        "locked": item.status == "resolved" or db.query(Claim).filter(Claim.item_id == item_id).first() is not None,
    }


@router.put("/api/items/{item_id}/claim-questions/manage", response_model=ClaimQuestionsAdminOut)
def save_claim_questions(
    item_id: int,
    payload: ClaimQuestionsUpdate,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """Replace the item's verification questions (poster or admin only)."""
    item = _question_item(db, item_id)
    _require_question_manager(item, user)
    db.query(Item).filter(Item.id == item_id).update({Item.updated_at: Item.updated_at})
    db.refresh(item)
    if item.status == "resolved" or db.query(Claim).filter(Claim.item_id == item_id).first():
        raise HTTPException(status_code=409, detail="Questions are locked after the first claim or case resolution.")
    if any(question.correct_option >= len(question.options) for question in payload.questions):
        raise HTTPException(status_code=422, detail="Choose a valid correct option for every question.")
    db.query(ClaimQuestion).filter(ClaimQuestion.item_id == item_id).delete(synchronize_session=False)
    for question in payload.questions:
        db.add(ClaimQuestion(
            item_id=item_id,
            prompt=question.prompt,
            options=json.dumps(question.options),
            correct_option=question.correct_option,
        ))
    db.commit()
    return manage_claim_questions(item_id, user, db)


@router.post(
    "/api/items/{item_id}/claims",
    response_model=ClaimOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_claim(
    item_id: int,
    payload: ClaimCreate,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """Submit an ownership claim with a short verification message."""
    # Step 1 - load the item. The no-op update touches the row first so this
    # request takes SQLite's write lock before re-reading it; two claims that
    # arrive together are then handled one after the other.
    item = _get_item_or_404(db, item_id)
    db.query(Item).filter(Item.id == item_id).update({Item.updated_at: Item.updated_at})
    db.refresh(item)

    # Step 2 - refuse claims that make no sense: own post, resolved, removed, duplicate.
    if item.owner_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot claim your own post.",
        )
    if item.status == "resolved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This case has already been resolved.",
        )
    if item.is_removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This item report no longer exists.",
        )

    existing = (
        db.query(Claim)
        .filter(Claim.item_id == item.id, Claim.claimant_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted a claim for this item.",
        )

    # Step 3 - the answers must cover every current verification question once.
    questions = _question_rows(db, item.id)
    selected = {answer.question_id: answer.selected_option for answer in payload.answers}
    if len(selected) != len(payload.answers) or set(selected) != {question.id for question in questions}:
        raise HTTPException(status_code=422, detail="Answer every current verification question once. Reopen the claim form if questions changed.")
    if any(selected[question.id] >= len(json.loads(question.options)) for question in questions):
        raise HTTPException(status_code=422, detail="Choose a valid option for every question.")

    # Step 4 - save the claim, then one answer row per question. is_correct is
    # stored so the poster can see how many answers matched.
    claim = Claim(
        item_id=item.id,
        claimant_id=user.id,
        verification_message=payload.verification_message,
    )
    db.add(claim)
    db.flush()
    for question in questions:
        db.add(ClaimAnswer(
            claim_id=claim.id,
            question_id=question.id,
            selected_option=selected[question.id],
            is_correct=selected[question.id] == question.correct_option,
        ))

    # Step 5 - a claim moves the case from OPEN to PENDING, the poster is
    # notified, and everything is committed together.
    if item.status == "open":
        item.status = "pending"

    create_notification(
        db,
        user_id=item.owner_id,
        type="claim",
        title="New ownership claim",
        body=f"Someone submitted a claim for {item.title}.",
        href="/claims",
    )
    db.commit()
    db.refresh(claim)
    db.refresh(item)

    return _serialize_claim(db, claim, item, user.id)


@router.get("/api/claims", response_model=list[ClaimOut])
def list_claims(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Claims the member submitted, plus claims received on their own posts."""
    query = (
        db.query(Claim, Item)
        .join(Item, Claim.item_id == Item.id)
        .options(joinedload(Item.owner))  # owner names come with the items
    )
    if user.role != "admin":
        query = query.filter((Claim.claimant_id == user.id) | (Item.owner_id == user.id))
    rows = query.order_by(Claim.created_at.desc()).all()
    return [_serialize_claim(db, claim, item, user.id) for claim, item in rows]


@router.patch("/api/claims/{claim_id}", response_model=ClaimOut)
def review_claim(
    claim_id: int,
    payload: ClaimReview,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve or reject a claim. Only the member who posted the item may decide."""
    # Step 1 - find the claim.
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This claim no longer exists.",
        )

    # Step 2 - only the poster (or an administrator) may decide.
    item = _get_item_or_404(db, claim.item_id)
    is_admin = user.role == "admin"
    if item.owner_id != user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the member who posted this item can review its claims.",
        )

    # Step 3 - a decision is final. Without this the same claim could be approved, then
    # rejected, then approved again — and two rival claimants could each be
    # holding an approval on the same item.
    if claim.status in FINAL_CLAIM_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This claim was already {claim.status} and cannot be changed. "
                "Contact the UniFind administrators if that decision was a mistake."
            ),
        )

    previous = claim.status
    actor_role = "admin" if is_admin and item.owner_id != user.id else "owner"

    # Step 4 - approving: make sure no other claim on this item is already approved.
    if payload.status == "approved":
        # Belt and braces against two reviews arriving at once: the competing
        # claims are closed below, but a concurrent request could have got there
        # first, and one item must never carry two approvals.
        rival_approved = (
            db.query(Claim)
            .filter(
                Claim.item_id == item.id,
                Claim.id != claim.id,
                Claim.status == "approved",
            )
            .first()
        )
        if rival_approved is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another claim on this item has already been approved.",
            )

    # Step 5 - apply the decision, write the audit row, and notify the claimant.
    claim.status = payload.status
    _record_decision(
        db,
        claim,
        from_status=previous,
        to_status=payload.status,
        actor_id=user.id,
        actor_role=actor_role,
        reason=payload.reason,
    )

    create_notification(
        db,
        user_id=claim.claimant_id,
        type="claim",
        title=f"Claim {payload.status}",
        body=f"{item.title}: your claim was {payload.status}.",
        href="/claims",
    )

    # Step 6 - approved: close the rival claims. Rejected: reopen the item if
    # nobody else is waiting.
    if payload.status == "approved":
        # Approving one claim settles the question for everyone else waiting on
        # this item. Leaving them "submitted" would keep them hoping, and would
        # let a second approval happen later.
        competing = (
            db.query(Claim)
            .filter(
                Claim.item_id == item.id,
                Claim.id != claim.id,
                Claim.status == "submitted",
            )
            .all()
        )
        for other in competing:
            other.status = "rejected"
            _record_decision(
                db,
                other,
                from_status="submitted",
                to_status="rejected",
                actor_id=user.id,
                actor_role=actor_role,
                reason="Closed automatically: another claim on this item was approved.",
            )
            create_notification(
                db,
                user_id=other.claimant_id,
                type="claim",
                title="Claim closed",
                body=f"{item.title}: another member's claim was approved.",
                href="/claims",
            )
    else:
        # Rejecting the last outstanding claim returns the case to OPEN so the
        # item keeps appearing as available in Browse.
        still_open = (
            db.query(Claim)
            .filter(
                Claim.item_id == item.id,
                Claim.id != claim.id,
                Claim.status == "submitted",
            )
            .count()
        )
        if still_open == 0 and item.status == "pending":
            item.status = "open"

    # Step 7 - one commit for the decision, the competing claims, the audit rows and the
    # notifications together — a half-applied approval is the worst outcome here.
    db.commit()
    db.refresh(claim)
    db.refresh(item)

    return _serialize_claim(db, claim, item, user.id)
