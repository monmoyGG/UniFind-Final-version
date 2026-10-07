import { Link } from "react-router-dom";

/**
 * UniFind mark: two offset slips — one lost, one found — meeting at a notch.
 * Drawn inline so it inherits the current colour and never needs a network fetch.
 *
 * Exported on its own as well as wrapped in {@link Logo}, because some hosts
 * already provide the link — PillNav wraps its logo slot in one, and an anchor
 * inside an anchor is invalid HTML.
 */
export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
        <rect x="3" y="7" width="17" height="12" rx="3" stroke="currentColor" strokeWidth="2.4" />
        <rect x="12" y="13" width="17" height="12" rx="3" stroke="currentColor" strokeWidth="2.4" />
        <path d="M14.5 15.5h3" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="logo" aria-label="UniFind home">
      <LogoMark />
      {!compact && (
        <span className="logo-text">
          Uni<strong>Find</strong>
        </span>
      )}
    </Link>
  );
}
