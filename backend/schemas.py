"""Pydantic request/response models.

These are the backend's validation layer. The React forms
validate too, for good UX — but nothing here trusts the frontend.
"""

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ---------------------------------------------------------------------------
# UIU email rule
# ---------------------------------------------------------------------------
# Accept any department subdomain under uiu.ac.bd:
#   student@bscse.uiu.ac.bd  -> accept
#   student@eee.uiu.ac.bd    -> accept
#   student@uiu.ac.bd        -> accept
#   student@gmail.com        -> reject
# Deliberately NOT hard-coded to bscse only.
UIU_EMAIL_PATTERN = re.compile(r"^[^\s@]+@(?:[a-z0-9-]+\.)*uiu\.ac\.bd$", re.IGNORECASE)

UIU_EMAIL_ERROR = "Please use your official UIU email (must end with .uiu.ac.bd)."


def is_uiu_email(email: str | None) -> bool:
    return bool(email) and bool(UIU_EMAIL_PATTERN.match(email.strip()))


ItemType = Literal["lost", "found"]
ItemStatus = Literal["open", "pending", "resolved"]
ClaimStatus = Literal["submitted", "approved", "rejected"]
SortOrder = Literal["recent", "oldest"]


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # bcrypt only reads the first 72 bytes, so cap the length rather than
    # silently truncating a longer password.
    password: str = Field(min_length=8, max_length=72)
    department: str | None = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def must_be_uiu_email(cls, value: str) -> str:
        if not is_uiu_email(value):
            raise ValueError(UIU_EMAIL_ERROR)
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalise(cls, value: str) -> str:
        return value.strip().lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    department: str | None
    role: str
    is_verified: bool
    created_at: datetime


class VerificationOut(BaseModel):
    """What the frontend needs to render the confirmation screen."""

    # False when no SMTP server is configured — the code went to the console.
    sent: bool
    email: str
    expires_in_minutes: int
    # Development only, and never populated when UNIFIND_ENV=production. Lets the
    # demo run end to end without an SMTP server.
    dev_code: str | None = None


class RegisterResponse(BaseModel):
    """What registering produced — and exactly one of the two will be filled in.

    With email confirmation switched off, `user` is the signed-in member and the
    session cookie came with this response. With it on, registering signs nobody
    in: `verification` describes the code that was sent, and the browser holds
    only the pending cookie. The React app branches on which one it got, so the
    two flows need no separate flag of their own.
    """

    name: str
    email: str
    user: UserOut | None = None
    verification: VerificationOut | None = None


class PendingOut(BaseModel):
    """Who the confirmation screen is waiting on, read back from the cookie.

    Lets /verify survive a page reload without the member signing in first.
    """

    name: str
    email: str
    expires_in_minutes: int


class VerifyCodeRequest(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def must_be_six_digits(cls, value: str) -> str:
        """Six digits only, so a malformed code never reaches bcrypt.

        Spaces and dashes are stripped first — people paste "123 456" straight
        out of the email. The message is written for a student, not a validator.
        """
        cleaned = value.replace(" ", "").replace("-", "").strip()
        if not re.fullmatch(r"\d{6}", cleaned):
            raise ValueError("Enter the six-digit code from your email.")
        return cleaned


class VerifyCodeResponse(BaseModel):
    """Confirming the code is also the moment the member is signed in."""

    user: UserOut
    message: str


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
class ItemCreate(BaseModel):
    type: ItemType
    title: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=10, max_length=5000)
    location: str = Field(min_length=2, max_length=180)
    date_lost_found: datetime
    image_url: str | None = Field(default=None, max_length=1000)
    brand: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    identifying_details: str | None = Field(default=None, max_length=3000)

    @field_validator("title", "category", "description", "location")
    @classmethod
    def strip_required(cls, value: str) -> str:
        return value.strip()

    @field_validator("brand", "color", "model", "identifying_details", "image_url")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ItemUpdate(BaseModel):
    """Every field optional — used by PUT /api/items/{id}.

    Normalised exactly like ItemCreate. When only one of the two trimmed, an
    edit could quietly store "  Main Library " where a create would have stored
    "Main Library", and the two would then stop matching each other in search.
    """

    title: str | None = Field(default=None, min_length=2, max_length=180)
    category: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, min_length=10, max_length=5000)
    location: str | None = Field(default=None, min_length=2, max_length=180)
    date_lost_found: datetime | None = None
    image_url: str | None = Field(default=None, max_length=1000)
    brand: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    identifying_details: str | None = Field(default=None, max_length=3000)

    @field_validator("title", "category", "description", "location")
    @classmethod
    def strip_required(cls, value: str | None) -> str | None:
        """Trim, and refuse a value that was nothing but whitespace.

        Returning None for a blank would silently drop the edit instead; these
        four are required on the item, so an all-spaces title is a mistake worth
        reporting rather than ignoring.
        """
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be only spaces.")
        return cleaned

    @field_validator("brand", "color", "model", "identifying_details", "image_url")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ItemStatusUpdate(BaseModel):
    status: ItemStatus


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    owner_name: str
    type: ItemType
    status: ItemStatus
    title: str
    category: str
    description: str
    location: str
    date_lost_found: datetime
    image_url: str | None
    brand: str | None
    color: str | None
    model: str | None
    # Only ever populated for the owner of the post — see routers/items.py.
    identifying_details: str | None
    is_removed: bool
    created_at: datetime
    updated_at: datetime


