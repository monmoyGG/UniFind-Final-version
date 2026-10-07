import { formatDateTime } from "@/constants";
import type { Message } from "@/types";

/** One message in a conversation. "Mine" sits right, the other member's left. */
export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={`message-row ${mine ? "mine" : ""}`}>
      <div className={`message-bubble ${mine ? "raised" : "recessed"}`}>
        {!mine && <span className="message-sender mono-label">{message.sender_name}</span>}
        <p>{message.body}</p>
        <time className="mono-label" dateTime={message.created_at}>
          {formatDateTime(message.created_at)}
        </time>
      </div>
    </div>
  );
}

/** Comment row on an item's community thread. */
export function CommentRow({
  authorName,
  body,
  createdAt,
}: {
  authorName: string;
  body: string;
  createdAt: string;
}) {
  const initials = authorName
    .split(" ")
    .map(word => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <li className="comment-row">
      <span className="avatar-chip small" aria-hidden="true">
        {initials}
      </span>
      <div>
        <strong>{authorName}</strong>
        <p>{body}</p>
        <time className="mono-label" dateTime={createdAt}>
          {formatDateTime(createdAt)}
        </time>
      </div>
    </li>
  );
}
