import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmt } from "@/lib/format";
import { LogOut, BadgeCheck, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Профиль — FLOW" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
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
    onSuccess: () => {
      toast.success("Статус автора активирован");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (profile?.display_name ?? "??").slice(0, 2).toUpperCase();

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Профиль</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Аккаунт</h1>
      </div>

      <div className="lrf lrf-thick p-5">
        <div className="relative z-10 flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-eco/50 to-fiat/40 font-mono text-lg font-bold emissive-eco">
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

      {/* Balance summary */}
      <div className="lrf mt-3 p-4">
        <div className="relative z-10 grid grid-cols-3 gap-2">
          <Stat label="rFLOW" value={fmt(wallet?.rflow_balance ?? 0)} accent="fiat" />
          <Stat label="Active" value={fmt(wallet?.fflow_active ?? 0)} accent="eco" />
          <Stat label="Pending" value={fmt(wallet?.fflow_pending ?? 0)} accent="warning" />
        </div>
      </div>

      {/* Author CTA */}
      {!profile?.is_author && (
        <button
          onClick={() => applyAuthor.mutate()}
          disabled={applyAuthor.isPending}
          className="lrf mt-3 flex w-full items-center justify-between p-4 text-left transition-transform active:scale-[0.99]"
        >
          <div className="relative z-10 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-eco/20 emissive-eco">
              <Shield className="size-5 text-eco" />
            </div>
            <div>
              <p className="text-sm font-semibold">Стать автором</p>
              <p className="text-xs text-muted-foreground">Публикуйте контент о финансах</p>
            </div>
          </div>
          <span className="relative z-10 font-mono text-[10px] uppercase tracking-widest text-eco">demo</span>
        </button>
      )}

      <div className="mt-6 space-y-1">
        <Row icon={Settings} label="Настройки" />
        <Row icon={Shield} label="Безопасность" />
        <button
          onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          <span>Выйти</span>
        </button>
      </div>

      <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        FLOW Network · v0.2 · FLDS 3.0
      </p>
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

function Row({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="acrylic flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/[0.05]">
      <Icon className="size-4 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}
