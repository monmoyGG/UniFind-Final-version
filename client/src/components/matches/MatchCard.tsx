import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { formatDate, ITEM_PLACEHOLDER } from "@/constants";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import type { Match } from "@/types";

const SPOTLIGHT = "rgba(233, 139, 41, 0.16)" as const;

/**
 * Smart Match panel.
 *
 * This is the strongest technical/industrial surface in the app: a refined
 * matching readout, not a verdict. It always says "possible match".
 */
export function MatchCard({
  match,
  onContact,
  onDismiss,
}: {
  match: Match;
  onContact?: () => void;
  onDismiss?: () => void;
}) {
  const { own_item: own, matched_item: found, score, reasons } = match;

  const comparison: Array<[string, string | null, string | null]> = [
    ["Category", own.category, found.category],
    ["Color", own.color, found.color],
    ["Location", own.location, found.location],
    ["Brand", own.brand, found.brand],
    ["Date", formatDate(own.date_lost_found), formatDate(found.date_lost_found)],
  ];

  return (
    <SpotlightCard className="uf-spotlight match-card raised" spotlightColor={SPOTLIGHT}>
      <header className="match-card-head">
        <div className="match-score">
          <span className="mono-label">MATCH CONFIDENCE</span>
          <strong>
            {score}
            <em>%</em>
          </strong>
        </div>
      </header>

      <div className="confidence-track recessed">
        <div className="confidence-fill" style={{ width: `${score}%` }} />
      </div>

      <div className="match-pair">
        <MatchSide label={own.type === "lost" ? "YOUR LOST ITEM" : "YOUR FOUND ITEM"} item={own} />
        <div className="match-arrow" aria-hidden="true">
          <ArrowRight size={20} />
        </div>
        <MatchSide
          label={found.type === "found" ? "POSSIBLE FOUND ITEM" : "POSSIBLE LOST ITEM"}
          item={found}
        />
      </div>

      <table className="match-table">
        <caption className="mono-label">WHY THIS SURFACED</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">{own.type === "lost" ? "Lost" : "Found"}</th>
            <th scope="col">{found.type === "found" ? "Found" : "Lost"}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map(([label, left, right]) => (
            <tr key={label} className={left && right && left === right ? "row-match" : ""}>
              <th scope="row">{label}</th>
              <td>{left || "—"}</td>
              <td>{right || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="match-reasons mono-label">
        {reasons.map(reason => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <p className="match-disclaimer">
        UniFind never decides who owns an item. Verify ownership yourself before arranging a return.
      </p>

      <div className="match-actions">
        <Link to={`/items/${found.id}`} className="btn btn-primary btn-sm">
          Review match <ArrowRight size={15} />
        </Link>
        {onContact && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onContact}>
            <MessageSquare size={15} /> Contact {found.type === "found" ? "finder" : "owner"}
          </button>
        )}
        <Link to={`/items/${own.id}`} className="btn btn-ghost btn-sm">
          Compare details
        </Link>
        {onDismiss && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
            Not my item
          </button>
        )}
      </div>
    </SpotlightCard>
  );
}

function MatchSide({ label, item }: { label: string; item: Match["own_item"] }) {
  return (
    <div className="match-side">
      <span className="mono-label">{label}</span>
      <div className="match-side-image recessed">
        <img
          src={item.image_url || ITEM_PLACEHOLDER}
          alt={item.title}
          loading="lazy"
          onError={event => {
            (event.currentTarget as HTMLImageElement).src = ITEM_PLACEHOLDER;
          }}
        />
      </div>
      <h3>{item.title}</h3>
      <p className="mono-label">
        {item.category} · {item.location}
      </p>
    </div>
  );
}
