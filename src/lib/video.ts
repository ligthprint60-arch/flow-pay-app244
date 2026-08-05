export const VIDEO_CATEGORIES = [
  { id: "general", label: "Общее" },
  { id: "finance", label: "Финансы" },
  { id: "tech", label: "Технологии" },
  { id: "education", label: "Обучение" },
  { id: "music", label: "Музыка" },
  { id: "gaming", label: "Игры" },
  { id: "vlog", label: "Влог" },
] as const;

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} млн`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")} тыс.`;
  return String(n);
}

export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}
