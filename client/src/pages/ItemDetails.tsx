import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Flag,
  MapPin,
  MessageSquare,
  Palette,
  Pencil,
  Send,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { itemService } from "@/services/itemService";
import { commentService } from "@/services/commentService";
import { claimService } from "@/services/claimService";
import { messageService } from "@/services/messageService";
import { reportService } from "@/services/reportService";
import { useAuth } from "@/context/AuthContext";
import { Panel } from "@/components/common/PageHeader";
import { StatusBadge, TypeBadge } from "@/components/common/StatusBadge";
import { ClaimModal } from "@/components/claims/ClaimModal";
import { QuestionManagerButton } from "@/components/claims/QuestionManager";
import { CommentRow } from "@/components/messages/MessageBubble";
import { ConfirmModal } from "@/components/common/Modal";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import { formatDate, ITEM_PLACEHOLDER } from "@/constants";
import type { ClaimAnswer, ItemStatus } from "@/types";

export function ItemDetails() {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const { data: item, loading, error, reload } = useApi(
    signal => itemService.getById(itemId, signal),
    [itemId]
  );
  const { data: comments, reload: reloadComments } = useApi(
    signal => commentService.list(itemId, signal),
    [itemId]
  );

  const [comment, setComment] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const backHref = isAdmin ? "/admin/posts" : "/browse";

  if (loading) return <LoadingSpinner label="Opening this report…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;
  if (!item) {
    return (
      <EmptyState
        title="Item not found."
        description="This report may have been removed or resolved."
        action="Back"
        href={backHref}
      />
    );
  }

  const isOwner = item.owner_id === user?.id;

  async function submitClaim(message: string, answers: ClaimAnswer[]) {
    setBusy(true);
    try {
      await claimService.create(itemId, message, answers);
      toast.success("Claim submitted. The poster will review it.");
      setClaimOpen(false);
      reload();
    } catch (submitError) {
      toast.error((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function messagePoster() {
    try {
      const conversation = await messageService.start(itemId);
      navigate(`/messages/${conversation.id}`);
    } catch (startError) {
      toast.error((startError as Error).message);
    }
  }

  async function changeStatus(status: ItemStatus) {
    try {
      await itemService.setStatus(itemId, status);
      toast.success(
        status === "resolved" ? "Case marked resolved. Nice one." : `Status set to ${status}.`
      );
      reload();
    } catch (statusError) {
      toast.error((statusError as Error).message);
    }
  }

  async function addComment() {
    if (comment.trim().length < 2) return;
    try {
      await commentService.create(itemId, comment.trim());
      setComment("");
      reloadComments();
      toast.success("Comment added.");
    } catch (commentError) {
      toast.error((commentError as Error).message);
    }
  }

  async function flagItem() {
    setBusy(true);
    try {
      await reportService.flag({
        target_type: "item",
        target_id: itemId,
        reason: "Reported by a member from the item details page.",
      });
      toast.success("Reported to the moderators. Thank you.");
      setFlagOpen(false);
    } catch (flagError) {
      toast.error((flagError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Link to={backHref} className="back-link">
        <ArrowLeft size={15} /> Back
      </Link>

      <div className="detail-layout">
        <div className="detail-media raised">
          <div className="detail-image recessed">
            <img
              src={item.image_url || ITEM_PLACEHOLDER}
              alt={item.title}
              onError={event => {
                (event.currentTarget as HTMLImageElement).src = ITEM_PLACEHOLDER;
              }}
            />
          </div>
          <div className="detail-badges">
            <TypeBadge type={item.type} />
            <StatusBadge status={item.status} />
          </div>
        </div>

        <div className="detail-body">
          <p className="mono-label accent">REPORT #{String(item.id).padStart(4, "0")}</p>
          <h1>{item.title}</h1>
          <p className="detail-description">{item.description}</p>

          <dl className="detail-facts recessed">
            <Fact icon={<Tag size={15} />} label="CATEGORY" value={item.category} />
            <Fact icon={<MapPin size={15} />} label="LOCATION" value={item.location} />
            <Fact
              icon={<CalendarDays size={15} />}
              label={item.type === "lost" ? "DATE LOST" : "DATE FOUND"}
              value={formatDate(item.date_lost_found)}
            />
            <Fact icon={<Palette size={15} />} label="COLOR" value={item.color || "Not specified"} />
            <Fact icon={<Tag size={15} />} label="BRAND" value={item.brand || "Not specified"} />
            <Fact icon={<Tag size={15} />} label="MODEL" value={item.model || "Not specified"} />
          </dl>

          {isOwner && item.identifying_details && (
            <div className="private-note recessed">
              <p className="mono-label accent">PRIVATE — ONLY YOU CAN SEE THIS</p>
              <p>{item.identifying_details}</p>
            </div>
          )}

          <div className="detail-actions">
            {isOwner ? (
              <>
                <Link to={`/items/${item.id}/edit`} className="btn btn-primary">
                  <Pencil size={16} /> Edit post
                </Link>
                <QuestionManagerButton itemId={item.id} />
                {item.status !== "resolved" && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => changeStatus("resolved")}
                  >
                    Mark resolved
                  </button>
                )}
                {item.status === "resolved" && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => changeStatus("open")}
                  >
                    Reopen case
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setClaimOpen(true)}
                  disabled={item.status === "resolved"}
                >
                  <ShieldCheck size={16} /> Claim this item
                </button>
                <button type="button" className="btn btn-secondary" onClick={messagePoster}>
                  <MessageSquare size={16} /> Message poster
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setFlagOpen(true)}>
                  <Flag size={15} /> Report
                </button>
              </>
            )}
          </div>

          <div className="poster-note recessed">
            <ShieldCheck size={17} />
            <p>
              Posted by <strong>{item.owner_name}</strong>. Contact details stay private — talk
              through UniFind messages until ownership is verified.
            </p>
          </div>
        </div>
      </div>

      <Panel
        label="COMMUNITY CLUES"
        title="Small details can help."
        className="comments-panel"
        action={
          <span className="mono-label">{comments?.length ?? 0} COMMENTS</span>
        }
      >
        <div className="comment-composer">
          <input
            className="recessed"
            value={comment}
            maxLength={1000}
            placeholder="Add a helpful observation…"
            onChange={event => setComment(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") addComment();
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={addComment}
            disabled={comment.trim().length < 2}
            aria-label="Post comment"
          >
            <Send size={16} />
          </button>
        </div>

        {comments && comments.length > 0 ? (
          <ul className="comment-list">
            {comments.map(entry => (
              <CommentRow
                key={entry.id}
                authorName={entry.author_name}
                body={entry.body}
                createdAt={entry.created_at}
              />
            ))}
          </ul>
        ) : (
          <p className="panel-note">
            No comments yet. If you have seen something similar, say so — it often helps.
          </p>
        )}
      </Panel>

      {claimOpen && (
        <ClaimModal
          itemId={itemId}
          itemTitle={item.title}
          submitting={busy}
          onSubmit={submitClaim}
          onClose={() => setClaimOpen(false)}
        />
      )}

      {flagOpen && (
        <ConfirmModal
          title="Report this listing"
          message="Send this post to the UniFind moderators for review? Use this for spam or inappropriate content."
          confirmLabel="Report post"
          tone="danger"
          busy={busy}
          onConfirm={flagItem}
          onCancel={() => setFlagOpen(false)}
        />
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="fact">
      <span className="fact-icon">{icon}</span>
      <dt className="mono-label">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
