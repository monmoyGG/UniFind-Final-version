import { api } from "./api";
import type { Match } from "@/types";

export const matchService = {
  /** Rule-based Smart Match suggestions for the member's own reports. */
  list: (signal?: AbortSignal) => api.get<Match[]>("/api/matches", signal),
};
