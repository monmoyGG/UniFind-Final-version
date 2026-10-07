import { api } from "./api";
import type { Dashboard } from "@/types";

export const dashboardService = {
  /** Counts, recent posts and recent activity for the signed-in member. */
  get: (signal?: AbortSignal) => api.get<Dashboard>("/api/dashboard", signal),
};
