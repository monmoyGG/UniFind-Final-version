import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { useApi } from "@/hooks/useApi";
import { adminService } from "@/services/adminService";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/Modal";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import { formatDate } from "@/constants";
import type { Item } from "@/types";

/** Admin post management. */
export function ManagePosts() {
  const { data, loading, error, reload } = useApi(signal => adminService.listPosts(signal), []);
  const [search, setSearch] = useState("");
  const [pendingRemove, setPendingRemove] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  const posts = data ?? [];

  async function removePost() {
    if (!pendingRemove) return;
    setBusy(true);
    try {
      await adminService.removePost(pendingRemove.id);
      toast.success("Post removed from the network.");
      setPendingRemove(null);
      reload();
    } catch (removeError) {
      toast.error((removeError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restorePost(item: Item) {
    try {
      await adminService.restorePost(item.id);
      toast.success("Post restored.");
      reload();
    } catch (restoreError) {
      toast.error((restoreError as Error).message);
    }
  }

  const columns = useMemo<ColumnDef<Item, unknown>[]>(
    () => [
      {
        id: "item",
        header: "Item",
        accessorFn: row => `${row.title} ${row.category}`,
        cell: ({ row }) => (
          <>
            <Link to={`/items/${row.original.id}`} className="table-title">
              {row.original.title}
            </Link>
            <span className="mono-label">{row.original.category.toUpperCase()}</span>
          </>
        ),
      },
      {
        id: "member",
        header: "Member",
        accessorKey: "owner_name",
      },
      {
        id: "status",
        header: "Status",
        // Removed outranks the workflow status, so it sorts as its own value.
        accessorFn: row => (row.is_removed ? "removed" : row.status),
        cell: ({ row }) =>
          row.original.is_removed ? (
            <span className="stamp stamp-rejected">REMOVED</span>
          ) : (
            <StatusBadge status={row.original.status} />
          ),
      },
      {
        id: "reported",
        header: "Reported",
        accessorFn: row => new Date(row.created_at).getTime(),
        cell: ({ row }) => <span className="mono-label">{formatDate(row.original.created_at)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="table-actions">
            <Link to={`/items/${row.original.id}`} className="btn btn-ghost btn-sm">
              <Eye size={14} /> View
            </Link>
            {row.original.is_removed ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => restorePost(row.original)}
              >
                <RotateCcw size={14} /> Restore
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm danger"
                onClick={() => setPendingRemove(row.original)}
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        ),
      },
    ],
    // restorePost closes over `reload`, which is stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (loading) return <LoadingSpinner label="Loading listings…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="MANAGE POSTS"
        title="All listings."
        description="Every report on the platform, including ones already removed, so a removal can always be reviewed."
      />

      <div className="admin-toolbar raised">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by title, member, or category…"
        />
        <span className="mono-label">{posts.length} LISTINGS</span>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="No listings yet."
          description="Reports appear here as soon as members start posting."
          action="Review the moderation queue"
          href="/admin/reports"
        />
      ) : (
        <DataTable
          columns={columns}
          data={posts}
          globalFilter={search}
          rowClassName={item => (item.is_removed ? "row-removed" : "")}
          emptyMessage="No listings match that search."
        />
      )}

      {pendingRemove && (
        <ConfirmModal
          title="Remove this post?"
          message={`"${pendingRemove.title}" will disappear from Browse and Smart Matching for all members. You can restore it afterwards.`}
          confirmLabel="Remove post"
          tone="danger"
          busy={busy}
          onConfirm={removePost}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  );
}
