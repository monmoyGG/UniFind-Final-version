import { api } from "./api";
import type { Notification } from "@/types";

export const notificationService = {
  list: (signal?: AbortSignal) => api.get<Notification[]>("/api/notifications", signal),

  markRead: (id: number) =>
    api.patch<{ success: boolean }>(`/api/notifications/${id}/read`),

  markAllRead: () => api.patch<{ success: boolean }>("/api/notifications/read-all"),
};
