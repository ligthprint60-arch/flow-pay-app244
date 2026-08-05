import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  Newspaper,
  MessageCircle,
  GraduationCap,
  User as UserIcon,
  LayoutGrid,
  Handshake,
  PlaySquare,
  type LucideIcon,
} from "lucide-react";

export type Section = {
  id: string;
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
};

export const SECTIONS: Section[] = [
  { id: "wallet", to: "/wallet", label: "Кошелёк", desc: "Балансы, P2P, пополнение", icon: Wallet },
  { id: "video", to: "/video", label: "Видео", desc: "FLOW Video — видеохостинг", icon: PlaySquare },
  { id: "feed", to: "/feed", label: "Лента", desc: "Посты сообщества", icon: Newspaper },
  { id: "ecosystem", to: "/ecosystem", label: "Apps", desc: "Экосистема мини-приложений", icon: LayoutGrid },
  { id: "partners", to: "/partners", label: "PAS", desc: "Цифровые партнёрства", icon: Handshake },
  { id: "chats", to: "/chats", label: "Чаты", desc: "Личные сообщения", icon: MessageCircle },
  { id: "learn", to: "/learn", label: "Учёба", desc: "Квизы и награды", icon: GraduationCap },
  { id: "profile", to: "/profile", label: "Я", desc: "Профиль и настройки", icon: UserIcon },
];

export const MAX_PINNED = 4;
const KEY = "flow.dock.pinned.v1";
const DEFAULT_PINNED = ["wallet", "video", "chats", "profile"];

function read(): string[] {
  if (typeof window === "undefined") return DEFAULT_PINNED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PINNED;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((id) => SECTIONS.some((s) => s.id === id));
    return valid.length ? valid.slice(0, MAX_PINNED) : DEFAULT_PINNED;
  } catch {
    return DEFAULT_PINNED;
  }
}

/** Sections pinned to the floating dock, persisted locally. */
export function usePinnedSections() {
  const [pinned, setPinned] = useState<string[]>(DEFAULT_PINNED);

  useEffect(() => {
    setPinned(read());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setPinned(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setPinned((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_PINNED
          ? [...prev.slice(1), id]
          : [...prev, id];
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
      return next;
    });
  }, []);

  const items = pinned
    .map((id) => SECTIONS.find((s) => s.id === id))
    .filter(Boolean) as Section[];

  return { pinned, items, toggle };
}
