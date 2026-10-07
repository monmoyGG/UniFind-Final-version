"""Admin dashboard and moderation.

Every route here depends on `get_current_admin`, so a regular member receives
403 even if they discover the URL. Frontend route guards are convenience only —
the real restriction is here.
"""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from auth import get_current_admin
from database import get_db
from helpers import FALLBACK_NAME, serialize_item
from matching import refresh_matches_for_item
from models import ContentReport, Item, User
from routers.items import _get_item_or_404
from schemas import (
    AdminStats,
    AdminUserOut,
    AdminUserUpdate,
    ContentReportOut,
    ContentReportReview,
    ItemOut,
    SimpleOk,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def admin_stats(
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Counts for the admin overview: posts, resolved cases, open reports, members."""
    visible = db.query(Item).filter(Item.is_removed.is_(False))
    return {
        "active_posts": visible.filter(Item.status != "resolved").count(),
        "lost_posts": visible.filter(Item.type == "lost").count(),
        "found_posts": visible.filter(Item.type == "found").count(),
        "pending_moderation": db.query(ContentReport)
        .filter(ContentReport.status == "open")
        .count(),
        "resolved_cases": db.query(Item).filter(Item.status == "resolved").count(),
        "total_users": db.query(User).count(),
    }


@router.get("/posts", response_model=list[ItemOut])
def list_all_posts(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Every post, including ones already removed, so a removal can be reviewed."""
    items = db.query(Item).options(joinedload(Item.owner)).order_by(Item.created_at.desc()).all()
    return [serialize_item(db, item, admin.id) for item in items]


@router.patch("/posts/{item_id}/remove", response_model=SimpleOk)
def remove_post(
    item_id: int,
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Take an inappropriate or spam listing out of Browse and Smart Matching."""
    item = _get_item_or_404(db, item_id)
    item.is_removed = True
    db.commit()
    db.refresh(item)
    refresh_matches_for_item(db, item)
    return SimpleOk()


@router.patch("/posts/{item_id}/restore", response_model=SimpleOk)
def restore_post(
    item_id: int,
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Undo a removal — moderation should not be a one-way door."""
    item = _get_item_or_404(db, item_id)
    item.is_removed = False
    db.commit()
    db.refresh(item)
    refresh_matches_for_item(db, item)
    return SimpleOk()


@router.get("/reports", response_model=list[ContentReportOut])
def list_reports(
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """The moderation queue: every flagged post, comment or member, newest first."""
    reports = db.query(ContentReport).order_by(ContentReport.created_at.desc()).all()
    rows = []
    for report in reports:
        reporter = db.get(User, report.reporter_id)
        rows.append(
            {
                "id": report.id,
                "reporter_id": report.reporter_id,
                "reporter_name": reporter.name if reporter else FALLBACK_NAME,
                "target_type": report.target_type,
                "target_id": report.target_id,
                "reason": report.reason,
                "status": report.status,
                "created_at": report.created_at,
            }
        )
    return rows


@router.patch("/reports/{report_id}", response_model=SimpleOk)
def review_report(
    report_id: int,
    payload: ContentReportReview,
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Mark a flag as reviewed or dismissed."""
    report = db.get(ContentReport, report_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This report no longer exists.",
        )
    report.status = payload.status
    db.commit()
    return SimpleOk()


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Every registered member, with how many posts each has made."""
    counts = dict(
        db.query(Item.owner_id, func.count(Item.id)).group_by(Item.owner_id).all()
    )
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "department": user.department,
            "role": user.role,
            "is_suspended": user.is_suspended,
            "item_count": counts.get(user.id, 0),
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.patch("/users/{user_id}", response_model=SimpleOk)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Update member: suspend/reinstate, change email, change password."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That member no longer has a UniFind account.",
        )
    if target.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot modify your own administrator account.",
        )

    target.is_suspended = payload.is_suspended

    if payload.email is not None and payload.email != target.email:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That email is already in use.",
            )
        target.email = payload.email
        target.is_verified = False  # new email needs verification

    if payload.password is not None:
        target.password_hash = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()

    db.commit()
    return SimpleOk()
