import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDate, ITEM_PLACEHOLDER } from "@/constants";
import { CategoryBadge, StatusBadge, TypeBadge } from "@/components/common/StatusBadge";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import type { Item } from "@/types";

/* The accent at low alpha, so the spotlight reads as warm light on paper rather
   than a coloured wash over the card. */
const SPOTLIGHT = "rgba(233, 139, 41, 0.18)" as const;

/**
 * The one shared item card.
 *
 * Reused on Browse, Dashboard, My Posts, Resolved Gallery, and Admin — a
 * single component, so those screens can never drift apart.
 */
export function ItemCard({ item, footer }: { item: Item; footer?: ReactNode }) {
  return (
    <SpotlightCard className="uf-spotlight item-card raised" spotlightColor={SPOTLIGHT}>
      <Link to={`/items/${item.id}`} className="item-card-link">
        <div className="item-card-image recessed">
          <img
            src={item.image_url || ITEM_PLACEHOLDER}
            alt={item.title}
            loading="lazy"
            onError={event => {
              (event.currentTarget as HTMLImageElement).src = ITEM_PLACEHOLDER;
            }}
          />
          <TypeBadge type={item.type} />
        </div>

        <div className="item-card-body">
          <div className="item-card-top">
            <h3>{item.title}</h3>
            <StatusBadge status={item.status} />
          </div>

          <CategoryBadge category={item.category} />

          <dl className="item-card-meta mono-label">
            <div>
              <MapPin size={13} aria-hidden="true" />
              <span>{item.location}</span>
            </div>
            <div>
              <CalendarDays size={13} aria-hidden="true" />
              <span>{formatDate(item.date_lost_found)}</span>
            </div>
          </dl>
        </div>
      </Link>

      {footer && <div className="item-card-footer">{footer}</div>}
    </SpotlightCard>
  );
}
