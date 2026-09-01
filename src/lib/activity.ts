/**
 * Lightweight local activity trail used by the AI assistant to understand
 * what the user has been doing. Kept in memory + sessionStorage only.
 */
export type ActivityEvent = { at: number; kind: string; detail: string };

const KEY = "flow.activity.v1";
const MAX = 40;
let trail: ActivityEvent[] = [];
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) trail = JSON.parse(raw) as ActivityEvent[];
  } catch { /* ignore */ }
}

export function logActivity(kind: string, detail: string) {
  if (typeof window === "undefined") return;
  load();
  const last = trail[trail.length - 1];
  if (last && last.kind === kind && last.detail === detail) return;
  trail.push({ at: Date.now(), kind, detail });
  if (trail.length > MAX) trail = trail.slice(-MAX);
  try { window.sessionStorage.setItem(KEY, JSON.stringify(trail)); } catch { /* ignore */ }
}

export function getActivity(): ActivityEvent[] {
  load();
  return trail;
}

/** Compact, human-readable summary handed to the model. */
export function activitySummary(): string {
  const items = getActivity().slice(-20);
  if (!items.length) return "no recorded activity yet";
  return items
    .map((e) => `${new Date(e.at).toISOString().slice(11, 19)} ${e.kind}: ${e.detail}`)
    .join("\n");
}
