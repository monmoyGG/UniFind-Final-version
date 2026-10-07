"""Community comment threads on a listing.

Comments exist to help identify and recover belongings — UniFind is not a
general social platform, so there is no liking, following, or resharing here.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from auth import get_current_user, get_verified_user
from database import get_db
from helpers import FALLBACK_NAME, create_notification
from models import Comment, User
from routers.items import _get_item_or_404
from schemas import CommentCreate, CommentOut

router = APIRouter(prefix="/api/items", tags=["comments"])


def _serialize_comment(db: Session, comment: Comment) -> dict:
    """Comment JSON, including the author's name."""
    author = db.get(User, comment.author_id)
    return {
        "id": comment.id,
        "item_id": comment.item_id,
        "author_id": comment.author_id,
        "author_name": author.name if author else FALLBACK_NAME,
        "body": comment.body,
        "created_at": comment.created_at,
    }


@router.get("/{item_id}/comments", response_model=list[CommentOut])
def list_comments(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every comment on one item, newest first."""
    _get_item_or_404(db, item_id)
    comments = (
        db.query(Comment)
        .filter(Comment.item_id == item_id)
        .order_by(Comment.created_at.desc())
        .all()
    )
    return [_serialize_comment(db, comment) for comment in comments]


@router.post(
    "/{item_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    item_id: int,
    payload: CommentCreate,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """Add a comment to an item and notify the poster (unless they wrote it)."""
    item = _get_item_or_404(db, item_id)

    comment = Comment(item_id=item.id, author_id=user.id, body=payload.body)
    db.add(comment)

    # Don't notify someone about their own comment.
    if item.owner_id != user.id:
        create_notification(
            db,
            user_id=item.owner_id,
            type="comment",
            title="New comment on your post",
            body=f"A member commented on {item.title}.",
            href=f"/items/{item.id}",
        )

    db.commit()
    db.refresh(comment)
    return _serialize_comment(db, comment)
