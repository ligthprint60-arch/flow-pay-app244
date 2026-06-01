import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile, ACCENTS, SKINS } from "@/lib/theme";
import { useIsAdmin } from "@/lib/admin";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { fmt } from "@/lib/format";
import { LogOut, BadgeCheck, Sparkles, Check, Palette, Layers, Shield, Ban } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Профиль — FLOW" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();

  const requestVerif = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_request_verification", { note: "Прошу синюю верификацию" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Заявка отправлена"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });


  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const applyAuthor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ is_author: true }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Статус автора активирован"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const buy = useMutation({
    mutationFn: async (args: { type: "accent" | "skin"; id: string; cost: number }) => {
      const { data, error } = await supabase.rpc("app_purchase_customization", {
        item_type: args.type, item_id: args.id, cost: args.cost,
      });
      if (error) {
        const map: Record<string, string> = {
          insufficient_fflow: "Недостаточно active fFLOW",
          invalid_cost: "Некорректная цена",
        };
        throw new Error(map[error.message] ?? error.message);
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Применено");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (profile?.display_name ?? "??").slice(0, 2).toUpperCase();
  const ownedAccents: string[] = profile?.owned_accents ?? ["emerald"];
  const ownedSkins: string[] = profile?.owned_skins ?? ["default"];

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Профиль</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Аккаунт</h1>
      </div>

      <div className="lrf lrf-thick p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-eco/60 to-fiat/40 font-mono text-lg font-bold emissive-eco">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-lg font-semibold">{profile?.display_name}</h2>
              {profile?.is_author && <BadgeCheck className="size-4 text-eco" />}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{profile?.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className="lrf mt-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="rFLOW" value={fmt(wallet?.rflow_balance ?? 0)} accent="fiat" />
          <Stat label="Active" value={fmt(wallet?.fflow_active ?? 0)} accent="eco" />
          <Stat label="Pending" value={fmt(wallet?.fflow_pending ?? 0)} accent="warning" />
        </div>
      </div>

      {/* Author CTA */}
      {!profile?.is_author && (
        <button
          onClick={() => applyAuthor.mutate()} disabled={applyAuthor.isPending}
          className="lrf lrf-tap mt-3 flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-eco/20 emissive-eco">
              <BadgeCheck className="size-5 text-eco" />
            </div>
            <div>
              <p className="text-sm font-semibold">Стать автором</p>
              <p className="text-xs text-muted-foreground">Публикуйте контент о финансах</p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-eco">demo</span>
        </button>
      )}

      {/* === FLOW Shop === */}
      <Section icon={Palette} title="Акцентный цвет" hint="оплата · active fFLOW">
        <div className="grid grid-cols-3 gap-2">
          {ACCENTS.map((a) => {
            const owned = ownedAccents.includes(a.id);
            const active = profile?.accent_theme === a.id;
            const disabled = buy.isPending || (!owned && (wallet?.fflow_active ?? 0) < a.price);
            return (
              <button
                key={a.id}
                onClick={() => buy.mutate({ type: "accent", id: a.id, cost: owned ? 0 : a.price })}
                disabled={disabled}
                className={`lrf lrf-tap !rounded-2xl p-3 text-left disabled:opacity-40 ${active ? "emissive-eco" : ""}`}
              >
                <div
                  className="h-10 w-full rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${a.eco}, ${a.fiat})`, boxShadow: `0 8px 24px -6px ${a.ecoGlow}` }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="truncate text-[11px] font-medium">{a.name.split(" ")[0]}</span>
                  {active ? <Check className="size-3.5 text-eco" /> :
                    owned ? <span className="font-mono text-[9px] text-muted-foreground">owned</span> :
                    <span className="font-mono text-[10px] tabular text-eco">{a.price}f</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={Layers} title="Скин карты" hint="оплата · active fFLOW">
        <div className="grid grid-cols-2 gap-2">
          {SKINS.map((s) => {
            const owned = ownedSkins.includes(s.id);
            const active = profile?.card_skin === s.id;
            const disabled = buy.isPending || (!owned && (wallet?.fflow_active ?? 0) < s.price);
            return (
              <button
                key={s.id}
                onClick={() => buy.mutate({ type: "skin", id: s.id, cost: owned ? 0 : s.price })}
                disabled={disabled}
                className={`lrf lrf-tap ${s.className} !rounded-2xl p-3 text-left disabled:opacity-40 ${active ? "emissive-eco" : ""}`}
              >
                <div className="h-14 w-full rounded-xl" />
                <div className="mt-2 flex items-center justify-between">
                  <span className="truncate text-[11px] font-medium">{s.name}</span>
                  {active ? <Check className="size-3.5 text-eco" /> :
                    owned ? <span className="font-mono text-[9px] text-muted-foreground">owned</span> :
                    <span className="font-mono text-[10px] tabular text-eco">{s.price}f</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Sign out */}
      <button
        onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
        className="mt-6 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10"
      >
        <LogOut className="size-4" />
        <span>Выйти</span>
      </button>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        FLOW · v0.3 · FLDS 3.0 Luminous Glass
      </p>
    </div>
  );
}

function Section({
  icon: Icon, title, hint, children,
}: { icon: React.ComponentType<{ className?: string }>; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-eco" />
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{title}</h2>
        </div>
        {hint && <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "fiat" | "eco" | "warning" }) {
  const cls = accent === "fiat" ? "text-fiat" : accent === "eco" ? "text-eco" : "text-warning";
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-bold tabular ${cls}`}>{value}</p>
    </div>
  );
}

// Avoid unused-import warnings on Sparkles
export const _s = Sparkles;
