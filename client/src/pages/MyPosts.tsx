import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { itemService } from "@/services/itemService";
import { PageHeader } from "@/components/common/PageHeader";
import { ItemCard } from "@/components/items/ItemCard";
import { ConfirmModal } from "@/components/common/Modal";
import { EmptyState, ErrorMessage, SkeletonGrid } from "@/components/common/Feedback";
import type { Item } from "@/types";

const TABS = ["all", "lost", "found", "resolved"] as const;
type Tab = (typeof TABS)[number];

/** My Posts with All / Lost / Found / Resolved tabs. */
export function MyPosts() {
  const [tab, setTab] = useState<Tab>("all");
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useApi(
    signal => itemService.list({ mine: true, sort: "recent" }, signal),
    []
  );

  const items = data ?? [];
  const visible = items.filter(item => {
    if (tab === "all") return true;
    if (tab === "resolved") return item.status === "resolved";
    return item.type === tab;
  });

  async function markResolved(item: Item) {
    try {
      await itemService.setStatus(item.id, "resolved");
      toast.success("Case marked resolved.");
      reload();
    } catch (statusError) {
      toast.error((statusError as Error).message);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await itemService.remove(pendingDelete.id);
      toast.success("Post withdrawn.");
      setPendingDelete(null);
      reload();
    } catch (deleteError) {
      toast.error((deleteError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="YOUR REPORTS"
        title="My posts."
        description="Manage what you have reported, update the details, and close a case once the item is back."
        actions={
          <Link to="/report/lost" className="btn btn-primary">
            <Plus size={16} /> Report an item
          </Link>
        }
      />

      <div className="tab-bar recessed" role="tablist">
        {TABS.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {value.toUpperCase()}
            <span className="tab-count">
              {value === "all"
                ? items.length
                : value === "resolved"
                  ? items.filter(item => item.status === "resolved").length
                  : items.filter(item => item.type === value).length}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonGrid />
      ) : visible.length > 0 ? (
        <div className="item-grid">
          {visible.map(item => (
            <ItemCard
              item={item}
              key={item.id}
              footer={
                <>
                  <Link to={`/items/${item.id}/edit`} className="btn btn-ghost btn-sm">
                    <Pencil size={14} /> Edit
                  </Link>
                  {item.status !== "resolved" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => markResolved(item)}
                    >
                      <CheckCircle2 size={14} /> Mark resolved
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm danger"
                    onClick={() => setPendingDelete(item)}
                  >
                    <Trash2 size={14} /> Withdraw
                  </button>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={tab === "all" ? "You haven't posted anything yet." : `No ${tab} posts.`}
          description="Report a lost or found item to start building a clear record."
          action="Report a lost item"
          href="/report/lost"
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Withdraw this post?"
          message={`"${pendingDelete.title}" will be removed from Browse and Smart Matching. Existing claims and conversations are kept.`}
          confirmLabel="Withdraw post"
          tone="danger"
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
