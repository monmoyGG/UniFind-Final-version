"""Rule-based Smart Matching.

No machine learning: this compares the structured fields a reporter already
filled in and produces a confidence score. The result is always presented as a
*possible* match — the system never declares ownership.
"""

import json
import re

from sqlalchemy.orm import Session

from models import Item, ItemMatch

# Points for each signal. A pair needs MATCH_THRESHOLD or more to be shown.
WEIGHT_CATEGORY = 30
WEIGHT_TITLE = 25
WEIGHT_LOCATION = 20
WEIGHT_COLOR = 15
WEIGHT_DATE = 10
WEIGHT_BRAND = 10
WEIGHT_DESCRIPTION = 5

# Below this, a pair is noise rather than a lead worth showing.
MATCH_THRESHOLD = 40

# A score is a hint, never a certainty — never let it read as 100%.
MAX_SCORE = 99

# Dates this far apart still count as "close" for a campus lost-and-found.
CLOSE_DATE_DAYS = 3

_WORD_SPLIT = re.compile(r"[^a-z0-9]+")


def _normalise(value: str | None) -> str:
    """Trim and lower-case text so comparisons ignore case and spacing."""
    return (value or "").strip().lower()


def _keywords(value: str | None) -> set[str]:
    """Words of three or more characters, so "the"/"a"/"my" do not create matches."""
    return {word for word in _WORD_SPLIT.split(_normalise(value)) if len(word) >= 3}


def calculate_match_score(a: Item, b: Item) -> tuple[int, list[str]]:
    """Compare two items and return (score, human-readable reasons)."""
    score = 0
    reasons: list[str] = []

    if _normalise(a.category) == _normalise(b.category):
        score += WEIGHT_CATEGORY
        reasons.append("Category — MATCH")

    if _keywords(a.title) & _keywords(b.title):
        score += WEIGHT_TITLE
        reasons.append("Title — SIMILAR")

    if _normalise(a.location) == _normalise(b.location):
        score += WEIGHT_LOCATION
        reasons.append("Location — MATCH")

    if _normalise(a.color) and _normalise(a.color) == _normalise(b.color):
        score += WEIGHT_COLOR
        reasons.append("Color — MATCH")

    days_apart = abs((a.date_lost_found - b.date_lost_found).days)
    if days_apart <= CLOSE_DATE_DAYS:
        score += WEIGHT_DATE
        if days_apart == 0:
            reasons.append("Date — SAME DAY")
        else:
            reasons.append(f"Date — {days_apart} DAY DIFFERENCE")

    if _normalise(a.brand) and _normalise(a.brand) == _normalise(b.brand):
        score += WEIGHT_BRAND
        reasons.append("Brand — MATCH")

    if _keywords(a.description) & _keywords(b.description):
        score += WEIGHT_DESCRIPTION
        reasons.append("Description — SHARED DETAIL")

    return min(score, MAX_SCORE), reasons


def canonical_pair(first_id: int, second_id: int) -> tuple[int, int]:
    """Order a pair consistently so (3, 7) and (7, 3) are stored as one row."""
    return (first_id, second_id) if first_id < second_id else (second_id, first_id)


def refresh_matches_for_item(db: Session, subject: Item) -> list[ItemMatch]:
    """Recompute and store every possible match for one item.

    Called whenever an item is created, edited, or has its status changed, so the
    Matches page never shows a lead based on stale details.
    """
    # Drop the old rows for this item first; a resolved or removed post keeps none.
    db.query(ItemMatch).filter(
        (ItemMatch.item_a_id == subject.id) | (ItemMatch.item_b_id == subject.id)
    ).delete(synchronize_session=False)

    if subject.is_removed or subject.status == "resolved":
        db.commit()
        return []

    # A lost item can only match a found item, and vice versa.
    opposite_type = "found" if subject.type == "lost" else "lost"
    candidates = (
        db.query(Item)
        .filter(
            Item.type == opposite_type,
            Item.is_removed.is_(False),
            Item.status.in_(["open", "pending"]),
            Item.id != subject.id,
        )
        .all()
    )

    created: list[ItemMatch] = []
    for candidate in candidates:
        score, reasons = calculate_match_score(subject, candidate)
        if score < MATCH_THRESHOLD:
            continue
        item_a_id, item_b_id = canonical_pair(subject.id, candidate.id)
        row = ItemMatch(
            item_a_id=item_a_id,
            item_b_id=item_b_id,
            score=score,
            reasons=json.dumps(reasons),
        )
        db.add(row)
        created.append(row)

    db.commit()
    return created


def decode_reasons(raw: str) -> list[str]:
    """Turn the stored JSON string of match reasons back into a list."""
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else []
    except (ValueError, TypeError):
        return []
