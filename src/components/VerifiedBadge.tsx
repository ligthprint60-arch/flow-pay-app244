import { BadgeCheck } from "lucide-react";

/**
 * Blue check = officially verified personality. ALWAYS blue regardless of theme accent.
 * Green check = registered author (uses accent eco).
 */
export function VerifiedBadge({
  isVerified,
  isAuthor,
  size = 14,
}: { isVerified?: boolean; isAuthor?: boolean; size?: number }) {
  if (isVerified) {
    return (
      <BadgeCheck
        style={{ width: size, height: size, color: "#2563EB", filter: "drop-shadow(0 0 6px rgba(37,99,235,0.7))" }}
        strokeWidth={2.4}
      />
    );
  }
  if (isAuthor) {
    return (
      <BadgeCheck
        className="text-eco drop-shadow-[0_0_6px_var(--eco-glow)]"
        style={{ width: size, height: size }}
        strokeWidth={2.4}
      />
    );
  }
  return null;
}
