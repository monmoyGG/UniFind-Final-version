import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FileWarning, LayoutDashboard, LogOut, Menu, Package, Users, X, ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/common/Navbar";
import { Footer } from "@/components/common/Footer";
import { Logo, LogoMark } from "@/components/common/Logo";
import { useAuth } from "@/context/AuthContext";
import AnimatedContent from "@/components/reactbits/AnimatedContent";
import PillNav from "@/components/reactbits/PillNav";

/* The public shell has a short, flat nav, which is exactly what PillNav is
   for. The authenticated Navbar keeps its own markup: it carries the
   notification panel, the avatar, and sign-out, none of which PillNav models. */
const PUBLIC_LINKS = [
  { label: "Home", href: "/" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Categories", href: "/#categories" },
  { label: "Privacy", href: "/#privacy" },
];

/** Home, Login, Register — the only pages a visitor can reach. */
export function PublicLayout() {
  const { user } = useAuth();
  const [pillOpen, setPillOpen] = useState(false);

  return (
    <div className="public-shell">
      <header className="public-header">
        <Logo />

        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setPillOpen(!pillOpen)}
          aria-label={pillOpen ? "Close menu" : "Open menu"}
          aria-expanded={pillOpen}
        >
          {pillOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`uf-pillnav public-pillnav ${pillOpen ? "open" : ""}`}>
          <PillNav
            items={PUBLIC_LINKS}
            /* The bare mark, not <Logo>: PillNav already wraps this slot in
               a link, and the pill logo is hidden by CSS here anyway. */
            logoElement={<LogoMark />}
            baseColor="var(--text-primary)"
            pillColor="var(--surface-raised)"
            pillTextColor="var(--text-secondary)"
            hoveredPillTextColor="var(--surface-raised)"
            initialLoadAnimation={false}
          />
        </div>

        <nav className="public-nav-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              Go to dashboard
            </Link>
          ) : (
            <Link to="/login" className="text-button">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** Every authenticated member page.
 *
 * No confirm-your-email banner: a session is only ever issued after the code is
 * confirmed, so nobody who reaches these pages has an unconfirmed address.
 */
export function MainLayout() {
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        {/* Keyed on the path so the entrance replays on every navigation, not
            just the first mount. The distance is deliberately small — this is a
            page settling into place, not a slide-in. */}
        <AnimatedContent key={pathname} distance={26} duration={0.42} threshold={0}>
          <Outlet />
        </AnimatedContent>
      </main>
      <Footer />
    </div>
  );
}

const ADMIN_LINKS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/posts", label: "Manage Posts", icon: Package },
  { to: "/admin/reports", label: "Moderation", icon: FileWarning },
  { to: "/admin/users", label: "Users", icon: Users },
];

/**
 * Admin area — proper admin console with collapsible sidebar.
 * No regular member nav links; clean sidebar navigation only.
 */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const initials = (user?.name ?? "ADMIN")
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
    <div className="app-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
          >
            <ChevronLeft size={20} />
          </button>

          <Logo to="/admin" />

          <div className="admin-topbar-spacer" />

          <Link to="/profile" className="avatar-chip" title={user?.email ?? "Profile"}>
            {initials}
          </Link>

          <button
            type="button"
            className="icon-button"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut size={17} />
          </button>

          <button
            type="button"
            className="admin-mobile-menu-toggle"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      <div className="admin-shell">
        <aside className={`admin-sidebar raised ${sidebarOpen ? "open" : "collapsed"} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
          <div className="admin-sidebar-header">
            <p className="mono-label accent">ADMIN CONSOLE</p>
            <button
              type="button"
              className="admin-sidebar-close"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="admin-sidebar-nav">
            {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <Icon size={16} />
                {!sidebarOpen && !mobileSidebarOpen ? null : <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <Link to="/profile" className="admin-sidebar-profile">
              <span className="avatar-chip small">{initials}</span>
              <div className="admin-sidebar-user-info">
                <span className="admin-sidebar-user-name">{user?.name ?? "Admin"}</span>
                <span className="mono-label admin-sidebar-user-email">{user?.email}</span>
              </div>
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-block"
              onClick={handleLogout}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </aside>

        {mobileSidebarOpen && (
          <div className="admin-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />
        )}

        <main className={`admin-main ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
          <AdminOutlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

/** Same page entrance as MainLayout, for the admin console. */
function AdminOutlet() {
  const { pathname } = useLocation();
  return (
    <AnimatedContent key={pathname} distance={26} duration={0.42} threshold={0}>
      <Outlet />
    </AnimatedContent>
  );
}
