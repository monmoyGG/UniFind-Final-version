"""Small shared helpers used by more than one router.

Kept in one place so the privacy rule below is applied identically everywhere.
"""

from sqlalchemy.orm import Session

from models import Item, Notification, User

FALLBACK_NAME = "Verified UIU member"


def owner_name(db: Session, owner_id: int) -> str:
    """The owner's display name, or a neutral fallback if the account is gone."""
    user = db.get(User, owner_id)
    return user.name if user else FALLBACK_NAME


def serialize_item(db: Session, item: Item, viewer_id: int | None = None) -> dict:
    """Turn an Item row into the shape the API returns.

    `identifying_details` is the private proof a real owner uses during a claim,
    so it is stripped for everyone except the member who posted the item.
    """
    return {
        "id": item.id,
        "owner_id": item.owner_id,
        "owner_name": owner_name(db, item.owner_id),
        "type": item.type,
        "status": item.status,
        "title": item.title,
        "category": item.category,
        "description": item.description,
        "location": item.location,
        "date_lost_found": item.date_lost_found,
        "image_url": item.image_url,
        "brand": item.brand,
        "color": item.color,
        "model": item.model,
        "identifying_details": item.identifying_details if item.owner_id == viewer_id else None,
        "is_removed": item.is_removed,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def create_notification(
    db: Session,
    *,
    user_id: int,
    type: str,
    title: str,
    body: str | None = None,
    href: str | None = None,
) -> Notification:
    """Queue an in-app notification.

    The caller is responsible for committing — notifications are always created
    alongside the action that caused them, so they share that transaction.
    """
    notification = Notification(user_id=user_id, type=type, title=title, body=body, href=href)
    db.add(notification)
    return notification
