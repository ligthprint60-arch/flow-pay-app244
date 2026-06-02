import React from "react";

// Catalog of custom emojis. `premium` = requires Flow Premium to use.
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

/**
 * Renders text replacing `:emoji_id:` with a glowing span (premium-styled if applicable).
 */
export function renderWithEmojis(text: string): React.ReactNode {
  const parts = text.split(/(:[a-z_]+:)/g);
  return parts.map((part, i) => {
    const m = part.match(/^:([a-z_]+):$/);
    if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
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