class ItemCreateResponse(BaseModel):
    item: ItemOut
    match_count: int


class UploadResponse(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------
class ClaimQuestionInput(BaseModel):
    prompt: str = Field(min_length=5, max_length=300)
    options: list[str] = Field(min_length=2, max_length=4)
    correct_option: int = Field(ge=0, le=3, strict=True)

    @field_validator("prompt")
    @classmethod
    def clean_prompt(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Question must have at least five characters.")
        return value

    @field_validator("options")
    @classmethod
    def clean_options(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value or len(value) > 200 for value in cleaned):
            raise ValueError("Each option must have 1–200 characters.")
        if len({value.casefold() for value in cleaned}) != len(cleaned):
            raise ValueError("Options must be distinct.")
        return cleaned


class ClaimQuestionsUpdate(BaseModel):
    questions: list[ClaimQuestionInput] = Field(max_length=5)


class ClaimQuestionOut(BaseModel):
    id: int
    prompt: str
    options: list[str]


class ClaimQuestionAdminOut(ClaimQuestionOut):
    correct_option: int


class ClaimQuestionsAdminOut(BaseModel):
    questions: list[ClaimQuestionAdminOut]
    locked: bool


class ClaimAnswerInput(BaseModel):
    question_id: int = Field(gt=0, strict=True)
    selected_option: int = Field(ge=0, le=3, strict=True)


class ClaimVerificationResult(BaseModel):
    correct: int
    total: int


class ClaimCreate(BaseModel):
    answers: list[ClaimAnswerInput] = Field(default_factory=list, max_length=5)
    verification_message: str = Field(min_length=10, max_length=2000)

    @field_validator("verification_message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        return value.strip()


class ClaimReview(BaseModel):
    status: Literal["approved", "rejected"]
    # Optional, and kept in the audit trail rather than shown to the claimant,
    # so the reviewer can be candid about why.
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    verification_result: ClaimVerificationResult | None = None

    id: int
    item_id: int
    claimant_id: int
    claimant_name: str
    verification_message: str
    status: ClaimStatus
    # "sent" when the current user submitted it, "received" when it targets their post.
    direction: Literal["sent", "received"]
    item: ItemOut
    created_at: datetime


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
class CommentCreate(BaseModel):
    body: str = Field(min_length=2, max_length=1000)

    @field_validator("body")
    @classmethod
    def strip_body(cls, value: str) -> str:
        return value.strip()


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    author_id: int
    author_name: str
    body: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Smart Matching
# ---------------------------------------------------------------------------
class MatchOut(BaseModel):
    id: int
    score: int
    reasons: list[str]
    own_item: ItemOut
    matched_item: ItemOut


# ---------------------------------------------------------------------------
# Messaging
# ---------------------------------------------------------------------------
class ConversationStart(BaseModel):
    item_id: int = Field(gt=0)
    claim_id: int | None = Field(default=None, gt=0)
    recipient_id: int | None = Field(default=None, gt=0)


class DirectConversationStart(BaseModel):
    """Start a conversation with another member without a specific item."""
    recipient_id: int = Field(gt=0)


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def strip_body(cls, value: str) -> str:
        return value.strip()


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    body: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: int
    item: ItemOut
    other_participant_id: int
    other_participant_name: str
    last_message: MessageOut | None
    updated_at: datetime


class ConversationDetail(BaseModel):
    id: int
    item: ItemOut
    other_participant_id: int
    other_participant_name: str
    messages: list[MessageOut]


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    body: str | None
    href: str | None
    is_read: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardCounts(BaseModel):
    active_posts: int
    possible_matches: int
    pending_claims: int
    resolved_cases: int


class DashboardOut(BaseModel):
    counts: DashboardCounts
    recent_items: list[ItemOut]
    recent_activity: list[NotificationOut]


# ---------------------------------------------------------------------------
# Moderation / admin
# ---------------------------------------------------------------------------
class ContentReportCreate(BaseModel):
    target_type: Literal["item", "comment", "user"]
    target_id: int = Field(gt=0)
    reason: str = Field(min_length=5, max_length=1000)


class ContentReportReview(BaseModel):
    status: Literal["reviewed", "dismissed"]


class ContentReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reporter_id: int
    reporter_name: str
    target_type: str
    target_id: int
    reason: str
    status: str
    created_at: datetime


class AdminStats(BaseModel):
    active_posts: int
    lost_posts: int
    found_posts: int
    pending_moderation: int
    resolved_cases: int
    total_users: int


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    department: str | None
    role: str
    is_suspended: bool
    item_count: int
    created_at: datetime


class AdminUserUpdate(BaseModel):
    is_suspended: bool
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not is_uiu_email(value):
            raise ValueError("Must be a valid UIU email address.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


class PublicStats(BaseModel):
    """Anonymous counters for the public Home page."""

    active_reports: int
    possible_matches: int
    items_reunited: int


class SimpleOk(BaseModel):
    success: bool = True
    data: dict | None = None
