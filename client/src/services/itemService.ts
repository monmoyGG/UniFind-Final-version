import { api, toQuery } from "./api";
import type { Item, ItemFilters, ItemStatus, PublicStats } from "@/types";

export type ItemPayload = {
  type: "lost" | "found";
  title: string;
  category: string;
  description: string;
  location: string;
  /** ISO date string, e.g. "2026-08-12". */
  date_lost_found: string;
  image_url?: string | null;
  brand?: string | null;
  color?: string | null;
  model?: string | null;
  identifying_details?: string | null;
};

export const itemService = {
  /** Browse, search, filter and sort — FEATURE 2. */
  list: (filters: ItemFilters = {}, signal?: AbortSignal) =>
    api.get<Item[]>(`/api/items${toQuery({ ...filters })}`, signal),

  getById: (id: number, signal?: AbortSignal) => api.get<Item>(`/api/items/${id}`, signal),

  /** Report a lost or found item — FEATURE 1. */
  create: (payload: ItemPayload) =>
    api.post<{ item: Item; match_count: number }>("/api/items", payload),

  update: (id: number, payload: Partial<ItemPayload>) =>
    api.put<Item>(`/api/items/${id}`, payload),

  setStatus: (id: number, status: ItemStatus) =>
    api.patch<Item>(`/api/items/${id}/status`, { status }),

  remove: (id: number) => api.delete<{ success: boolean }>(`/api/items/${id}`),

  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload<{ url: string }>("/api/items/upload", formData);
  },

  /** Anonymous counters for the public Home page — no listing details. */
  publicStats: (signal?: AbortSignal) => api.get<PublicStats>("/api/stats", signal),
};
