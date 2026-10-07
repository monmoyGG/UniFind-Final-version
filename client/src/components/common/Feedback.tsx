import { Link } from "react-router-dom";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Loading, empty, and error states.
 * A screen must never be blank while it waits, and never blank when it finds
 * nothing — both cases get an explanation and a way forward.
 */

export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <div className="state-icon spinning">
        <Loader2 size={26} />
      </div>
      <h2>{label}</h2>
      <p>UniFind is retrieving the latest information for your account.</p>
    </div>
  );
}

/** Grey placeholder cards, used where a grid of items is about to appear. */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="item-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-image" />
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  href,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  action?: string;
  href?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="state-block">
      <div className="state-icon">{icon ?? <Inbox size={26} />}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && href && (
        <Link to={href} className="btn btn-primary">
          {action}
        </Link>
      )}
      {action && !href && onAction && (
        <button type="button" className="btn btn-secondary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block state-error" role="alert">
      <div className="state-icon danger">
        <AlertTriangle size={26} />
      </div>
      <h2>Something went wrong</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          <RefreshCw size={15} /> Try again
        </button>
      )}
    </div>
  );
}

/** Inline field-level or form-level error text. */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      <AlertTriangle size={13} /> {message}
    </p>
  );
}
