import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { fmt } from "@/lib/format";
import { toast } from "sonner";
import {
  Shield, Search, BadgeCheck, Ban, UserCheck, Sparkles, Flame, Coins, X, ArrowLeft,
  LayoutGrid, CheckCircle2, RotateCcw,
} from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin · FLOW" }] }),
  component: AdminPage,
});

type AdminUser = {
  id: string; username: string; display_name: string;
  is_author: boolean; is_verified: boolean; is_blocked: boolean;
  verification_requested: boolean; verification_note: string | null;
  rflow_balance: number; fflow_active: number; fflow_pending: number;
};

type AdminMiniApp = {
  id: string;
  owner_id: string;
  owner_username: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  icon_url: string | null;
  app_url: string;
  category: string;
  status: string;
  installs: number;
};

function AdminPage() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [mintFor, setMintFor] = useState<AdminUser | null>(null);
  const [appSearch, setAppSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) navigate({ to: "/wallet", replace: true });
  }, [isAdmin, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("app_admin_stats");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search, onlyPending],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase.rpc("app_admin_list_users", {
        search: search.trim() || undefined,
        only_pending: onlyPending,
      });
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });

  const { data: apps, isLoading: appsLoading } = useQuery({
    queryKey: ["admin-mini-apps", appSearch],
    enabled: isAdmin,
    queryFn: async (): Promise<AdminMiniApp[]> => {
      const { data, error } = await supabase.rpc("app_list_mini_apps", {
        p_category: undefined,
        p_search: appSearch.trim() || undefined,
        p_only_mine: false,
      });
      if (error) throw error;
      return (data ?? []) as AdminMiniApp[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const refreshApps = () => {
    qc.invalidateQueries({ queryKey: ["admin-mini-apps"] });
    qc.invalidateQueries({ queryKey: ["mini_apps"] });
  };

  const setFlag = useMutation({
    mutationFn: async ({ username, flag, value }: { username: string; flag: "is_verified" | "is_author" | "is_blocked"; value: boolean }) => {
      const { error } = await supabase.rpc("app_admin_set_flag", { target_username: username, flag, value });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { refresh(); toast.success("Обновлено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const burn = useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await supabase.rpc("app_admin_burn_fflow_global", { amount });
      if (error) throw new Error(error.message);
      return data as { burned_approx: number };
    },
    onSuccess: (r) => { refresh(); toast.success(`Сожжено ≈ ${fmt(r.burned_approx)} fFLOW`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const moderateApp = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "pending" }) => {
      const reason = action === "reject" ? "Отклонено модерацией FLOW" : undefined;
      const { error } = await supabase.rpc("app_admin_moderate_mini_app", {
        p_id: id,
        p_action: action,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { refreshApps(); toast.success("Заявка приложения обновлена"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  return (
    <div className="px-5 pb-6 pt-12">
      <button
        onClick={() => navigate({ to: "/profile" })}
        className="lrf lrf-tap mb-4 inline-flex items-center gap-1.5 !rounded-full px-3 py-1.5 text-xs"
      >
        <ArrowLeft className="size-3.5" /> Назад
      </button>

      <div className="mb-5 flex items-center gap-2">
        <Shield className="size-5 text-fiat" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-fiat">Treasury · Sovereign</p>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="lrf lrf-thick p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Users" v={stats?.users ?? 0} />
          <Stat label="Authors" v={stats?.authors ?? 0} accent="eco" />
          <Stat label="Verified" v={stats?.verified ?? 0} accent="fiat" />
          <Stat label="Blocked" v={stats?.blocked ?? 0} accent="rose" />
          <Stat label="Pending ✓" v={stats?.pending_verif ?? 0} accent="warning" />
          <Stat label="Σ rFLOW" v={stats?.total_rflow ?? 0} small />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Mini label="Σ active fFLOW" v={stats?.total_fflow_active ?? 0} />
          <Mini label="Σ pending fFLOW" v={stats?.total_fflow_pending ?? 0} />
        </div>
      </div>

      {/* Global burn */}
      <BurnPanel onBurn={(amt) => burn.mutate(amt)} pending={burn.isPending} />

      {/* Search */}
      <div className="mt-5 flex items-center gap-2">
        <label className="lrf flex flex-1 items-center gap-2 !rounded-2xl px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по username / имени"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <button
          onClick={() => setOnlyPending((v) => !v)}
          className={`lrf lrf-tap !rounded-2xl px-3 py-2.5 text-xs font-semibold ${onlyPending ? "emissive-eco text-eco" : ""}`}
        >
          Заявки
        </button>
      </div>

      {/* Mini-app applications */}
      <div className="lrf lrf-thick mt-5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <LayoutGrid className="size-4 text-eco" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-eco">FLOW Store · moderation</p>
            <h2 className="text-lg font-bold tracking-tight">Заявки приложений</h2>
          </div>
        </div>
        <label className="lrf mb-3 flex items-center gap-2 !rounded-2xl px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={appSearch}
            onChange={(e) => setAppSearch(e.target.value)}
            placeholder="Поиск по приложению / разработчику"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <div className="space-y-2">
          {appsLoading && <div className="acrylic h-20 animate-pulse" />}
          {apps?.slice(0, 8).map((app) => (
            <MiniAppRow
              key={app.id}
              app={app}
              pending={moderateApp.isPending}
              onAction={(action) => moderateApp.mutate({ id: app.id, action })}
            />
          ))}
          {apps && apps.length === 0 && (
            <div className="acrylic p-5 text-center text-sm text-muted-foreground">Заявок приложений нет</div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="mt-3 space-y-2">
        {isLoading && <div className="acrylic h-20 animate-pulse" />}
        {users?.map((u) => (
          <UserRow
            key={u.id}
            u={u}
            onMint={() => setMintFor(u)}
            onFlag={(flag, value) => setFlag.mutate({ username: u.username, flag, value })}
          />
        ))}
        {users && users.length === 0 && (
          <div className="acrylic p-6 text-center text-sm text-muted-foreground">Никого не найдено</div>
        )}
      </div>

      {mintFor && <MintSheet user={mintFor} onClose={() => setMintFor(null)} onDone={refresh} />}
    </div>
  );
}

function Stat({ label, v, accent, small }: { label: string; v: number; accent?: "eco" | "fiat" | "rose" | "warning"; small?: boolean }) {
  const cls = accent === "eco" ? "text-eco" : accent === "fiat" ? "text-fiat" : accent === "rose" ? "text-destructive" : accent === "warning" ? "text-warning" : "text-foreground";
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 tabular ${small ? "text-base" : "text-xl"} font-bold ${cls}`}>{fmt(v)}</p>
    </div>
  );
}
function Mini({ label, v }: { label: string; v: number }) {
  return (
    <div className="acrylic px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular">{fmt(v)}</p>
    </div>
  );
}

function BurnPanel({ onBurn, pending }: { onBurn: (amt: number) => void; pending: boolean }) {
  const [amt, setAmt] = useState("");
  return (
    <div className="lrf mt-3 p-4">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-destructive" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-destructive">Global burn · active fFLOW</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Пропорциональное сжигание у всех держателей сети.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="numeric"
          placeholder="Сумма"
          className="lrf flex-1 !rounded-2xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <button
          disabled={pending || !Number(amt)}
          onClick={() => onBurn(Math.floor(Number(amt)))}
          className="rounded-2xl border border-destructive/40 bg-destructive/15 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-40"
        >
          Сжечь
        </button>
      </div>
    </div>
  );
}

function UserRow({ u, onMint, onFlag }: {
  u: AdminUser;
  onMint: () => void;
  onFlag: (flag: "is_verified" | "is_author" | "is_blocked", value: boolean) => void;
}) {
  return (
    <div className={`lrf p-3 ${u.is_blocked ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/40 font-mono text-[11px] font-semibold">
          {u.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{u.display_name}</span>
            <VerifiedBadge isVerified={u.is_verified} isAuthor={u.is_author} />
            {u.is_blocked && <Ban className="size-3.5 text-destructive" />}
            {u.verification_requested && !u.is_verified && (
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning">req</span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
        <Cell label="rFLOW" v={u.rflow_balance} />
        <Cell label="active" v={u.fflow_active} accent="eco" />
        <Cell label="pending" v={u.fflow_pending} accent="warning" />
      </div>

      {u.verification_note && (
        <p className="mt-2 line-clamp-2 rounded-xl bg-white/[0.04] p-2 text-[11px] text-muted-foreground">
          “{u.verification_note}”
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill onClick={onMint} icon={Coins} label="Mint" tone="fiat" />
        <Pill onClick={() => onFlag("is_verified", !u.is_verified)} icon={BadgeCheck} label={u.is_verified ? "Снять синюю" : "Синяя ✓"} tone="fiat" />
        <Pill onClick={() => onFlag("is_author", !u.is_author)} icon={UserCheck} label={u.is_author ? "Снять автора" : "Автор ✓"} tone="eco" />
        <Pill onClick={() => onFlag("is_blocked", !u.is_blocked)} icon={Ban} label={u.is_blocked ? "Разблок." : "Блок"} tone="rose" />
      </div>
    </div>
  );
}

function Cell({ label, v, accent }: { label: string; v: number; accent?: "eco" | "warning" }) {
  const cls = accent === "eco" ? "text-eco" : accent === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-xl bg-white/[0.03] py-1.5">
      <p className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`tabular text-[11px] font-semibold ${cls}`}>{fmt(v)}</p>
    </div>
  );
}

function Pill({
  icon: Icon, label, onClick, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; tone: "fiat" | "eco" | "rose" }) {
  const cls =
    tone === "fiat" ? "border-fiat/40 text-fiat" :
    tone === "eco"  ? "border-eco/40 text-eco" :
                      "border-destructive/40 text-destructive";
  return (
    <button
      onClick={onClick}
      className={`lrf-tap inline-flex items-center gap-1 rounded-full border bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold ${cls}`}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

function MintSheet({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("100");
  const [kind, setKind] = useState<"active" | "pending">("active");

  const m = useMutation({
    mutationFn: async () => {
      const amt = Math.floor(Number(amount));
      if (!Number.isFinite(amt) || amt === 0) throw new Error("Некорректная сумма");
      const { data, error } = await supabase.rpc("app_admin_mint_fflow", {
        target_username: user.username, amount: amt, kind,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { toast.success(`Выпущено ${amount} fFLOW → @${user.username}`); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="lrf lrf-thick w-full max-w-md !rounded-t-[36px] !rounded-b-none p-6 pb-[max(env(safe-area-inset-bottom),24px)] animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-fiat">Treasury · Mint</p>
            <h3 className="mt-1 text-xl font-bold">@{user.username}</h3>
          </div>
          <button onClick={onClose} className="lrf lrf-tap grid size-10 place-items-center !rounded-2xl">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setKind("active")} className={`lrf lrf-tap !rounded-2xl py-2 text-xs font-semibold ${kind === "active" ? "emissive-eco text-eco" : ""}`}>
              active
            </button>
            <button onClick={() => setKind("pending")} className={`lrf lrf-tap !rounded-2xl py-2 text-xs font-semibold ${kind === "pending" ? "text-warning" : ""}`}>
              pending
            </button>
          </div>
          <input
            value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric"
            placeholder="Сумма (минус = списать)"
            className="lrf w-full !rounded-2xl bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button onClick={() => m.mutate()} disabled={m.isPending}
            className="mercury flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-50">
            <Sparkles className="size-4" />
            {m.isPending ? "…" : "Выпустить"}
          </button>
        </div>
      </div>
    </div>
  );
}
