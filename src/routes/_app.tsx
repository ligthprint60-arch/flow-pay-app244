import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeApplier } from "@/lib/theme";
import { Wallet, Newspaper, GraduationCap, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const tabs = [
  { to: "/wallet", label: "Кошелёк", icon: Wallet },
  { to: "/feed", label: "Лента", icon: Newspaper },
  { to: "/learn", label: "Учёба", icon: GraduationCap },
  { to: "/profile", label: "Я", icon: UserIcon },
] as const;

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="size-3 animate-pulse rounded-full bg-eco glow-eco" />
      </div>
    );
  }

  return (
    <div className="relative min-h-svh">
      <ThemeApplier />
      <main className="relative z-10 mx-auto max-w-md pb-32">
        <Outlet />
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        <div className="lrf lrf-thick pointer-events-auto mx-4 flex w-[min(100%,420px)] items-stretch justify-around px-2 py-2">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="lrf-tap group relative z-10 flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-all"
              >
                {active && (
                  <span className="absolute inset-1 rounded-2xl bg-gradient-to-br from-eco/35 to-fiat/20 emissive-eco" />
                )}
                <Icon
                  className={`relative size-[22px] transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className={`relative text-[10px] font-medium tracking-wide transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
