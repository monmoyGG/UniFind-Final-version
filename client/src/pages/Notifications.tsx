import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { notificationService } from "@/services/notificationService";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorMessage, LoadingSpinner } from "@/components/common/Feedback";
import { formatRelative } from "@/constants";
import { AnimatedItem } from "@/components/reactbits/AnimatedList";

const ICONS: Record<string, typeof Bell> = {
  match: Sparkles,
  claim: ShieldCheck,
  message: MessageSquare,
  comment: MessageSquare,
};

/** Every notification, each linking to where it belongs. */
export function Notifications() {
  const { data, loading, error, reload } = useApi(
    signal => notificationService.list(signal),
    []
  );
  const navigate = useNavigate();

  const notifications = data ?? [];
  const unread = notifications.filter(item => !item.is_read).length;

  async function open(id: number, href: string | null) {
    await notificationService.markRead(id).catch(() => undefined);
    reload();
    if (href) navigate(href);
  }

  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow="YOUR UPDATES"
        title="Notifications."
        description="Possible matches, claims, comments, messages, and status changes all land here."
        actions={
          unread > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                await notificationService.markAllRead().catch(() => undefined);
                reload();
              }}
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorMessage message={error} onRetry={reload} />
      ) : loading ? (
        <LoadingSpinner label="Loading updates…" />
      ) : notifications.length > 0 ? (
        <ul className="notification-page-list uf-animated-list">
          {notifications.map((notification, index) => {
            const Icon = ICONS[notification.type] ?? Bell;
            return (
              <li key={notification.id}>
                <AnimatedItem index={index} delay={0.06}>
                <button
                  type="button"
                  className={`notification-page-row raised ${notification.is_read ? "" : "unread"}`}
                  onClick={() => open(notification.id, notification.href)}
                >
                  <span className={`activity-dot type-${notification.type}`} aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <div>
                    <strong>{notification.title}</strong>
                    {notification.body && <p>{notification.body}</p>}
                  </div>
                  <time className="mono-label">{formatRelative(notification.created_at)}</time>
                </button>
                </AnimatedItem>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No notifications yet."
          description="UniFind will alert you when a possible match, claim, comment, or message arrives."
          action="Browse items"
          href="/browse"
        />
      )}
    </div>
  );
}
