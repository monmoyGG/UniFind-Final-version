import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { notificationService } from "@/services/notificationService";
import { formatRelative } from "@/constants";
import { Logo } from "./Logo";

/** Top navigation for signed-in members. */
const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/browse", label: "Browse", icon: Search },
  { to: "/matches", label: "Matches", icon: Sparkles },
  { to: "/my-posts", label: "My Posts", icon: Package },
  { to: "/claims", label: "Claims", icon: ShieldCheck },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/resolved", label: "Resolved", icon: CheckCircle2 },
];

export function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.name ?? "UIU")
    .split(" ")
    .map(word => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Logo to="/dashboard" />

        <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
          <button
            type="button"
            className="nav-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link nav-link-admin ${isActive ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <ShieldCheck size={16} />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="navbar-actions">
          <Link to="/report/lost" className="btn btn-primary btn-sm report-cta">
            <Plus size={15} /> <span>Report item</span>
          </Link>

          <NotificationDropdown />

          <Link to="/profile" className="avatar-chip" title={user?.email ?? "Profile"}>
            {initials}
          </Link>

          <button type="button" className="icon-button" onClick={handleLogout} title="Sign out">
            <LogOut size={17} />
          </button>

          <button
            type="button"
            className="icon-button menu-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
      {menuOpen && <div className="nav-scrim" onClick={() => setMenuOpen(false)} />}
    </header>
  );
}

/** Bell with an unread dot and a short preview list. */
function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, reload } = useApi(signal => notificationService.list(signal), []);
  const navigate = useNavigate();

  const notifications = data ?? [];
  const unread = notifications.filter(item => !item.is_read).length;

  // Close when clicking anywhere else on the page.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function openNotification(id: number, href: string | null) {
    setOpen(false);
    await notificationService.markRead(id).catch(() => undefined);
    reload();
    if (href) navigate(href);
  }

  return (
    <div className="notification-wrap" ref={containerRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen(value => !value)}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
      >
        <Bell size={17} />
        {unread > 0 && <span className="unread-dot" />}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head">
            <span className="mono-label">NOTIFICATIONS</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={async () => {
                  await notificationService.markAllRead().catch(() => undefined);
                  reload();
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="notification-empty">No notifications yet.</p>
          ) : (
            <ul className="notification-list">
              {notifications.slice(0, 6).map(notification => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notification-row ${notification.is_read ? "" : "unread"}`}
                    onClick={() => openNotification(notification.id, notification.href)}
                  >
                    <strong>{notification.title}</strong>
                    {notification.body && <span>{notification.body}</span>}
                    <em className="mono-label">{formatRelative(notification.created_at)}</em>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link to="/notifications" className="notification-all" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
