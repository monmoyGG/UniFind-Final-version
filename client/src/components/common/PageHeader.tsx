import type { ReactNode } from "react";
import CountUp from "@/components/reactbits/CountUp";

/** One shared page heading so no screen re-implements its own. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="mono-label accent">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-header-description">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

/** Raised panel used across the dashboard, details, and admin screens. */
export function Panel({
  title,
  label,
  action,
  className = "",
  children,
}: {
  title?: string;
  label?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel raised ${className}`}>
      {(title || label || action) && (
        <div className="panel-head">
          <div>
            {label && <p className="mono-label">{label}</p>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Dashboard summary tile. The value uses the monospace metadata face. */
export function StatCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: number | string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card raised ${accent ? "stat-accent" : ""}`}>
      <p className="mono-label">{label}</p>
      <strong className="stat-value">
        {typeof value === "number" ? (
          <>
            {/* CountUp writes the raw number, which would drop the leading zero
                the tiles are designed around. A single-digit total keeps its own
                static "0" so "07" still reads as two monospace glyphs. */}
            {value < 10 && <span aria-hidden="true">0</span>}
            <CountUp to={value} duration={1.1} className="uf-countup" />
          </>
        ) : (
          value
        )}
      </strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
