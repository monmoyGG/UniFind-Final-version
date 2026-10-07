"""Create demo accounts and items so the faculty demonstration has data to show.

Run from inside the backend/ folder:

    python seed.py

Safe to run more than once: existing rows are left alone.
"""

from datetime import datetime, timedelta, timezone

from auth import hash_password
from database import SessionLocal, init_db
from matching import refresh_matches_for_item
from models import Item, User

DEMO_PASSWORD = "UniFind2026"

DEMO_USERS = [
    ("Ayesha Rahman", "ayesha@bscse.uiu.ac.bd", "Computer Science & Engineering", "user"),
    ("Tanvir Hasan", "tanvir@eee.uiu.ac.bd", "Electrical & Electronic Engineering", "user"),
    ("Nusrat Jahan", "nusrat@bba.uiu.ac.bd", "Business Administration", "user"),
    ("UniFind Admin", "admin@uiu.ac.bd", "Student Affairs", "admin"),
]


def days_ago(days: int) -> datetime:
    """A datetime n days before now, used for the sample dates."""
    return datetime.now(timezone.utc) - timedelta(days=days)


DEMO_ITEMS = [
    # (owner email, type, title, category, location, days ago, brand, color, model, description)
    (
        "ayesha@bscse.uiu.ac.bd", "lost", "Black iPhone 14", "Electronics", "Main Library", 2,
        "Apple", "Black", "iPhone 14",
        "Lost my black iPhone 14 somewhere on the second floor of the Main Library, near the reading desks.",
    ),
    (
        "tanvir@eee.uiu.ac.bd", "found", "Black iPhone found near library desk", "Electronics", "Main Library", 1,
        "Apple", "Black", "iPhone",
        "Found a black Apple phone on a reading desk in the Main Library. Screen is locked, so I could not identify the owner.",
    ),
    (
        "nusrat@bba.uiu.ac.bd", "lost", "Brown leather wallet", "Wallets", "Cafeteria", 4,
        None, "Brown", None,
        "Brown leather wallet lost in the cafeteria around lunch time. Contains my UIU ID card and a bus pass.",
    ),
    (
        "ayesha@bscse.uiu.ac.bd", "found", "Set of keys with red keychain", "Keys", "Student Center", 3,
        None, "Silver", None,
        "Found a set of three keys attached to a red plastic keychain near the Student Center noticeboard.",
    ),
    (
        "tanvir@eee.uiu.ac.bd", "found", "Blue Samsung Galaxy earbuds case", "Electronics", "Computer Lab", 5,
        "Samsung", "Blue", "Galaxy Buds",
        "Someone left a blue Samsung earbuds charging case in the Computer Lab after the afternoon session.",
    ),
    (
        "nusrat@bba.uiu.ac.bd", "lost", "Navy blue backpack", "Bags", "Academic Building", 6,
        None, "Navy", None,
        "Navy blue backpack left behind in a classroom in the Academic Building. Has a small blue tag on the zipper.",
    ),
]


def main() -> None:
    """Create the demo accounts, sample items and Smart Matches. Existing rows are skipped."""
    init_db()
    db = SessionLocal()
    try:
        users_by_email: dict[str, User] = {}
        for name, email, department, role in DEMO_USERS:
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                user = User(
                    name=name,
                    email=email,
                    password_hash=hash_password(DEMO_PASSWORD),
                    department=department,
                    role=role,
                    # Demo accounts skip the confirmation step, so the faculty
                    # demonstration never depends on reaching an inbox.
                    is_verified=True,
                    verified_at=datetime.now(timezone.utc),
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"  created user  {email}")
            else:
                # Backfill for databases seeded before email confirmation existed.
                if not user.is_verified:
                    user.is_verified = True
                    user.verified_at = datetime.now(timezone.utc)
                    db.commit()
                print(f"  user exists   {email}")
            users_by_email[email] = user

        created_items: list[Item] = []
        for (
            owner_email, item_type, title, category, location,
            ago, brand, color, model, description,
        ) in DEMO_ITEMS:
            existing = db.query(Item).filter(Item.title == title).first()
            if existing is not None:
                print(f"  item exists   {title}")
                continue
            item = Item(
                owner_id=users_by_email[owner_email].id,
                type=item_type,
                title=title,
                category=category,
                description=description,
                location=location,
                date_lost_found=days_ago(ago),
                brand=brand,
                color=color,
                model=model,
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            created_items.append(item)
            print(f"  created item  {title}")

        # Build the Smart Match table once every item exists, so each new report
        # is compared against the complete set rather than a partial one.
        for item in db.query(Item).all():
            refresh_matches_for_item(db, item)

        print("\nDemo accounts (password for all): " + DEMO_PASSWORD)
        for _, email, _, role in DEMO_USERS:
            print(f"  {email}  ({role})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
