"""Password hashing, JWT sessions, and the route guards.

The session token is issued as an httpOnly cookie. That keeps it out of reach of
any JavaScript running on the page, so a cross-site scripting bug cannot read a
member's session. The React app never sees or stores the token — it just sends
credentials with each request.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import EmailVerification, User
from schemas import is_uiu_email, UIU_EMAIL_ERROR

SESSION_COOKIE = "unifind_session"

# Registration does not sign anybody in. Until the six-digit code is entered the
# browser only carries this second, much weaker cookie: it names the account
# waiting to be confirmed and authorises nothing else.
PENDING_COOKIE = "unifind_pending"

# A real deployment must set UNIFIND_SECRET_KEY. The development fallback keeps
# `uvicorn main:app --reload` working out of the box for local demos.
DEVELOPMENT_SECRET = "unifind-development-secret-change-me"
SECRET_KEY = os.getenv("UNIFIND_SECRET_KEY", DEVELOPMENT_SECRET)
ALGORITHM = "HS256"
SESSION_DAYS = 7

# Cookies are only marked Secure in production; over plain http://localhost a
# Secure cookie would simply be dropped by the browser.
IS_PRODUCTION = os.getenv("UNIFIND_ENV", "development").lower() == "production"

# Email confirmation.
#
# Turned OFF by default while the project has no working mail server. With it
# off, registering signs the member straight in and no code is ever issued —
# the whole confirmation flow below stays in the codebase but is never reached.
# Set UNIFIND_REQUIRE_EMAIL_CONFIRMATION=true to put the gate back.
REQUIRE_EMAIL_CONFIRMATION = os.getenv(
    "UNIFIND_REQUIRE_EMAIL_CONFIRMATION", "false"
).lower() in {"1", "true", "yes"}

CODE_TTL_MINUTES = 10
MAX_CODE_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60
# Longer than one code's life, so a member who lets a code expire can still ask
# for another without being thrown back to the sign-in form.
PENDING_MINUTES = 60


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash with bcrypt. Plain-text passwords are never stored."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plain password against its stored bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash in the database — treat as a failed login, never a 500.
        return False


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def create_session_token(user: User) -> str:
    """Make the signed JWT that says who is signed in (id, email, role, expiry)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(days=SESSION_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def set_session_cookie(response, token: str) -> None:
    """Store the session token in an httpOnly cookie, so page JavaScript cannot read it."""
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_session_cookie(response) -> None:
    """Delete the session cookie (this is what signing out does)."""
    response.delete_cookie(key=SESSION_COOKIE, path="/")


def create_pending_token(user: User) -> str:
    """Name the account that is waiting on its confirmation code.

    `purpose` is what keeps the two tokens apart. Both are signed with the same
    key, so without it a pending token would decode perfectly well as a session
    and hand out an account that was never confirmed.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "purpose": "verify",
        "iat": now,
        "exp": now + timedelta(minutes=PENDING_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def set_pending_cookie(response, token: str) -> None:
    """Store the pending token that lets an unconfirmed member reach only /verify and /resend."""
    response.set_cookie(
        key=PENDING_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=IS_PRODUCTION,
        max_age=PENDING_MINUTES * 60,
        path="/",
    )


def clear_pending_cookie(response) -> None:
    """Delete the pending cookie."""
    response.delete_cookie(key=PENDING_COOKIE, path="/")


# ---------------------------------------------------------------------------
# Route guards
# ---------------------------------------------------------------------------
_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Please sign in with your UIU account to continue.",
)


def get_current_user(
    unifind_session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    db: Session = Depends(get_db),
) -> User:
    """Require a signed-in member. Used by every protected route."""
    if not unifind_session:
        raise _UNAUTHENTICATED

    try:
        payload = jwt.decode(unifind_session, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise _UNAUTHENTICATED

    user_id = payload.get("sub")
    if not user_id:
        raise _UNAUTHENTICATED

    user = db.get(User, int(user_id))
    if user is None:
        raise _UNAUTHENTICATED

    # Re-check the domain on every request. A token is not a substitute for the
    # rule — if an account's email ever stops qualifying, access stops with it.
    if not is_uiu_email(user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=UIU_EMAIL_ERROR)

    if user.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is suspended. Contact the UniFind administrators.",
        )

    return user


_NO_PENDING = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="That confirmation session has expired. Sign in again to get a new code.",
)


def get_pending_user(
    unifind_pending: str | None = Cookie(default=None, alias=PENDING_COOKIE),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the account waiting on its code, for /verify and /resend only.

    This is deliberately the *only* thing the pending cookie can do. It never
    reaches get_current_user, so an unconfirmed account cannot read or write
    anything in UniFind.
    """
    if not unifind_pending:
        raise _NO_PENDING

    try:
        payload = jwt.decode(unifind_pending, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise _NO_PENDING

    if payload.get("purpose") != "verify":
        raise _NO_PENDING

    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id else None
    if user is None:
        raise _NO_PENDING

    if user.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is suspended. Contact the UniFind administrators.",
        )

    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    """Require an administrator."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This area is limited to UniFind administrators.",
        )
    return user


# ---------------------------------------------------------------------------
# Email confirmation codes
# ---------------------------------------------------------------------------
def generate_verification_code() -> str:
    """Six digits from a cryptographic source.

    random.randint would be wrong here: it is a Mersenne Twister seeded from the
    clock, so observing a couple of codes is enough to predict the rest.
    """
    return f"{secrets.randbelow(1_000_000):06d}"


def issue_verification_code(db: Session, user: User) -> str:
    """Replace any outstanding code for this member and return the new plain code.

    Only the bcrypt hash is stored, so the plain code exists just long enough to
    be handed to the mailer.
    """
    db.query(EmailVerification).filter(EmailVerification.user_id == user.id).delete(
        synchronize_session=False
    )

    code = generate_verification_code()
    db.add(
        EmailVerification(
            user_id=user.id,
            code_hash=hash_password(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES),
        )
    )
    db.commit()
    return code


def latest_verification(db: Session, user_id: int) -> EmailVerification | None:
    """The member's newest confirmation-code row, or None if there is none."""
    return (
        db.query(EmailVerification)
        .filter(EmailVerification.user_id == user_id)
        .order_by(EmailVerification.created_at.desc())
        .first()
    )


def seconds_until_resend_allowed(row: EmailVerification | None) -> int:
    """How long the member must wait before another code can be sent.

    Without this the resend endpoint is a free way to mail-bomb any UIU address.
    """
    if row is None:
        return 0
    issued = row.created_at
    if issued.tzinfo is None:
        # SQLite hands back naive datetimes; the stored value is always UTC.
        issued = issued.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - issued).total_seconds()
    return max(0, int(RESEND_COOLDOWN_SECONDS - elapsed))


def assert_production_secret() -> None:
    """Refuse to serve production traffic with the published development key.

    This value is in the repository, so anyone who can read it can mint a valid
    session for any account — including an administrator. Unlike a missing mail
    server, that is not degraded service, so it stops the process rather than
    logging a warning nobody reads.
    """
    if IS_PRODUCTION and SECRET_KEY == DEVELOPMENT_SECRET:
        raise RuntimeError(
            "UNIFIND_SECRET_KEY is still the development default while "
            "UNIFIND_ENV=production. That key is public in the repository, so "
            "anyone could forge a session for any account. Set UNIFIND_SECRET_KEY "
            "to a long random value before starting the server."
        )


def get_verified_user(user: User = Depends(get_current_user)) -> User:
    """Require a confirmed UIU email, when confirmation is switched on.

    With REQUIRE_EMAIL_CONFIRMATION off this is just get_current_user — there is
    no confirmation step, so gating on its result would lock out every account.

    With it on, a session is only ever handed out after confirmation, so this
    should never fire. It stays as the second lock: if a session is ever handed
    out earlier by mistake, posting and claiming still refuse it.
    """
    if REQUIRE_EMAIL_CONFIRMATION and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirm your UIU email before posting. Check your inbox for the code.",
        )
    return user
