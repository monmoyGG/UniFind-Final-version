import { api } from "./api";
import type { Claim, ClaimAnswer, ClaimQuestion, ClaimQuestionDraft } from "@/types";

export const claimService = {
  /** Submit an ownership claim with a short verification message. */
  create: (itemId: number, verificationMessage: string, answers: ClaimAnswer[]) =>
    api.post<Claim>(`/api/items/${itemId}/claims`, {
      verification_message: verificationMessage,
      answers,
    }),

  questions: (itemId: number, signal?: AbortSignal) =>
    api.get<ClaimQuestion[]>(`/api/items/${itemId}/claim-questions`, signal),

  manageQuestions: (itemId: number, signal?: AbortSignal) =>
    api.get<{ questions: (ClaimQuestion & ClaimQuestionDraft)[]; locked: boolean }>(
      `/api/items/${itemId}/claim-questions/manage`, signal
    ),

  saveQuestions: (itemId: number, questions: ClaimQuestionDraft[]) =>
    api.put<{ questions: (ClaimQuestion & ClaimQuestionDraft)[]; locked: boolean }>(
      `/api/items/${itemId}/claim-questions/manage`, { questions }
    ),

  /** Both directions: claims received on own posts, and claims submitted. */
  list: (signal?: AbortSignal) => api.get<Claim[]>("/api/claims", signal),

  review: (claimId: number, status: "approved" | "rejected") =>
    api.patch<Claim>(`/api/claims/${claimId}`, { status }),
};
