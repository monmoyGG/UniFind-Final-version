"""User dashboard, anonymous home-page statistics, and content flagging.

The dashboard is the member's central control hub after sign-in.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from helpers import serialize_item
from models import Claim, ContentReport, Item, ItemMatch, Notification, User
from schemas import (
    ContentReportCreate,
    DashboardOut,
    PublicStats,
    SimpleOk,
)

router = APIRouter(tags=["dashboard"])


@router.get("/api/dashboard", response_model=DashboardOut)
def dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The member's hub: counts, their three latest posts, and their five latest notifications."""
    own_items = (
        db.query(Item)
        .filter(Item.owner_id == user.id, Item.is_removed.is_(False))
        .order_by(Item.created_at.desc())
        .all()
    )
    own_ids = {item.id for item in own_items}

    possible_matches = (
        db.query(ItemMatch)
        .filter(ItemMatch.item_a_id.in_(own_ids) | ItemMatch.item_b_id.in_(own_ids))
        .count()
        if own_ids
        else 0
    )

    # "Pending claims" means claims still awaiting a decision — both the ones
    # this member submitted and the ones sitting on their own posts.
    pending_claims = (
        db.query(Claim)
        .outerjoin(Item, Claim.item_id == Item.id)
        .filter(
            Claim.status == "submitted",
            (Claim.claimant_id == user.id) | (Item.owner_id == user.id),
        )
        .count()
    )

    recent_activity = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "counts": {
            "active_posts": len([item for item in own_items if item.status != "resolved"]),
            "possible_matches": possible_matches,
            "pending_claims": pending_claims,
            "resolved_cases": len([item for item in own_items if item.status == "resolved"]),
        },
        "recent_items": [serialize_item(db, item, user.id) for item in own_items[:3]],
        "recent_activity": recent_activity,
    }


@router.get("/api/stats", response_model=PublicStats)
def public_stats(db: Session = Depends(get_db)):
    """Anonymous counters for the public Home page.

    Deliberately returns numbers only — no names, titles, or listing details,
    because listings are private to signed-in members.
    """
    visible = db.query(Item).filter(Item.is_removed.is_(False))
    return {
        "active_reports": visible.filter(Item.status != "resolved").count(),
        "possible_matches": db.query(ItemMatch).count(),
        "items_reunited": db.query(Item).filter(Item.status == "resolved").count(),
    }


@router.post("/api/reports", response_model=SimpleOk, status_code=status.HTTP_201_CREATED)
def flag_content(
    payload: ContentReportCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Flag a post, comment, or member for admin review."""
    db.add(
        ContentReport(
            reporter_id=user.id,
            target_type=payload.target_type,
            target_id=payload.target_id,
            reason=payload.reason.strip(),
        )
    )
    db.commit()
    return SimpleOk()
