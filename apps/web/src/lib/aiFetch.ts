import { env } from "@/lib/env";

export type AiPostResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

type AiPostMessages = {
  /** Shown for non-OK responses without a usable server-provided detail. */
  generic: string;
  /** Shown when the request itself fails (network error, malformed JSON). */
  network: string;
};

/**
 * POST JSON to an /ai API endpoint and classify failures into user-safe
 * messages: server `detail` (trimmed to 160 chars), 429 rate-limit, 503
 * provider-down with a settings hint, or the caller's fallbacks.
 *
 * Never throws and never touches UI state — callers own toasts and any
 * stale-response checks (e.g. columnsRef), which must run before toasting.
 */
export async function postAi(
  path: string,
  body: unknown,
  messages: AiPostMessages
): Promise<AiPostResult> {
  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        if (typeof errorBody?.detail === "string") {
          detail = errorBody.detail.slice(0, 160);
        }
      } catch {
        // Non-JSON error body — fall through to the generic messages.
      }
      if (response.status === 429) {
        return {
          ok: false,
          message: "AI rate limit reached — try again in a minute.",
        };
      }
      if (response.status === 503) {
        return {
          ok: false,
          message: `${detail || "AI provider unavailable."} Check your AI settings.`,
        };
      }
      return { ok: false, message: detail || messages.generic };
    }
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, message: messages.network };
  }
}
