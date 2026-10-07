import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { messageService } from "@/services/messageService";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { StatusBadge, TypeBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import { formatRelative, ITEM_PLACEHOLDER } from "@/constants";

/** Inbox — one row per conversation. */
export function Messages() {
  const { data, loading, error, reload } = useApi(
    signal => messageService.listConversations(signal),
    []
  );

  const conversations = data ?? [];

  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow="PRIVATE MESSAGES"
        title="Your conversations."
        description="Every thread stays attached to the item or claim it belongs to."
      />

      {error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingSpinner label="Loading conversations…" />
      ) : conversations.length > 0 ? (
        <ul className="inbox-list">
          {conversations.map(conversation => (
            <li key={conversation.id}>
              <Link to={`/messages/${conversation.id}`} className="inbox-row raised">
                <div className="inbox-thumb recessed">
                  <img
                    src={conversation.item.image_url || ITEM_PLACEHOLDER}
                    alt=""
                    onError={event => {
                      (event.currentTarget as HTMLImageElement).src = ITEM_PLACEHOLDER;
                    }}
                  />
                </div>
                <div className="inbox-copy">
                  <div className="inbox-top">
                    <strong>{conversation.other_participant_name}</strong>
                    <time className="mono-label">{formatRelative(conversation.updated_at)}</time>
                  </div>
                  <p className="mono-label">RE: {conversation.item.title.toUpperCase()}</p>
                  <p className="inbox-preview">
                    {conversation.last_message?.body ?? "No messages yet — start the conversation."}
                  </p>
                </div>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No messages yet."
          description="Open an item report and choose Message poster when you need to verify a detail."
          action="Browse items"
          href="/browse"
        />
      )}
    </div>
  );
}

/** A single conversation thread. */
export function Conversation() {
  const { id } = useParams<{ id: string }>();
  const conversationId = Number(id);
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, reload } = useApi(
    signal => messageService.getConversation(conversationId, signal),
    [conversationId]
  );

  // Keep the newest message in view whenever the thread changes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await messageService.send(conversationId, trimmed);
      setBody("");
      reload();
    } catch (sendError) {
      toast.error((sendError as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingSpinner label="Opening conversation…" />;
  if (error) return <ErrorMessage message={error} onRetry={reload} />;
  if (!data) {
    return (
      <EmptyState
        title="Conversation not found."
        description="This discussion may no longer be available."
        action="Back to messages"
        href="/messages"
      />
    );
  }

  return (
    <div className="page page-narrow">
      <Link to="/messages" className="back-link">
        <ArrowLeft size={15} /> Back to messages
      </Link>

      <Panel
        label={`CONVERSATION WITH ${data.other_participant_name.toUpperCase()}`}
        title={data.item.title}
        className="thread-panel"
        action={
          <Link to={`/items/${data.item.id}`} className="text-button">
            View item <ArrowRight size={14} />
          </Link>
        }
      >
        <div className="thread-context recessed">
          <TypeBadge type={data.item.type} />
          <StatusBadge status={data.item.status} />
          <span className="mono-label">
            {data.item.category.toUpperCase()} · {data.item.location.toUpperCase()}
          </span>
        </div>

        <div className="thread-messages">
          {data.messages.length > 0 ? (
            data.messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                mine={message.sender_id === user?.id}
              />
            ))
          ) : (
            <p className="panel-note">
              Start with a careful question that helps verify ownership — something only the real
              owner would be able to answer.
            </p>
          )}
          <div ref={endRef} />
        </div>

        <div className="comment-composer">
          <input
            className="recessed"
            value={body}
            maxLength={4000}
            placeholder="Write a message…"
            onChange={event => setBody(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={send}
            disabled={sending || !body.trim()}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </Panel>
    </div>
  );
}
