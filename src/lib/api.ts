import type { UserProfile } from "../types";
import { getAccessToken } from "./auth";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
// The server gives up on the AI after 90s, so wait slightly longer than that.
const REQUEST_TIMEOUT_MS = 100_000;

/** Error from the backend. `code` is a stable identifier such as "AI_BUSY" or "DAILY_LIMIT". */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Used when the response has no message of its own (for example a 429 from a proxy in front of the server). */
function fallbackMessage(status: number): string {
  if (status === 401) return "Please sign in again.";
  if (status === 429) return "You've reached a usage limit for now. Please try again later.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a few minutes.";
  return "Something went wrong. Please try again.";
}

/** The server identifies the user from this Neon Auth token, never from anything we send in the body. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError("Please sign in again.", 401, "UNAUTHENTICATED");
  }
  return { Authorization: `Bearer ${token}` };
}

async function request(method: "GET" | "POST", path: string, body?: object) {
  const headers = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(await authHeaders()),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || fallbackMessage(res.status), res.status, data.code);
    }
    return res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        "This is taking longer than expected. Please try again in a few minutes.",
        0,
        "TIMEOUT",
      );
    }
    throw new ApiError(
      "Can't reach the server right now. Please try again in a moment.",
      0,
      "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  saveProfile: (profile: Omit<UserProfile, "userId" | "updatedAt">) =>
    request("POST", "/profile", profile),

  generatePlan: () => request("POST", "/plan/generate", {}),

  getCurrentPlan: () => request("GET", "/plan/current"),
};
