"""SQLite connection and session handling for UniFind.

Everything the rest of the backend needs to talk to the database lives here:
the engine, the session factory, the declarative Base, and the `get_db`
dependency that FastAPI injects into every route.
"""

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent

# The database file sits next to this module: backend/unifind.db
DATABASE_URL = f"sqlite:///{BASE_DIR / 'unifind.db'}"

# check_same_thread=False is required because FastAPI serves requests from a
# thread pool, and SQLite otherwise refuses connections created on another thread.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    """SQLite ignores FOREIGN KEY constraints unless they are switched on per connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: hand out a session and always close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create every table that does not exist yet."""
    import models  # noqa: F401  (imported for its side effect: registering the models)

    Base.metadata.create_all(bind=engine)
