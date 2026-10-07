import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { itemService, type ItemPayload } from "@/services/itemService";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { ItemForm } from "@/components/items/ItemForm";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import ClickSpark from "@/components/reactbits/ClickSpark";
import type { ItemType } from "@/types";

/**
 * /report/lost and /report/found share this page — one reusable ItemForm, with
 * only the wording switched by `mode`.
 */
export function ReportItem({ mode }: { mode: ItemType }) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: number; matchCount: number } | null>(null);

  async function handleSubmit(payload: ItemPayload) {
    setSubmitting(true);
    try {
      const response = await itemService.create(payload);
      setResult({ id: response.item.id, matchCount: response.match_count });
      toast.success(`Your ${mode} item has been reported successfully.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="page">
        {/* The confirmation is the one genuinely celebratory moment in the
            product, so it is the one place that sparks. The canvas sits behind
            the panel's content and never takes a click of its own. */}
        <ClickSpark
          sparkColor="#e98b29"
          sparkSize={11}
          sparkRadius={22}
          sparkCount={10}
          duration={520}
          easing="ease-out"
        >
        <div className="success-panel raised">
          <div className="success-mark">
            <CheckCircle2 size={30} />
          </div>
          <p className="mono-label accent">REPORT RECEIVED</p>
          <h1>Your {mode} item has been reported successfully.</h1>
          <p>
            It is now visible to verified UIU members in Browse, and UniFind is comparing it against{" "}
            {mode === "lost" ? "found" : "lost"} reports.
          </p>

          {result.matchCount > 0 && (
            <div className="success-match recessed">
              <Sparkles size={18} />
              <p>
                <strong>
                  {result.matchCount} possible match{result.matchCount === 1 ? "" : "es"} found.
                </strong>{" "}
                Review the details before contacting anyone — a match is a lead, not proof.
              </p>
            </div>
          )}

          <div className="success-actions">
            <Link to={`/items/${result.id}`} className="btn btn-primary">
              View post <ArrowRight size={16} />
            </Link>
            {result.matchCount > 0 && (
              <Link to="/matches" className="btn btn-secondary">
                See possible matches
              </Link>
            )}
            <Link to="/dashboard" className="btn btn-ghost">
              Go to dashboard
            </Link>
          </div>
        </div>
        </ClickSpark>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow={`NEW ${mode.toUpperCase()} REPORT`}
        title={mode === "lost" ? "Report a lost item." : "Report a found item."}
        description={
          mode === "lost"
            ? "The more specific the detail, the better the match. You can edit this later."
            : "Thank you for picking it up. Add what you can, and keep one detail back for verification."
        }
      />
      <ItemForm
        mode={mode}
        submitLabel={`Submit ${mode} report`}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

/** /items/:id/edit — same form, pre-filled, owner only. */
export function EditItem() {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { data: item, loading, error, reload } = useApi(
    signal => itemService.getById(itemId, signal),
    [itemId]
  );

  if (loading) return <LoadingSpinner label="Loading your report…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;
  if (!item) {
    return (
      <EmptyState
        title="Item not found."
        description="This report may have been removed."
        action="Back to my posts"
        href="/my-posts"
      />
    );
  }

  // The backend rejects this too — this is just a clearer message than a 403.
  if (item.owner_id !== user?.id) {
    return (
      <EmptyState
        title="You can only edit your own posts."
        description="This report belongs to another UIU member."
        action="Back to browse"
        href="/browse"
      />
    );
  }

  async function handleSubmit(payload: ItemPayload) {
    setSubmitting(true);
    try {
      await itemService.update(itemId, payload);
      toast.success("Changes saved.");
      navigate(`/items/${itemId}`);
    } catch (updateError) {
      toast.error((updateError as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow="EDIT YOUR REPORT"
        title={item.title}
        description="Update the details. Possible matches are recalculated as soon as you save."
      />
      <ItemForm
        mode={item.type}
        initial={item}
        submitLabel="Save changes"
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
