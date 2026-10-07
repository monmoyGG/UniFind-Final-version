import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { claimService } from "@/services/claimService";
import { messageService } from "@/services/messageService";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { ClaimStatusBadge, StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import { formatDate } from "@/constants";
import type { Claim } from "@/types";

/** Claims Received and Claims Submitted, kept logically separate. */
export function Claims() {
  const { data, loading, error, reload } = useApi(signal => claimService.list(signal), []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const navigate = useNavigate();

  const claims = data ?? [];
  const received = claims.filter(claim => claim.direction === "received");
  const submitted = claims.filter(claim => claim.direction === "sent");

  async function review(claim: Claim, status: "approved" | "rejected") {
    setBusyId(claim.id);
    try {
      await claimService.review(claim.id, status);
      toast.success(`Claim ${status}.`);
      reload();
    } catch (reviewError) {
      toast.error((reviewError as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function message(claim: Claim) {
    try {
      const conversation = await messageService.start(claim.item_id, {
        claimId: claim.id,
        recipientId: claim.claimant_id,
      });
      navigate(`/messages/${conversation.id}`);
    } catch (startError) {
      toast.error((startError as Error).message);
    }
  }

  if (loading) return <LoadingSpinner label="Loading claims…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;

  return (
    <div className="page">
      <PageHeader
        eyebrow="CLAIMS CENTRE"
        title="Proof, not guesswork."
        description="Review ownership claims on your posts, and track the claims you have submitted."
      />

      <div className="claims-layout">
        <Panel label="CLAIMS RECEIVED" title="On your posts.">
          {received.length > 0 ? (
            <ul className="claim-list">
              {received.map(claim => (
                <li className="claim-row recessed" key={claim.id}>
                  <div className="claim-row-head">
                    <div>
                      <Link to={`/items/${claim.item_id}`} className="claim-item-title">
                        {claim.item.title}
                      </Link>
                      <p className="mono-label">
                        FROM {claim.claimant_name.toUpperCase()} · {formatDate(claim.created_at)}
                      </p>
                    </div>
                    <ClaimStatusBadge status={claim.status} />
                  </div>

                  <blockquote>{claim.verification_message}</blockquote>

                  {claim.verification_result && (
                    <p className="claim-quiz-note mono-label">
                      QUIZ SCORE {claim.verification_result.correct}/{claim.verification_result.total}
                    </p>
                  )}

                  <div className="claim-actions">
                    {claim.status === "submitted" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === claim.id}
                          onClick={() => review(claim, "approved")}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm danger"
                          disabled={busyId === claim.id}
                          onClick={() => review(claim, "rejected")}
                        >
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => message(claim)}
                    >
                      <MessageSquare size={14} /> Message
                    </button>
                    {claim.status === "approved" && claim.item.status !== "resolved" && (
                      <Link to={`/items/${claim.item_id}`} className="btn btn-ghost btn-sm">
                        Mark resolved <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-note">
              No one has claimed your posts yet. Claims appear here as soon as someone recognises an
              item.
            </p>
          )}
        </Panel>

        <Panel label="CLAIMS SUBMITTED" title="Your claims.">
          {submitted.length > 0 ? (
            <ul className="claim-list">
              {submitted.map(claim => (
                <li className="claim-row recessed" key={claim.id}>
                  <div className="claim-row-head">
                    <div>
                      <Link to={`/items/${claim.item_id}`} className="claim-item-title">
                        {claim.item.title}
                      </Link>
                      <p className="mono-label">
                        POSTED BY {claim.item.owner_name.toUpperCase()} ·{" "}
                        {formatDate(claim.created_at)}
                      </p>
                    </div>
                    <ClaimStatusBadge status={claim.status} />
                  </div>

                  <blockquote>{claim.verification_message}</blockquote>

                  <div className="claim-actions">
                    <Link to={`/items/${claim.item_id}`} className="btn btn-ghost btn-sm">
                      View item
                    </Link>
                    <span className="claim-item-status mono-label">
                      CASE STATUS <StatusBadge status={claim.item.status} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-note">
              You have not claimed anything yet. Find an item in Browse and use{" "}
              <strong>Claim this item</strong>.
            </p>
          )}
        </Panel>
      </div>

      {claims.length === 0 && (
        <EmptyState
          title="No claims yet."
          description="Claims appear here when you recognise an item, or when someone recognises one of yours."
          action="Browse items"
          href="/browse"
        />
      )}
    </div>
  );
}
