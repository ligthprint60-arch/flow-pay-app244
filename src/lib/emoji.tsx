import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Catalog of built-in emojis. `premium` = requires Flow Premium to use.
export const CUSTOM_EMOJIS: { id: string; char: string; price: number; premium: boolean; label: string }[] = [
  { id: "flow",     char: "💧", price: 40,  premium: false, label: "Flow drop" },
  { id: "coin",     char: "🪙", price: 50,  premium: false, label: "Coin" },
  { id: "spark",    char: "✨", price: 60,  premium: false, label: "Spark" },
  { id: "rocket",   char: "🚀", price: 80,  premium: false, label: "Rocket" },
  { id: "fire",     char: "🔥", price: 80,  premium: false, label: "Fire" },
  { id: "diamond",  char: "💎", price: 120, premium: true,  label: "Diamond (premium)" },
  { id: "crown",    char: "👑", price: 150, premium: true,  label: "Crown (premium)" },
  { id: "rainbow",  char: "🌈", price: 180, premium: true,  label: "Rainbow (premium)" },
  { id: "lightning",char: "⚡", price: 90,  premium: true,  label: "Lightning (premium)" },
  { id: "infinity", char: "♾",  price: 220, premium: true,  label: "Infinity (premium)" },
];

const MAP = new Map(CUSTOM_EMOJIS.map((e) => [e.id, e]));

export type CustomImageEmoji = { id: string; owner_id: string; shortcode: string; image_url: string };

/** Globally fetched user-created image emojis (visible to everyone). */
export function useImageEmojis() {
  return useQuery({
    queryKey: ["custom-emojis-global"],
    queryFn: async (): Promise<CustomImageEmoji[]> => {
      const { data } = await supabase.from("custom_emojis" as never)
        .select("id,owner_id,shortcode,image_url")
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as CustomImageEmoji[] | null) ?? [];
    },
    staleTime: 60_000,
  });
}

export function buildImageEmojiMap(list: CustomImageEmoji[] | undefined) {
  const m = new Map<string, CustomImageEmoji>();
  (list ?? []).forEach((e) => { if (!m.has(e.shortcode)) m.set(e.shortcode, e); });
  return m;
}

/**
 * Renders text replacing `:emoji_id:` with built-in glyph or custom image.
 */
export function renderWithEmojis(
  text: string,
  imageMap?: Map<string, CustomImageEmoji>,
): React.ReactNode {
  const parts = text.split(/(:[a-z0-9_]+:)/g);
  return parts.map((part, i) => {
    const m = part.match(/^:([a-z0-9_]+):$/);
    if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
    const img = imageMap?.get(m[1]);
    if (img) {
      return (
        <img
          key={i}
          src={img.image_url}
          alt={`:${img.shortcode}:`}
          className="inline-block align-[-4px] size-[1.35em] rounded-sm"
          loading="lazy"
        />
      );
    }
    const e = MAP.get(m[1]);
    if (!e) return <React.Fragment key={i}>{part}</React.Fragment>;
    return (
      <span
        key={i}
        title={e.label}
        className={
          "inline-block align-[-2px] text-[1.15em] " +
          (e.premium ? "drop-shadow-[0_0_6px_var(--eco-glow)]" : "")
        }
      >
        {e.char}
      </span>
    );
  });
}
