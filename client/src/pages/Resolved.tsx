import { useApi } from "@/hooks/useApi";
import { itemService } from "@/services/itemService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorMessage, SkeletonGrid } from "@/components/common/Feedback";
import { ITEM_PLACEHOLDER } from "@/constants";
import Masonry from "@/components/reactbits/Masonry";

/**
 * Resolved Gallery.
 *
 * Shows only that a reunion happened — no conversations, no claim messages, and
 * no member details beyond the item itself.
 */
export function Resolved() {
  const { data, loading, error, reload } = useApi(
    signal => itemService.list({ status: "resolved", sort: "recent" }, signal),
    []
  );

  const items = data ?? [];

  return (
    <div className="page uf-masonry">
      <PageHeader
        eyebrow="RESOLVED GALLERY"
        title="Successfully reunited."
        description="Proof that the network works. Private details stay private — this page shows only the returns."
      />

      {error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonGrid count={4} />
      ) : items.length > 0 ? (
        <Masonry
          items={items.map((item, index) => ({
            id: String(item.id),
            img: item.image_url || ITEM_PLACEHOLDER,
            url: `/items/${item.id}`,
            // Returns are a mixed bag of shapes, so the column is broken up with
            // three repeating heights rather than a uniform grid.
            height: [320, 420, 260][index % 3],
          }))}
          animateFrom="bottom"
          scaleOnHover
          hoverScale={0.97}
          blurToFocus
          duration={0.6}
          stagger={0.06}
        />
      ) : (
        <EmptyState
          title="No resolved cases yet."
          description="When an item is returned and the owner closes the report, it will appear here."
          action="Browse active reports"
          href="/browse"
        />
      )}
    </div>
  );
}
