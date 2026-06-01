import { BadgeCheck } from "lucide-react";

/** Blue check = officially verified personality. Green check = registered author. */
export function VerifiedBadge({
  isVerified,
  isAuthor,
  size = 14,
}: { isVerified?: boolean; isAuthor?: boolean; size?: number }) {
  if (isVerified) {
    return (
      <BadgeCheck
        className="text-fiat drop-shadow-[0_0_6px_rgba(37,99,235,0.65)]"
        style={{ width: size, height: size }}
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
