"""Sending the confirmation code to a member's UIU address.

Deliberately stdlib-only (smtplib + email.message), so adding email verification
costs the project no new dependency.

Delivery is optional by design. With no SMTP server configured the code is
printed to the backend console instead, which keeps registration working on a
laptop with no credentials — and keeps the faculty demonstration runnable.
"""

import os
import smtplib
from email.message import EmailMessage


def is_production() -> bool:
    """Production has no console fallback, so a failed send reaches nobody.

    Callers use this to decide whether an undelivered code is a dead end that
    has to be reported, or just local development with no mail server.
    """
    return os.getenv("UNIFIND_ENV", "development").lower() == "production"


def smtp_is_configured() -> bool:
    """True only when there is really somewhere to send.

    Checked with strip() because a half-filled .env leaves `UNIFIND_SMTP_HOST=`
    set-but-empty, and treating that as configured would silently disable the
    console fallback that local development depends on.
    """
    return bool(os.getenv("UNIFIND_SMTP_HOST", "").strip())


def _print_code_to_console(to_email: str, code: str, minutes: int) -> None:
    """The local fallback: no inbox needed to finish a registration.

    ASCII only, because the Windows console defaults to cp1252 and would
    mojibake an em dash in the one message that makes local dev work.
    """
    print(
        f"\n[UniFind] Confirmation code for {to_email}:"
        f"\n          {code}   (expires in {minutes} minutes)\n",
        flush=True,
    )


def _build_message(to_email: str, name: str, code: str, minutes: int) -> EmailMessage:
    message = EmailMessage()
    # The code goes in the subject too, so a phone's notification preview shows
    # it without the member having to open the mail at all.
    message["Subject"] = f"{code} is your UniFind confirmation code"
    message["From"] = os.getenv("UNIFIND_MAIL_FROM", "UniFind <no-reply@uiu.ac.bd>")
    message["To"] = to_email
    message.set_content(
        f"Hi {name},\n\n"
        f"Your UniFind confirmation code is:\n\n"
        f"    {code}\n\n"
        f"Enter it on the confirmation screen to finish setting up your account.\n"
        f"The code expires in {minutes} minutes.\n\n"
        f"If you did not create a UniFind account, you can ignore this email.\n\n"
        f"— UniFind, United International University"
    )
    return message


def send_verification_code(to_email: str, name: str, code: str, minutes: int) -> bool:
    """Mail one confirmation code. Returns True only if SMTP actually accepted it.

    Never raises: a mail outage must not cost the member their account, since
    they can always ask for the code again from the confirmation screen.
    """
    if not smtp_is_configured():
        if is_production():
            # Loud, but without the code: a production deploy with no mail server
            # issues codes that nobody can ever read, and silence would make that
            # look like a broken confirmation screen instead of missing config.
            print(
                f"[UniFind] WARNING: no SMTP configured, so the confirmation code for "
                f"{to_email} could not be delivered. Set UNIFIND_SMTP_HOST.",
                flush=True,
            )
            return False

        # Development fallback, reached only when this is not production, so a
        # live code can never land in a production log stream.
        _print_code_to_console(to_email, code, minutes)
        return False

    host = os.getenv("UNIFIND_SMTP_HOST")
    port = int(os.getenv("UNIFIND_SMTP_PORT", "587"))
    username = os.getenv("UNIFIND_SMTP_USER")
    password = os.getenv("UNIFIND_SMTP_PASSWORD")

    try:
        # Port 465 speaks TLS from the first byte, so it needs SMTP_SSL. Opening
        # it with plain SMTP and skipping STARTTLS just hangs until the timeout.
        # Everything else (587, 25) starts in the clear and upgrades.
        if port == 465:
            connection = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            connection = smtplib.SMTP(host, port, timeout=15)

        with connection as smtp:
            smtp.ehlo()
            if port != 465:
                smtp.starttls()
                smtp.ehlo()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(_build_message(to_email, name, code, minutes))
        print(f"[UniFind] Confirmation code emailed to {to_email}.", flush=True)
        return True
    except Exception as error:  # noqa: BLE001 — any failure is the same to the caller
        print(f"[UniFind] Could not send confirmation email to {to_email}: {error}", flush=True)
        if not is_production():
            # A wrong SMTP password is the normal first attempt. Falling back to
            # the console keeps local registration finishable while it is fixed.
            _print_code_to_console(to_email, code, minutes)
        return False
