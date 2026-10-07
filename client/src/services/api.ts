/**
 * One place where the React app talks to FastAPI.
 *
 * Every request sends `credentials: "include"` so the httpOnly session cookie
 * issued by the backend travels with it. The token itself is never readable
 * from JavaScript, which is the point.
 */

/**
 * In development, Vite proxies /api and /uploads to http://127.0.0.1:8000 (see
 * vite.config.ts), so a relative base URL works without any CORS setup.
 * Set VITE_API_BASE_URL when the API lives on a different host.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  /** Machine-readable tag when the backend sent one, e.g. "email_unverified". */
  code?: string;
  /** Anything else the backend attached to a structured `detail`. */
  data?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, data?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** True when the failure means "you are not signed in". */
export const isUnauthorized = (error: unknown) =>
  error instanceof ApiError && error.status === 401;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send a FormData body untouched (used for the photo upload). */
  formData?: FormData;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include",
      signal,
      // Let the browser set the multipart boundary itself for FormData.
      headers: formData ? undefined : { "Content-Type": "application/json" },
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    // fetch only rejects when the request never reached the server.
    throw new ApiError(
      "Unable to reach the UniFind server. Is the backend running on port 8000?",
      0
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // FastAPI puts the reason in `detail`. Usually a plain sentence, but routes
    // the app has to branch on send an object instead: {code, message, ...}.
    // (Validation failures make it a list, which falls through to the default.)
    const raw = payload?.detail;
    const structured = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
    const message =
      (typeof raw === "string" && raw) ||
      (typeof structured?.message === "string" && structured.message) ||
      "Something went wrong. Please try again.";
    throw new ApiError(message, response.status, structured?.code, structured ?? undefined);
  }

  return payload as T;
}

/** Build a query string, skipping empty values so `?category=` never appears. */
export function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", formData }),
};
