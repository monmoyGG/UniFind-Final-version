import { Search, X } from "lucide-react";

/** Recessed search input (inputs feel inset). */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search by item name, keyword, or place…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-bar recessed">
      <Search size={17} aria-hidden="true" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        aria-label="Search items"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
