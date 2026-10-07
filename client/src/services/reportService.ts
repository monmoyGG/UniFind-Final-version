import { api } from "./api";

export const reportService = {
  /** Flag a post, comment, or member for admin review. */
  flag: (payload: {
    target_type: "item" | "comment" | "user";
    target_id: number;
    reason: string;
  }) => api.post<{ success: boolean }>("/api/reports", payload),
};
