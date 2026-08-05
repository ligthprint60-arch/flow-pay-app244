import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeApplier } from "@/lib/theme";
import { motion } from "framer-motion";
import { Settings2, Bell, LayoutGrid } from "lucide-react";
import { SettingsSheet } from "@/components/SettingsSheet";
import { ShopDialog } from "@/components/Shop";
import { PremiumEditor } from "@/components/PremiumEditor";
import { NotificationsSheet, useUnreadCount } from "@/components/NotificationsSheet";
import { SectionsWindow } from "@/components/SectionsWindow";
import { usePinnedSections } from "@/lib/sections";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const { items: tabs } = usePinnedSections();
  const { data: unread } = useUnreadCount();
  const immersiveRoute = pathname.startsWith("/chats/");


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

      {!immersiveRoute && <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-[max(env(safe-area-inset-top),10px)]">
        <div className="pointer-events-auto mx-3 flex w-[min(100%,460px)] items-center justify-end gap-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setNotifOpen(true)}
            className="lrf relative grid size-10 place-items-center !rounded-full"
            aria-label="Уведомления"
          >
            <Bell className="size-[18px]" />
            {!!unread && unread > 0 && (
              <span className="absolute right-1 top-1 grid min-w-[16px] place-items-center rounded-full bg-eco px-1 text-[9px] font-bold text-background emissive-eco">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setSettingsOpen(true)}
            className="lrf grid size-10 place-items-center !rounded-full"
            aria-label="Настройки"
          >
            <Settings2 className="size-[18px]" />
          </motion.button>
        </div>
      </div>}

      <main className={`relative z-10 mx-auto max-w-md ${immersiveRoute ? "pb-0 pt-0" : "pb-32 pt-16"}`}>
        <Outlet />
      </main>

      {!immersiveRoute && <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
        <div className="lrf lrf-thick pointer-events-auto mx-4 flex w-[min(100%,460px)] items-stretch justify-around px-2 py-2">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="lrf-tap group relative z-10 flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2"
              >
                {active && (
                  <motion.span
                    layoutId="active-tab"
                    className="absolute inset-1 rounded-2xl bg-gradient-to-br from-eco/35 to-fiat/20 emissive-eco"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative size-[20px] transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className={`relative text-[9.5px] font-medium tracking-wide transition-colors ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setSectionsOpen(true)}
            aria-label="Все разделы"
            className="lrf-tap relative z-10 flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2"
          >
            <LayoutGrid className="relative size-[20px] text-muted-foreground" strokeWidth={1.8} />
            <span className="relative text-[9.5px] font-medium tracking-wide text-muted-foreground">Ещё</span>
          </button>
        </div>
      </nav>}

      <SectionsWindow open={sectionsOpen} onOpenChange={setSectionsOpen} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenShop={() => setShopOpen(true)}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenPremium={() => setPremiumOpen(true)}
      />
      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
      <PremiumEditor open={premiumOpen} onOpenChange={setPremiumOpen} />
      <NotificationsSheet open={notifOpen} onOpenChange={setNotifOpen} />

    </div>
  );
}

