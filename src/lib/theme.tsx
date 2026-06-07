import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export type AccentTheme = {
  id: string;
  name: string;
  eco: string;
  ecoGlow: string;
  fiat: string;
  price: number;
};

export const ACCENTS: AccentTheme[] = [
  { id: "emerald", name: "Emerald (default)", eco: "#10B981", ecoGlow: "rgba(16,185,129,0.45)", fiat: "#2563EB", price: 0 },
  { id: "violet",  name: "Violet Dusk",       eco: "#A78BFA", ecoGlow: "rgba(167,139,250,0.45)", fiat: "#7C3AED", price: 80 },
  { id: "rose",    name: "Rose Plasma",       eco: "#F43F5E", ecoGlow: "rgba(244,63,94,0.45)",   fiat: "#E11D48", price: 80 },
  { id: "cyan",    name: "Cyber Cyan",        eco: "#22D3EE", ecoGlow: "rgba(34,211,238,0.45)",  fiat: "#0EA5E9", price: 80 },
  { id: "amber",   name: "Solar Amber",       eco: "#F59E0B", ecoGlow: "rgba(245,158,11,0.45)",  fiat: "#D97706", price: 80 },
  { id: "lime",    name: "Acid Lime",         eco: "#A3E635", ecoGlow: "rgba(163,230,53,0.45)",  fiat: "#65A30D", price: 80 },
];

export type CardSkin = { id: string; name: string; className: string; price: number; };

export const SKINS: CardSkin[] = [
  { id: "default", name: "Clear Glass",    className: "skin-default", price: 0   },
  { id: "aurora",  name: "Aurora Field",   className: "skin-aurora",  price: 150 },
  { id: "magma",   name: "Magma Drift",    className: "skin-magma",   price: 200 },
  { id: "arctic",  name: "Arctic Frost",   className: "skin-arctic",  price: 180 },
  { id: "noir",    name: "Obsidian Noir",  className: "skin-noir",    price: 220 },
  { id: "gold",    name: "Liquid Gold",    className: "skin-gold",    price: 300 },
];

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
}

export function ThemeApplier() {
  const { data: profile } = useProfile();
  useEffect(() => {
    const accent = ACCENTS.find((a) => a.id === profile?.accent_theme) ?? ACCENTS[0];
    const root = document.documentElement;
    root.style.setProperty("--eco", accent.eco);
    root.style.setProperty("--eco-glow", accent.ecoGlow);
    root.style.setProperty("--fiat", accent.fiat);
    root.style.setProperty("--success", accent.eco);
  }, [profile?.accent_theme]);

  // App background (user image OR video)
  useEffect(() => {
    const bg = (profile as { app_background_url?: string | null } | null | undefined)?.app_background_url;
    const img = document.getElementById("flow-app-bg") as HTMLDivElement | null;
    const vid = document.getElementById("flow-app-bg-video") as HTMLVideoElement | null;
    if (!img || !vid) return;
    const isVideo = !!bg && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(bg);
    if (bg && isVideo) {
      vid.src = bg;
      vid.style.opacity = "0.55";
      vid.play().catch(() => {});
      img.style.backgroundImage = "";
      img.style.opacity = "0";
    } else if (bg) {
      img.style.backgroundImage = `url("${bg}")`;
      img.style.opacity = "0.55";
      vid.removeAttribute("src"); vid.load(); vid.style.opacity = "0";
    } else {
      img.style.backgroundImage = ""; img.style.opacity = "0";
      vid.removeAttribute("src"); vid.load(); vid.style.opacity = "0";
    }
  }, [(profile as { app_background_url?: string | null } | null | undefined)?.app_background_url]);

  return null;
}

export function getActiveSkinClass(skinId: string | undefined) {
  return SKINS.find((s) => s.id === skinId)?.className ?? "skin-default";
}
