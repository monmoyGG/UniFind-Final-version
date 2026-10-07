import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { CATEGORIES } from "@/constants";
import { useApi } from "@/hooks/useApi";
import { itemService } from "@/services/itemService";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { FilterPanel } from "@/components/common/FilterPanel";
import { ItemCard } from "@/components/items/ItemCard";
import { EmptyState, ErrorMessage, SkeletonGrid } from "@/components/common/Feedback";
import { useDebounced } from "@/hooks/useDebounced";
import type { ItemFilters, ItemStatus, ItemType, SortOrder } from "@/types";
import FadeContent from "@/components/reactbits/FadeContent";
import FlowingMenu from "@/components/reactbits/FlowingMenu";

/* The eight categories, paired with the art already shipped for the
   landing page. The menu is a second way into the same `category` filter the
   FilterPanel select drives, so both stay in step through the URL. */
const CATEGORY_ART: Record<string, string> = {
  Electronics: "phone",
  "ID Cards": "id-card",
  Keys: "keys",
  Bags: "bag",
  Wallets: "wallet",
  Clothing: "glasses",
  Documents: "id-card",
  Accessories: "earbuds",
  Other: "bottle",
};

/**
 * Browse, search, filter and sort — FEATURE 2.
 *
 * Filters live in the URL, so a filtered view can be shared, bookmarked, and
 * survives the back button.
 */
export function Browse() {
  const [params, setParams] = useSearchParams();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [search, setSearch] = useState(params.get("search") ?? "");

  // Wait for a pause in typing before hitting the API on every keystroke.
  const debouncedSearch = useDebounced(search, 300);

  const filters = useMemo<ItemFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      type: (params.get("type") as ItemType) || undefined,
      category: params.get("category") || undefined,
      location: params.get("location") || undefined,
      status: (params.get("status") as ItemStatus) || undefined,
      sort: (params.get("sort") as SortOrder) || "recent",
    }),
    [debouncedSearch, params]
  );

  const { data, loading, error, reload } = useApi(
    signal => itemService.list(filters, signal),
    [
      filters.search,
      filters.type,
      filters.category,
      filters.location,
      filters.status,
      filters.sort,
    ]
  );

  function updateFilters(next: Partial<ItemFilters>) {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") merged.delete(key);
      else merged.set(key, String(value));
    });
    setParams(merged, { replace: true });
  }

  function resetFilters() {
    setSearch("");
    setParams(new URLSearchParams(), { replace: true });
  }

  const items = data ?? [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="PRIVATE NETWORK SEARCH"
        title="Browse lost & found items."
        description="Everything reported inside UIU, searchable by name, category, place, and status."
      />

      <div className="browse-toolbar raised">
        <SearchBar
          value={search}
          onChange={value => {
            setSearch(value);
            updateFilters({ search: value.trim() || undefined });
          }}
        />
        <FilterPanel filters={filters} onChange={updateFilters} onReset={resetFilters} />
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${categoriesOpen ? "active" : ""}`}
          onClick={() => setCategoriesOpen(open => !open)}
          aria-expanded={categoriesOpen}
          aria-controls="category-menu"
        >
          <LayoutGrid size={15} /> Categories
        </button>
      </div>

      {/* Collapsed by default so it never pushes the results below the fold.
          Selecting a category writes the same `category` param the select uses,
          then closes the panel and lets the existing query re-run. */}
      {categoriesOpen && (
        <div className="uf-flowingmenu category-menu" id="category-menu">
          <FlowingMenu
            items={CATEGORIES.map(category => ({
              link: `/browse?category=${encodeURIComponent(category)}`,
              text: category,
              image: `/categories/${CATEGORY_ART[category] ?? "bottle"}.svg`,
              onSelect: () => {
                updateFilters({ category });
                setCategoriesOpen(false);
              },
            }))}
          />
        </div>
      )}

      <div className="results-bar mono-label">
        <span>
          {loading ? "SEARCHING…" : `${items.length} REPORT${items.length === 1 ? "" : "S"} FOUND`}
        </span>
        <span>PRIVATE TO UIU MEMBERS</span>
      </div>

      {error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonGrid />
      ) : items.length > 0 ? (
        <div className="item-grid">
          {items.map((item, index) => (
            /* Results arrive together, so the stagger is capped: past the first
               screenful a longer delay would just look like a slow page. */
            <FadeContent
              key={item.id}
              blur
              duration={420}
              delay={Math.min(index, 8) * 60}
              threshold={0.15}
            >
              <ItemCard item={item} />
            </FadeContent>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching items found."
          description="Try adjusting your search or filters. The right clue may be one detail away."
          action="Clear all filters"
          onAction={resetFilters}
        />
      )}
    </div>
  );
}
