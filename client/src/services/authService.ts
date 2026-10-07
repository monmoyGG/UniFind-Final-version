import { api } from "./api";
import type { Pending, User, Verification } from "@/types";

/**
 * Exactly one of `user` and `verification` comes back.
 *
 * With email confirmation off, `user` is the signed-in member — registering is
 * the sign-in. With it on, registering signs nobody in and `verification`
 * describes the code that was sent; the session arrives from verify() instead.
 */
export type RegisterResult = {
  name: string;
  email: string;
  user: User | null;
  verification: Verification | null;
};

export const authService = {
  register: (payload: {
    name: string;
    email: string;
    password: string;
    department?: string;
  }) => api.post<RegisterResult>("/api/auth/register", payload),

  login: (payload: { email: string; password: string }) =>
    api.post<User>("/api/auth/login", payload),

  logout: () => api.post<{ success: boolean }>("/api/auth/logout"),

  /** Throws ApiError(401) when there is no valid session. */
  me: (signal?: AbortSignal) => api.get<User>("/api/auth/me", signal),

  /** Who the confirmation screen is waiting on. Throws 401 once it lapses. */
  pending: (signal?: AbortSignal) => api.get<Pending>("/api/auth/pending", signal),

  /** Confirm the UIU address with the emailed code. This is also the sign-in. */
  verify: (code: string) =>
    api.post<{ user: User; message: string }>("/api/auth/verify", { code }),

  /** Ask for a fresh code. The backend allows this once a minute. */
  resend: () => api.post<Verification>("/api/auth/resend"),

  /** Change the current user's password. Requires current password. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ success: boolean }>("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};
