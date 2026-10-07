"""UniFind API — FastAPI application entry point.

Run it from inside the backend/ folder:

    uvicorn main:app --reload --port 8000

Interactive API docs are then at http://127.0.0.1:8000/docs
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

import auth as auth_utils  # noqa: E402  (must load after dotenv)
import mailer  # noqa: E402  (must load after dotenv)
from database import init_db  # noqa: E402  (must load after dotenv)
from routers import admin, auth, claims, comments, dashboard, items, matches, messages, notifications  # noqa: E402

app = FastAPI(
    title="UniFind API",
    description="Private Lost & Found network for United International University.",
    version="1.0.0",
)

# The Vite dev server runs on a different port, so the browser treats API calls
# as cross-origin. allow_credentials is required for the session cookie to be
# sent; that in turn means the origins must be listed explicitly (never "*").
DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
extra_origins = [o.strip() for o in os.getenv("UNIFIND_ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS + extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Before anything else: a production deploy signing sessions with the key
    # that ships in the repository is not something to start up and serve.
    """Run once at boot: check the secret key, create the tables, optionally seed demo data."""
    auth_utils.assert_production_secret()

    init_db()

    # Only worth saying when confirmation is actually switched on. With it off,
    # registering never sends anything, so a missing mail server costs nothing.
    #
    # With it on, confirming an emailed code is the only way to finish a
    # registration, so a production deploy with no mail server accepts no new
    # members at all. Said here, at boot, because the alternative is finding out
    # from a student who cannot sign up. Not fatal: browsing still works.
    if (
        auth_utils.REQUIRE_EMAIL_CONFIRMATION
        and mailer.is_production()
        and not mailer.smtp_is_configured()
    ):
        print(
            "[UniFind] WARNING: UNIFIND_ENV=production with no UNIFIND_SMTP_HOST set. "
            "Confirmation codes cannot be delivered, so nobody can complete a "
            "registration. Set the UNIFIND_SMTP_* variables.",
            flush=True,
        )

    # Free hosting tiers hand the service a fresh, empty disk on every restart,
    # which would otherwise leave the demo with an empty database. Seeding here
    # restores the demo accounts and sample items on each boot. seed.main()
    # leaves existing rows alone, so this is a no-op where data does persist.
    if os.getenv("UNIFIND_SEED_ON_START", "").lower() in {"1", "true", "yes"}:
        import seed

        seed.main()


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    """Turn Pydantic's nested error list into one readable sentence.

    The React forms show `detail` directly, so it has to read like something a
    student would want to see — not a stack of field paths.
    """
    first = exc.errors()[0] if exc.errors() else None
    message = "Please complete all required fields."
    if first:
        raw = first.get("msg", message)
        # Pydantic prefixes custom validator errors with "Value error, ".
        message = raw.replace("Value error, ", "")
        location = [part for part in first.get("loc", []) if part != "body"]
        if location and "uiu" not in message.lower():
            message = f"{str(location[-1]).replace('_', ' ').capitalize()}: {message}"
    return JSONResponse(status_code=422, content={"detail": message})


# Uploaded item photos are served from here. The folder is defined once, in
# routers/items.py (where photos are saved), so saving and serving always agree.
UPLOAD_DIR = items.UPLOAD_DIR
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(items.router)
app.include_router(comments.router)
app.include_router(claims.router)
app.include_router(matches.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


@app.get("/api/health", tags=["system"])
def health():
    """Tiny status check used by hosting platforms and the smoke test."""
    return {
        "status": "ok",
        "service": "UniFind API",
        # Registration behaves differently depending on this, so the smoke test
        # reads it here rather than guessing which flow it is looking at.
        "email_confirmation": auth_utils.REQUIRE_EMAIL_CONFIRMATION,
    }


# --- Static frontend -------------------------------------------------------
# In production the React bundle is served by this same app, so the browser
# talks to a single origin. That matters: the session cookie is SameSite=Lax,
# which a browser refuses to send on cross-site API calls, so splitting the
# frontend onto another domain would silently break signing in.
#
# In development this block is inactive — Vite serves the frontend and proxies
# /api here, so dist/ does not exist yet.
FRONTEND_DIR = Path(
    os.getenv("UNIFIND_FRONTEND_DIR", Path(__file__).resolve().parent.parent / "dist")
)

if (FRONTEND_DIR / "index.html").is_file():

    @app.get("/{spa_path:path}", include_in_schema=False)
    def serve_spa(spa_path: str):
        """Serve a built asset, or index.html so React Router can take over.

        Routes like /dashboard exist only in the browser, so any path without a
        matching file has to return the app shell. Registered last, this cannot
        shadow the API: /api and /uploads are matched earlier, and reaching here
        with such a prefix means the endpoint genuinely does not exist.
        """
        if spa_path.startswith(("api/", "uploads/")):
            raise HTTPException(status_code=404, detail="Not found")

        root = FRONTEND_DIR.resolve()
        candidate = (root / spa_path).resolve()
        # is_relative_to keeps a crafted path like ../../etc/passwd inside dist/.
        if spa_path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)

        return FileResponse(root / "index.html")
