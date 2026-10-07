"""FEATURE 1 and FEATURE 2 — item reporting, browsing, search, filter and sort.

These are the two backend-connected features prioritised for the faculty
milestone: a submitted item is genuinely saved to SQLite, and
Browse reads it back with real search and filtering.
"""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user, get_verified_user
from database import get_db
from helpers import create_notification, serialize_item
from matching import refresh_matches_for_item
from models import Item, User
from schemas import (
    ItemCreate,
    ItemCreateResponse,
    ItemOut,
    ItemStatus,
    ItemStatusUpdate,
    ItemType,
    ItemUpdate,
    SimpleOk,
    SortOrder,
    UploadResponse,
)

router = APIRouter(prefix="/api/items", tags=["items"])

# ---------------------------------------------------------------------------
# Image storage
# ---------------------------------------------------------------------------
# Uploads are written outside the source tree by default and are git-ignored, so
# member photos are never committed with the project. For a real deployment set
# UNIFIND_UPLOAD_DIR to a mounted volume, or replace _store_upload() with a call
# to an image bucket (S3 / Cloudinary) and keep storing only the URL in SQLite.
UPLOAD_DIR = Path(os.getenv("UNIFIND_UPLOAD_DIR", Path(__file__).resolve().parent.parent / "uploads"))
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _get_item_or_404(db: Session, item_id: int) -> Item:
    """Load an item, or raise a 404 if it does not exist."""
    item = db.get(Item, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This item report no longer exists.",
        )
    return item


def _require_owner(item: Item, user: User) -> None:
    """A member may only change their own post; admins may moderate any post."""
    if item.owner_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the member who posted this item can change it.",
        )


# ---------------------------------------------------------------------------
# Browse / search / filter / sort  (FEATURE 2)
# ---------------------------------------------------------------------------
@router.get("", response_model=list[ItemOut])
def list_items(
    search: str | None = Query(default=None, max_length=120),
    type: ItemType | None = Query(default=None),
    category: str | None = Query(default=None, max_length=80),
    location: str | None = Query(default=None, max_length=180),
    status_filter: ItemStatus | None = Query(default=None, alias="status"),
    mine: bool = Query(default=False),
    sort: SortOrder = Query(default="recent"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Listings are private to signed-in UIU members."""
    # joinedload fetches each item's owner in the same query, so showing the
    # owner's name does not cost one extra query per item.
    query = db.query(Item).options(joinedload(Item.owner)).filter(Item.is_removed.is_(False))

    if type:
        query = query.filter(Item.type == type)
    if category:
        query = query.filter(Item.category == category)
    if location:
        query = query.filter(Item.location == location)
    if status_filter:
        query = query.filter(Item.status == status_filter)
    if mine:
        query = query.filter(Item.owner_id == user.id)

    if search:
        # Search title, description, category and location.
        # SQLAlchemy parameterises the value, so the wildcards cannot inject SQL.
        pattern = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Item.title.ilike(pattern),
                Item.description.ilike(pattern),
                Item.category.ilike(pattern),
                Item.location.ilike(pattern),
            )
        )

    query = query.order_by(Item.created_at.asc() if sort == "oldest" else Item.created_at.desc())

    return [serialize_item(db, item, user.id) for item in query.all()]


@router.get("/{item_id}", response_model=ItemOut)
def get_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One item. A post removed by moderation is visible only to its owner and admins."""
    item = _get_item_or_404(db, item_id)
    # A post removed by moderation stays visible to its owner and to admins only.
    if item.is_removed and item.owner_id != user.id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This item report no longer exists.",
        )
    return serialize_item(db, item, user.id)


# ---------------------------------------------------------------------------
# Reporting a lost or found item  (FEATURE 1)
# ---------------------------------------------------------------------------
@router.post("", response_model=ItemCreateResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """FEATURE 1: save a new report, then compute its Smart Matches straight away."""
    item = Item(owner_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)

    # Compare the new report against the opposite type straight away, so the
    # member sees possible matches without having to go looking.
    matches = refresh_matches_for_item(db, item)
    if matches:
        plural = "" if len(matches) == 1 else "es"
        create_notification(
            db,
            user_id=user.id,
            type="match",
            title="Possible match found",
            body=f"{len(matches)} possible match{plural} surfaced for {item.title}.",
            href="/matches",
        )
        db.commit()

    return {"item": serialize_item(db, item, user.id), "match_count": len(matches)}


@router.post("/upload", response_model=UploadResponse)
async def upload_photo(
    file: UploadFile = File(...),
    user: User = Depends(get_verified_user),
):
    """Store one item photo and return the URL to save on the item record."""
    extension = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a JPG, PNG, or WEBP image.",
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Please choose an image smaller than 5MB.",
        )
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected image could not be read.",
        )

    # The filename is generated, never taken from the upload, so a crafted name
    # like "../../main.py" cannot escape the upload directory.
    destination = UPLOAD_DIR / f"{user.id}-{uuid.uuid4().hex}{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(contents)

    return {"url": f"/uploads/{destination.name}"}


@router.put("/{item_id}", response_model=ItemOut)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
):
    """Edit an existing post. Only the fields present in the body are changed."""
    item = _get_item_or_404(db, item_id)
    _require_owner(item, user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    # Details changed, so the cached matches for this item are now stale.
    refresh_matches_for_item(db, item)
    return serialize_item(db, item, user.id)


@router.patch("/{item_id}/status", response_model=ItemOut)
def set_item_status(
    item_id: int,
    payload: ItemStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a case along: OPEN -> PENDING -> RESOLVED."""
    item = _get_item_or_404(db, item_id)
    _require_owner(item, user)

    # RESOLVED is the end of the case. It is what puts the item in the resolved
    # gallery and drops it out of matching, and members act on that — reopening
    # it later would revive a post everybody was told was finished. Setting the
    # same status twice stays fine, because retries and double clicks happen.
    if item.status == "resolved" and payload.status != "resolved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This case is already resolved and cannot be reopened. "
                "Post a new report if the item goes missing again."
            ),
        )

    item.status = payload.status
    db.commit()
    db.refresh(item)

    # A resolved case drops out of matching entirely.
    refresh_matches_for_item(db, item)
    return serialize_item(db, item, user.id)


@router.delete("/{item_id}", response_model=SimpleOk)
def delete_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Withdraw a post.

    This is a soft delete: claims, comments and conversations that reference the
    item stay intact, but the listing leaves Browse and Smart Matching.
    """
    item = _get_item_or_404(db, item_id)
    _require_owner(item, user)

    item.is_removed = True
    db.commit()
    db.refresh(item)
    refresh_matches_for_item(db, item)
    return SimpleOk()
