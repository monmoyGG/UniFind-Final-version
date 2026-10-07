/** Shared option lists. Keep these in step with what the backend accepts. */

/** Item categories. */
export const CATEGORIES = [
  "Electronics",
  "ID Cards",
  "Keys",
  "Bags",
  "Wallets",
  "Clothing",
  "Documents",
  "Accessories",
  "Other",
] as const;

/**
 * Structured campus locations.
 * UniFind has no campus map; location is always one of these, with a free-text
 * fallback when "Other" is chosen.
 */
export const LOCATIONS = [
  "Main Library",
  "Cafeteria",
  "Student Center",
  "Academic Building",
  "Computer Lab",
  "Auditorium",
  "Sports Complex",
  "Parking Area",
  "Other",
] as const;

export const OTHER_LOCATION = "Other";

/**
 * Accept any department subdomain under uiu.ac.bd.
 * The backend applies this exact rule again; frontend validation is for UX only.
 */
export const UIU_EMAIL_PATTERN = /^[^\s@]+@(?:[a-z0-9-]+\.)*uiu\.ac\.bd$/i;

export const UIU_EMAIL_ERROR = "Please use your official UIU email (must end with .uiu.ac.bd).";

/** Placeholder shown when an item has no photo. */
export const ITEM_PLACEHOLDER = "/placeholder-item.svg";

export const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value)
  );

export const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/** "3 hours ago" style label for inbox rows and notifications. */
export function formatRelative(value: string | Date) {
  const then = new Date(value).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

/** Turns a date into the yyyy-mm-dd value an <input type="date"> expects. */
export const toDateInputValue = (value: string | Date) =>
  new Date(value).toISOString().slice(0, 10);
