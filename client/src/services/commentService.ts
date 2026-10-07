import { api } from "./api";
import type { Comment } from "@/types";

export const commentService = {
  list: (itemId: number, signal?: AbortSignal) =>
    api.get<Comment[]>(`/api/items/${itemId}/comments`, signal),

  create: (itemId: number, body: string) =>
    api.post<Comment>(`/api/items/${itemId}/comments`, { body }),
};
