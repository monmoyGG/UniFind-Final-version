import { Link } from "react-router-dom";
import { Check, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { adminService } from "@/services/adminService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import { formatDate } from "@/constants";

/** Moderation queue for flagged content. */
export function ModerationReports() {
  const { data, loading, error, reload } = useApi(signal => adminService.listReports(signal), []);

  async function review(id: number, status: "reviewed" | "dismissed") {
    try {
      await adminService.reviewReport(id, status);
      toast.success(status === "dismissed" ? "Report dismissed." : "Report marked reviewed.");
      reload();
    } catch (reviewError) {
      toast.error((reviewError as Error).message);
    }
  }

  if (loading) return <LoadingSpinner label="Loading the moderation queue…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  const reports = data ?? [];
  const open = reports.filter(report => report.status === "open");

  return (
    <div className="page">
      <PageHeader
        eyebrow="MODERATION"
        title="Reported content."
        description="Inspect flagged posts, comments, and members. Removal is reversible — suspension is only for when it is necessary."
      />

      <div className="admin-toolbar raised">
        <span className="mono-label">
          {open.length} OPEN · {reports.length} TOTAL
        </span>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="Nothing has been reported."
          description="Flagged posts, comments, and members will queue up here for review."
          action="Manage posts"
          href="/admin/posts"
        />
      ) : (
        <ul className="report-list">
          {reports.map(report => (
            <li className="report-row raised" key={report.id}>
              <div className="report-row-head">
                <div>
                  <p className="mono-label accent">
                    {report.target_type.toUpperCase()} #{report.target_id} · REPORTED BY{" "}
                    {report.reporter_name.toUpperCase()}
                  </p>
                  <h3>{report.reason}</h3>
                  <p className="mono-label">{formatDate(report.created_at)}</p>
                </div>
                <span className={`stamp stamp-${report.status === "open" ? "pending" : "resolved"}`}>
                  {report.status.toUpperCase()}
                </span>
              </div>

              <div className="report-actions">
                {report.target_type === "item" && (
                  <Link to={`/items/${report.target_id}`} className="btn btn-ghost btn-sm">
                    <Eye size={14} /> View post
                  </Link>
                )}
                {report.status === "open" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => review(report.id, "reviewed")}
                    >
                      <Check size={14} /> Mark reviewed
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => review(report.id, "dismissed")}
                    >
                      <X size={14} /> Dismiss
                    </button>
                  </>
                )}
                <Link to="/admin/posts" className="btn btn-ghost btn-sm">
                  Manage posts
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
