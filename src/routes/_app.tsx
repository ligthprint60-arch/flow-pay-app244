import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
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
        <div className="size-2 animate-pulse rounded-full bg-eco" />
      </div>
    );
  }

  return (
    <div className="relative min-h-svh bg-background">
      <main className="mx-auto max-w-md pb-28">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="group flex flex-1 flex-col items-center gap-1 py-2"
              >
                <Icon
                  className={`size-[22px] transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className={`text-[10px] font-medium tracking-wide transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.label}
                </span>
                {active && <span className="absolute bottom-0 mt-1 h-0.5 w-6 rounded-full bg-eco glow-eco" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
