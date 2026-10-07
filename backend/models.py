"""SQLAlchemy tables for UniFind.

Statuses and types are stored as plain lowercase strings so SQLite stays easy to
inspect; the allowed values are enforced by the Pydantic schemas in schemas.py.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    """Current time in UTC; the default for every created_at column."""
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(120))
    # "user" or "admin".
    role: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Email confirmation. False until the member types the code
    # that was mailed to their UIU address.
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_signed_in: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    items: Mapped[list["Item"]] = relationship(back_populates="owner")


class EmailVerification(Base):
    """One outstanding six-digit confirmation code for one member.

    A six-digit code is only a million possibilities, so unlike a signed link it
    cannot defend itself: the row carries an expiry and an attempt counter, and
    the code is stored as a bcrypt hash so a leaked database hands over nothing
    usable.
    """

    __tablename__ = "email_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("email_verifications_user_idx", "user_id"),)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # "lost" or "found"
    type: Mapped[str] = mapped_column(String(8), nullable=False)
    # "open", "pending" or "resolved".
    status: Mapped[str] = mapped_column(String(12), default="open", nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(180), nullable=False)
    date_lost_found: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text)
    brand: Mapped[str | None] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(120))
    # Private proof kept back from the public description; only the owner sees it.
    identifying_details: Mapped[str | None] = mapped_column(Text)
    is_removed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    owner: Mapped["User"] = relationship(back_populates="items")

    __table_args__ = (
        Index("items_owner_idx", "owner_id"),
        Index("items_status_idx", "status"),
        Index("items_type_idx", "type"),
        Index("items_category_idx", "category"),
    )


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    claimant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    verification_message: Mapped[str] = mapped_column(Text, nullable=False)
    # "submitted", "approved" or "rejected"
    status: Mapped[str] = mapped_column(String(12), default="submitted", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("item_id", "claimant_id", name="claims_one_per_member"),
        Index("claims_item_idx", "item_id"),
        Index("claims_claimant_idx", "claimant_id"),
    )


class ClaimQuestion(Base):
    __tablename__ = "claim_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(String(300), nullable=False)
    options: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = {"sqlite_autoincrement": True}


class ClaimAnswer(Base):
    __tablename__ = "claim_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("claim_questions.id"), nullable=False)
    selected_option: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)

    __table_args__ = (UniqueConstraint("claim_id", "question_id", name="claim_answer_unique"),)


class ClaimDecision(Base):
    """One recorded transition of one claim, kept forever.

    The claim row only ever shows where it ended up. When a student asks why
    their claim was rejected — or disputes that it ever was — the answer has to
    come from somewhere, so every decision is written here with who made it and
    what the claim looked like beforehand. Rows are never updated or deleted.
    """

    __tablename__ = "claim_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    claim_id: Mapped[int] = mapped_column(ForeignKey("claims.id"), nullable=False)
    # Who decided. Nullable so a decision survives the account being removed.
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[str] = mapped_column(String(12), nullable=False)
    to_status: Mapped[str] = mapped_column(String(12), nullable=False)
    # "owner" or "admin" — an administrator overriding an owner is worth seeing.
    actor_role: Mapped[str] = mapped_column(String(12), nullable=False)
    # Free text from the reviewer, and the marker for automatic decisions.
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("claim_decisions_claim_idx", "claim_id"),)


class ItemMatch(Base):
    """A cached rule-based Smart Match between one lost item and one found item."""

    __tablename__ = "item_matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_a_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    item_b_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    # JSON-encoded list of human-readable reasons, e.g. ["Category — MATCH", "Color — MATCH"].
    reasons: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("item_a_id", "item_b_id", name="item_matches_pair_unique"),
        Index("item_matches_a_idx", "item_a_id"),
        Index("item_matches_b_idx", "item_b_id"),
    )


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("comments_item_idx", "item_id"),)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), nullable=False)
    claim_id: Mapped[int | None] = mapped_column(ForeignKey("claims.id"))
    participant_one_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    participant_two_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        Index("conversations_item_idx", "item_id"),
        Index("conversations_one_idx", "participant_one_id"),
        Index("conversations_two_idx", "participant_two_id"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), nullable=False)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("messages_conversation_idx", "conversation_id"),)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # "match", "claim", "comment", "message" or "status"
    type: Mapped[str] = mapped_column(String(48), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    # Frontend route the notification should open, e.g. "/matches".
    href: Mapped[str | None] = mapped_column(String(255))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("notifications_user_idx", "user_id"),)


class ContentReport(Base):
    """Flagged content queued for admin moderation."""

    __tablename__ = "content_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # "item", "comment" or "user"
    target_type: Mapped[str] = mapped_column(String(12), nullable=False)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # "open", "reviewed" or "dismissed"
    status: Mapped[str] = mapped_column(String(12), default="open", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)

    __table_args__ = (Index("content_reports_status_idx", "status"),)
