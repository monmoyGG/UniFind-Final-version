import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { AdminLayout, MainLayout, PublicLayout } from "@/layouts/Layouts";
import { LoadingSpinner } from "@/components/common/Feedback";
import { useAuth } from "@/context/AuthContext";

import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Dashboard } from "@/pages/Dashboard";
import { Browse } from "@/pages/Browse";
import { ItemDetails } from "@/pages/ItemDetails";
import { EditItem, ReportItem } from "@/pages/ReportItem";
import { MyPosts } from "@/pages/MyPosts";
import { Matches } from "@/pages/Matches";
import { Claims } from "@/pages/Claims";
import { Conversation, Messages } from "@/pages/Messages";
import { Notifications } from "@/pages/Notifications";
import { Resolved } from "@/pages/Resolved";
import { Profile } from "@/pages/Profile";
import { NotFound } from "@/pages/NotFound";
import { Verify } from "@/pages/Verify";

/* The admin console is the only thing that pulls in Recharts and TanStack
   Table, and almost nobody who loads UniFind is an administrator. Splitting it
   out keeps roughly 400 kB of charting off the landing page and every member
   screen; it arrives on the first hop into /admin instead. */
const AdminDashboard = lazy(() =>
  import("@/pages/admin/AdminDashboard").then(m => ({ default: m.AdminDashboard }))
);
const ManagePosts = lazy(() =>
  import("@/pages/admin/ManagePosts").then(m => ({ default: m.ManagePosts }))
);
const ModerationReports = lazy(() =>
  import("@/pages/admin/ModerationReports").then(m => ({ default: m.ModerationReports }))
);
const AdminUsers = lazy(() =>
  import("@/pages/admin/AdminUsers").then(m => ({ default: m.AdminUsers }))
);

/**
 * The route guard. It picks ONE route tree based on who is signed in:
 * - signed out: Home, Login, Register, Verify (anything else goes to /login)
 * - member: MainLayout + the member pages
 * - admin: AdminLayout + the /admin/* pages (and the item page, for moderation)
 * Routes for the other roles are never registered, so a member cannot reach
 * /admin and an admin cannot reach /browse. The backend checks roles again.
 */
function RoleRoutes() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <LoadingSpinner label="Checking your UIU membership…" />;

  if (!user) {
    // Unauthenticated: only public pages allowed
    return (
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isAdmin) {
    // Administrator: ONLY admin console routes + item view for moderation
    return (
      <Routes>
        <Route
          element={
            <Suspense fallback={<LoadingSpinner label="Opening the admin console…" />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/posts" element={<ManagePosts />} />
          <Route path="/admin/reports" element={<ModerationReports />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/items/:id" element={<ItemDetails />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    );
  }

  // Regular member: ONLY member routes
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/items/:id" element={<ItemDetails />} />
        <Route path="/items/:id/edit" element={<EditItem />} />
        <Route path="/report/lost" element={<ReportItem mode="lost" />} />
        <Route path="/report/found" element={<ReportItem mode="found" />} />
        <Route path="/my-posts" element={<MyPosts />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:id" element={<Conversation />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/resolved" element={<Resolved />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/** The whole route table lives in RoleRoutes above; this just mounts it. */
export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<RoleRoutes />} />
    </Routes>
  );
}