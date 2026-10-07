import { api } from "./api";
import type { AdminStats, AdminUser, ContentReport, Item } from "@/types";

export const adminService = {
  stats: (signal?: AbortSignal) => api.get<AdminStats>("/api/admin/stats", signal),

  /** Every post, including removed ones, so a removal can be reviewed. */
  listPosts: (signal?: AbortSignal) => api.get<Item[]>("/api/admin/posts", signal),

  removePost: (id: number) =>
    api.patch<{ success: boolean }>(`/api/admin/posts/${id}/remove`),

  restorePost: (id: number) =>
    api.patch<{ success: boolean }>(`/api/admin/posts/${id}/restore`),

  listReports: (signal?: AbortSignal) =>
    api.get<ContentReport[]>("/api/admin/reports", signal),

  reviewReport: (id: number, status: "reviewed" | "dismissed") =>
    api.patch<{ success: boolean }>(`/api/admin/reports/${id}`, { status }),

  listUsers: (signal?: AbortSignal) => api.get<AdminUser[]>("/api/admin/users", signal),

  setSuspended: (id: number, isSuspended: boolean) =>
    api.patch<{ success: boolean }>(`/api/admin/users/${id}`, { is_suspended: isSuspended }),

  updateUser: (id: number, data: { is_suspended: boolean; email?: string; password?: string }) =>
    api.patch<{ success: boolean }>(`/api/admin/users/${id}`, data),
};
