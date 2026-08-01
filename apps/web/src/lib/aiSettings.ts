export type AiSettings = {
  provider: string;
  model: string;
} | null;

const KEY = "adhoc_ai_settings";

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.provider === "string" && typeof parsed?.model === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    if (settings) localStorage.setItem(KEY, JSON.stringify(settings));
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage unavailable (private mode, SSR) — settings just won't persist.
  }
}
