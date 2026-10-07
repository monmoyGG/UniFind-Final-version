import type { ClaimStatus, ItemStatus, ItemType } from "@/types";

/**
 * Case status stamp: OPEN / PENDING / RESOLVED.
 *
 * Functional colours stay separate from the UIU orange accent — orange marks
 * actions and match confidence, never status.
 */
export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`stamp stamp-${status}`}>
      {status === "resolved" ? "RESOLVED ✓" : status.toUpperCase()}
    </span>
  );
}

/** LOST / FOUND type badge — muted red for lost, green for found. */
export function TypeBadge({ type }: { type: ItemType }) {
  return <span className={`type-badge type-${type}`}>{type.toUpperCase()}</span>;
}

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const tone = status === "approved" ? "resolved" : status === "rejected" ? "rejected" : "pending";
  return <span className={`stamp stamp-${tone}`}>{status.toUpperCase()}</span>;
}

/** Small neutral chip for an item's category. */
export function CategoryBadge({ category }: { category: string }) {
  return <span className="category-badge">{category}</span>;
}
