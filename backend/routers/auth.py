"""Registration, sign-in, sign-out, and the current-member lookup.

Authentication is required system functionality, but it is deliberately NOT
counted as one of the project's main Lost & Found features.

Confirming the emailed code is a hard gate. Registering creates the account and
mails a code, but issues no session at all; the browser only gets the pending
cookie, which can do nothing except confirm or ask for another code. The session
is issued at the moment the correct code is entered — that one step is what both
finishes registration and signs the member in.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import auth as auth_utils
import mailer
from database import get_db
from models import EmailVerification, User
from schemas import (
    ChangePasswordRequest,
    LoginRequest,
    PendingOut,
    RegisterRequest,
    RegisterResponse,
    SimpleOk,
    UserOut,
    VerificationOut,
    VerifyCodeRequest,
    VerifyCodeResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_and_send(db: Session, user: User) -> VerificationOut:
    """Create a fresh confirmation code and try to mail it.

    A failed send is reported, never raised: the account already exists, and the
    member can ask for another code from the confirmation screen.
    """
    code = auth_utils.issue_verification_code(db, user)
    sent = mailer.send_verification_code(
        user.email, user.name, code, auth_utils.CODE_TTL_MINUTES
    )
    return VerificationOut(
        sent=sent,
        email=user.email,
        expires_in_minutes=auth_utils.CODE_TTL_MINUTES,
        # Returning the code is a development affordance only. In production this
        # would hand the code to anyone who could reach the endpoint.
        dev_code=None if mailer.is_production() else code,
    )


# What the member is told when a code cannot be delivered. Deliberately says
# nothing about mail servers or configuration: that is for the logs and the
# administrators, not for a student staring at a form.
_UNDELIVERABLE = (
    "We could not send a confirmation code to that address just now, so the "
    "account was not created. Please try again in a few minutes, and let the "
    "UniFind administrators know if it keeps happening."
)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Create a UniFind account.

    The UIU domain rule is enforced by RegisterRequest before this runs, so a
    Gmail/Yahoo/Outlook address never reaches the database even if the React
    form was bypassed.
    """
    # Step 1 - one account per email.
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for this UIU email. Try signing in instead.",
        )

    # Step 2 - create the account (bcrypt-hashed password, role "user").
    confirmation_required = auth_utils.REQUIRE_EMAIL_CONFIRMATION
    now = datetime.now(timezone.utc)

    user = User(
        name=payload.name.strip(),
        email=payload.email,
        password_hash=auth_utils.hash_password(payload.password),
        department=(payload.department or "").strip() or None,
        role="user",
        # With confirmation switched off there is no step that could ever set
        # this later, so the account is created settled rather than left in a
        # pending state nothing will resolve.
        is_verified=not confirmation_required,
        verified_at=None if confirmation_required else now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Step 3a - confirmation off (the default): registering signs the member in.
    if not confirmation_required:
        # No code, no waiting: creating the account signs the member in.
        user.last_signed_in = now
        db.commit()
        db.refresh(user)
        auth_utils.set_session_cookie(response, auth_utils.create_session_token(user))
        return RegisterResponse(
            name=user.name,
            email=user.email,
            user=UserOut.model_validate(user),
            verification=None,
        )

    # Step 3b - confirmation on: mail a six-digit code instead of signing in.
    verification = _issue_and_send(db, user)

    if mailer.is_production() and not verification.sent:
        # The code reached nobody and there is no console to fall back on, so
        # this account could never be confirmed. Leaving it would be worse than
        # failing: it can do nothing, and it blocks its own email from being
        # registered again with a 409. Undo it and let them retry cleanly.
        db.query(EmailVerification).filter(EmailVerification.user_id == user.id).delete(
            synchronize_session=False
        )
        db.delete(user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_UNDELIVERABLE
        )

    # No session here. Creating the account is not the same as proving the
    # address belongs to you, and only the code proves that. All the browser
    # gets is the pending cookie, which /verify and /resend accept and nothing
    # else does.
    auth_utils.set_pending_cookie(response, auth_utils.create_pending_token(user))
    return RegisterResponse(
        name=user.name, email=user.email, user=None, verification=verification
    )


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Sign in with email and password; sets the httpOnly session cookie."""
    user = db.query(User).filter(User.email == payload.email).first()

    # Same message for "no such account" and "wrong password" so the endpoint
    # cannot be used to discover which UIU emails are registered.
    if user is None or not auth_utils.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if user.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is suspended. Contact the UniFind administrators.",
        )

    if auth_utils.REQUIRE_EMAIL_CONFIRMATION and not user.is_verified:
        # Right password, unconfirmed address: mail a fresh code and hand back a
        # pending cookie rather than a session. The password was correct, so
        # this leaks nothing that the caller did not already know.
        verification = _issue_and_send(db, user)
        # Returned rather than raised: an HTTPException discards the injected
        # `response`, and with it the cookie the confirmation screen needs.
        refusal = JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            # A dict rather than a bare sentence so the React app can route to
            # the confirmation screen instead of only printing the message.
            content={
                "detail": {
                    "code": "email_unverified",
                    "message": "Confirm your UIU email first. We just sent a new code to "
                    f"{user.email}.",
                    "verification": verification.model_dump(),
                }
            },
        )
        auth_utils.set_pending_cookie(refusal, auth_utils.create_pending_token(user))
        return refusal

    user.last_signed_in = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    auth_utils.set_session_cookie(response, auth_utils.create_session_token(user))
    # Clear a leftover pending cookie from an abandoned confirmation, so it can
    # never point at a different account than the session does.
    auth_utils.clear_pending_cookie(response)
    return user


@router.post("/logout", response_model=SimpleOk)
def logout(response: Response):
    """Clear both cookies so the browser is left holding nothing."""
    auth_utils.clear_session_cookie(response)
    # Also drop any half-finished confirmation, so signing out really does leave
    # the browser holding nothing.
    auth_utils.clear_pending_cookie(response)
    return SimpleOk()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(auth_utils.get_current_user)):
    """The currently signed-in member (401 when there is no valid session)."""
    return user


# Confirmation is switched off, so these three endpoints have nothing to act on.
# 404 rather than 403: the feature is absent, not forbidden.
_CONFIRMATION_OFF = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Email confirmation is not enabled on this UniFind deployment.",
)


def _require_confirmation_enabled() -> None:
    """Dependency: answer 404 on the confirmation endpoints when confirmation is off."""
    if not auth_utils.REQUIRE_EMAIL_CONFIRMATION:
        raise _CONFIRMATION_OFF


@router.get("/pending", response_model=PendingOut)
def pending(
    _: None = Depends(_require_confirmation_enabled),
    user: User = Depends(auth_utils.get_pending_user),
):
    """Who the confirmation screen is waiting on.

    Read straight from the pending cookie, so reloading /verify does not lose
    the member's place — there is no session to fall back on yet.
    """
    return PendingOut(
        name=user.name, email=user.email, expires_in_minutes=auth_utils.CODE_TTL_MINUTES
    )


@router.post("/verify", response_model=VerifyCodeResponse)
def verify_email(
    payload: VerifyCodeRequest,
    response: Response,
    _: None = Depends(_require_confirmation_enabled),
    user: User = Depends(auth_utils.get_pending_user),
    db: Session = Depends(get_db),
):
    """Confirm the UIU address with the six-digit code, and sign the member in.

    The account comes from the pending cookie, never from the request body, so
    this endpoint cannot be pointed at somebody else's registration.
    """
    # Idempotent: mail clients prefetch, and people submit twice.
    if user.is_verified:
        auth_utils.set_session_cookie(response, auth_utils.create_session_token(user))
        auth_utils.clear_pending_cookie(response)
        return VerifyCodeResponse(
            user=UserOut.model_validate(user), message="Your UIU email is already confirmed."
        )

    # Step 1 - find the member's live code (none means it expired or was used).
    row = auth_utils.latest_verification(db, user.id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="That code has expired. Request a new one.",
        )

    # Step 2 - reject an expired code.
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        # SQLite returns naive datetimes; the stored value is always UTC.
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        db.delete(row)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="That code has expired. Request a new one.",
        )

    # Step 3 - a code that has used up its wrong attempts is dead.
    if row.attempts >= auth_utils.MAX_CODE_ATTEMPTS:
        db.delete(row)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Request a new code.",
        )

    # Step 4 - compare with the stored bcrypt hash; a wrong guess is counted.
    if not auth_utils.verify_password(payload.code, row.code_hash):
        # Counting the attempt before returning is the whole point of the cap —
        # six digits is a million guesses, which is nothing without this.
        row.attempts += 1
        db.commit()
        remaining = auth_utils.MAX_CODE_ATTEMPTS - row.attempts
        detail = (
            f"That code is not correct. {remaining} attempt{'s' if remaining != 1 else ''} left."
            if remaining > 0
            else "Too many incorrect attempts. Request a new code."
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    # Step 5 - correct code: mark the member confirmed and sign them in.
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    # The code has done its job; leaving it around only widens the window.
    db.query(EmailVerification).filter(EmailVerification.user_id == user.id).delete(
        synchronize_session=False
    )
    user.last_signed_in = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # The one moment a session is ever issued at registration time: the address
    # has just been proved, so the confirmation doubles as the sign-in.
    auth_utils.set_session_cookie(response, auth_utils.create_session_token(user))
    auth_utils.clear_pending_cookie(response)

    return VerifyCodeResponse(
        user=UserOut.model_validate(user),
        message="Your UIU email is confirmed. You are signed in.",
    )


@router.post("/resend", response_model=VerificationOut)
def resend_verification(
    _: None = Depends(_require_confirmation_enabled),
    user: User = Depends(auth_utils.get_pending_user),
    db: Session = Depends(get_db),
):
    """Send a fresh confirmation code, at most once a minute."""
    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your UIU email is already confirmed.",
        )

    wait = auth_utils.seconds_until_resend_allowed(auth_utils.latest_verification(db, user.id))
    if wait > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {wait} more second{'s' if wait != 1 else ''} before asking again.",
        )

    verification = _issue_and_send(db, user)
    if mailer.is_production() and not verification.sent:
        # Nothing to undo here — the account already exists — but saying "a new
        # code is on its way" when it is not would just make them wait.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_UNDELIVERABLE
        )
    return verification


@router.post("/change-password", response_model=SimpleOk)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(auth_utils.get_verified_user),
    db: Session = Depends(get_db),
):
    """Allow a signed-in member to change their own password."""
    if not auth_utils.verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    user.password_hash = auth_utils.hash_password(payload.new_password)
    db.commit()
    return SimpleOk()
