"""In-app notifications.

Each notification carries an `href` so clicking it lands on the right page:
    match -> /matches, comment -> /items/:id, claim -> /claims, message -> /messages/:id
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Notification, User
from schemas import NotificationOut, SimpleOk

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The member's notifications, newest first."""
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


@router.patch("/{notification_id}/read", response_model=SimpleOk)
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark one of the member's notifications as read."""
    notification = db.get(Notification, notification_id)
    # Scoped to the owner, so one member cannot mark another's notifications read.
    if notification is None or notification.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This notification no longer exists.",
        )

    notification.is_read = True
    db.commit()
    return SimpleOk()


@router.patch("/read-all", response_model=SimpleOk)
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all of the member's unread notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read.is_(False)
    ).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return SimpleOk()
