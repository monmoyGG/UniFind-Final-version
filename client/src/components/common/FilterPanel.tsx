import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import { CATEGORIES, LOCATIONS } from "@/constants";
import type { ItemFilters, ItemStatus, ItemType, SortOrder } from "@/types";

export const ALL = "all";

/** Type / category / location / status / sort controls. */
export function FilterPanel({
  filters,
  onChange,
  onReset,
  showStatus = true,
}: {
  filters: ItemFilters;
  onChange: (next: Partial<ItemFilters>) => void;
  onReset: () => void;
  showStatus?: boolean;
}) {
  const activeCount = [filters.category, filters.location, filters.status].filter(Boolean).length;

  return (
    <div className="filter-panel">
      <div className="segmented" role="group" aria-label="Filter by type">
        {([ALL, "lost", "found"] as const).map(value => {
          const isActive = value === ALL ? !filters.type : filters.type === value;
          return (
            <button
              key={value}
              type="button"
              className={isActive ? "active" : ""}
              onClick={() => onChange({ type: value === ALL ? undefined : (value as ItemType) })}
            >
              {value.toUpperCase()}
            </button>
          );
        })}
      </div>

      <label className="select-field recessed">
        <span className="sr-only">Category</span>
        <select
          value={filters.category ?? ALL}
          onChange={event =>
            onChange({ category: event.target.value === ALL ? undefined : event.target.value })
          }
        >
          <option value={ALL}>All categories</option>
          {CATEGORIES.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="select-field recessed">
        <span className="sr-only">Location</span>
        <select
          value={filters.location ?? ALL}
          onChange={event =>
            onChange({ location: event.target.value === ALL ? undefined : event.target.value })
          }
        >
          <option value={ALL}>All locations</option>
          {LOCATIONS.map(location => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </label>

      {showStatus && (
        <label className="select-field recessed">
          <span className="sr-only">Status</span>
          <select
            value={filters.status ?? ALL}
            onChange={event =>
              onChange({
                status: event.target.value === ALL ? undefined : (event.target.value as ItemStatus),
              })
            }
          >
            <option value={ALL}>Any status</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onChange({ sort: filters.sort === "oldest" ? "recent" : ("oldest" as SortOrder) })}
      >
        <ArrowDownUp size={14} />
        {filters.sort === "oldest" ? "Oldest first" : "Most recent"}
      </button>

      {activeCount > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
          <SlidersHorizontal size={14} /> Clear ({activeCount})
        </button>
      )}
    </div>
  );
}
