import { api } from "./api";
import type { Conversation, ConversationDetail, Message } from "@/types";

export const messageService = {
  listConversations: (signal?: AbortSignal) =>
    api.get<Conversation[]>("/api/conversations", signal),

  getConversation: (id: number, signal?: AbortSignal) =>
    api.get<ConversationDetail>(`/api/conversations/${id}`, signal),

  /**
   * Open the conversation about an item, or return the existing one.
   * `recipientId` is only needed when the poster starts the thread themselves.
   */
  start: (itemId: number, options: { claimId?: number; recipientId?: number } = {}) =>
    api.post<ConversationDetail>("/api/conversations", {
      item_id: itemId,
      claim_id: options.claimId ?? null,
      recipient_id: options.recipientId ?? null,
    }),

  /** Start a direct conversation with another member (admin↔anyone, no item required). */
  startDirect: (recipientId: number) =>
    api.post<ConversationDetail>("/api/conversations/direct", {
      recipient_id: recipientId,
    }),

  send: (conversationId: number, body: string) =>
    api.post<Message>(`/api/conversations/${conversationId}/messages`, { body }),
};
