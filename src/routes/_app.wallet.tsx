import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmt, fmtUZS } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, QrCode, Sparkles, Zap, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/wallet")({
  head: () => ({ meta: [{ title: "Кошелёк — FLOW" }] }),
  component: WalletPage,
});

type Wallet = {
  rflow_balance: number;
  fflow_pending: number;
  fflow_active: number;
};
type Tx = {
  id: string;
  type: string;
  rflow_delta: number;
  fflow_pending_delta: number;
  fflow_active_delta: number;
  counterparty: string | null;
  note: string | null;
  created_at: string;
};

const FRAGMENT_TIERS: { id: string; pending: number; cost: number; label: string; badge?: string }[] = [
  { id: "x1", pending: 100, cost: 1000, label: "Mode ×1" },
  { id: "x2", pending: 200, cost: 1800, label: "Mode ×2", badge: "−10%" },
  { id: "x5", pending: 500, cost: 4000, label: "Mode ×5", badge: "−20%" },
];

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Wallet> => {
      const { data, error } = await supabase
        .from("wallets")
        .select("rflow_balance,fflow_pending,fflow_active")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { rflow_balance: 0, fflow_pending: 0, fflow_active: 0 };
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Tx[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const payQR = useMutation({
    mutationFn: async () => {
      if (!wallet || wallet.rflow_balance < 25000) throw new Error("Недостаточно rFLOW");
      const merchants = ["Coffee Lab", "Korzinka", "Yandex Go", "Wolt", "Apple"];
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const amount = [12000, 25000, 38000, 45000][Math.floor(Math.random() * 4)];
      const reward = Math.floor(amount * 0.02);

      await supabase.from("wallets").update({
        rflow_balance: wallet.rflow_balance - amount,
        fflow_pending: wallet.fflow_pending + reward,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user!.id);

      await supabase.from("transactions").insert([
        { user_id: user!.id, type: "payment", rflow_delta: -amount, counterparty: merchant, note: "Оплата QR" },
        { user_id: user!.id, type: "spend_reward", fflow_pending_delta: reward, counterparty: "FLOW", note: `Cashback 2% от ${merchant}` },
      ]);
      return { merchant, amount, reward };
    },
    onSuccess: (r) => {
      toast.success(`Оплачено ${fmtUZS(r.amount)} → ${r.merchant}`, { description: `+${r.reward} pending fFLOW` });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fragment = useMutation({
    mutationFn: async (tier: typeof FRAGMENT_TIERS[number]) => {
      if (!wallet) throw new Error("Кошелёк не загружен");
      if (wallet.fflow_pending < tier.pending) throw new Error("Недостаточно pending fFLOW");
      if (wallet.rflow_balance < tier.cost) throw new Error("Недостаточно rFLOW для комиссии");

      await supabase.from("wallets").update({
        rflow_balance: wallet.rflow_balance - tier.cost,
        fflow_pending: wallet.fflow_pending - tier.pending,
        fflow_active: wallet.fflow_active + tier.pending,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user!.id);

      await supabase.from("transactions").insert({
        user_id: user!.id,
        type: "fragmentation",
        rflow_delta: -tier.cost,
        fflow_pending_delta: -tier.pending,
        fflow_active_delta: tier.pending,
        counterparty: "FLOW Engine",
        note: `Фрагментация ${tier.label}`,
      });
      return tier;
    },
    onSuccess: (t) => {
      toast.success(`+${t.pending} fFLOW активировано`, { description: `Комиссия: ${fmtUZS(t.cost)}` });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setSheet(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pb-6 pt-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Кошелёк</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">FLOW</h1>
        </div>
        <button className="size-10 rounded-full border border-border bg-surface grid place-items-center">
          <QrCode className="size-4" />
        </button>
      </div>

      {/* Main balance card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6">
        <div className="absolute -right-12 -top-12 size-40 rounded-full bg-fiat/15 blur-3xl" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Available Liquidity · rFLOW</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular tracking-tight">{fmt(wallet?.rflow_balance ?? 0)}</span>
          <span className="text-sm text-muted-foreground">UZS</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">≈ ${((wallet?.rflow_balance ?? 0) / 12500).toFixed(2)} USD</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => payQR.mutate()}
            disabled={payQR.isPending}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-50"
          >
            <QrCode className="size-4" /> Pay QR
          </button>
          <button className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 text-sm font-semibold">
            <ArrowUpRight className="size-4" /> Send
          </button>
        </div>
      </div>

      {/* Dual token */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TokenCard label="Active" value={wallet?.fflow_active ?? 0} accent="fflow" />
        <TokenCard label="Pending" value={wallet?.fflow_pending ?? 0} accent="pending" />
      </div>

      {/* Fragmentation CTA */}
      <button
        onClick={() => setSheet(true)}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed border-eco/40 bg-eco/5 p-4 text-left transition-colors hover:bg-eco/10"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-eco/15">
            <Zap className="size-4 text-eco" />
          </div>
          <div>
            <p className="text-sm font-semibold">Fragmentation Engine</p>
            <p className="text-xs text-muted-foreground">Превратить pending → active</p>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>

      {/* Transactions */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Активность</h2>
          <span className="font-mono text-[10px] text-muted-foreground">{txs?.length ?? 0}</span>
        </div>

        {(!txs || txs.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Sparkles className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Здесь появятся ваши транзакции.</p>
            <p className="mt-1 text-xs text-muted-foreground">Попробуйте «Pay QR» выше.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {txs.map((t) => <TxRow key={t.id} tx={t} />)}
          </ul>
        )}
      </div>

      {/* Fragmentation sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSheet(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-border bg-surface p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Fragmentation Engine</p>
                <h3 className="mt-1 text-xl font-bold">Активируйте fFLOW</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pending: <span className="text-foreground tabular">{fmt(wallet?.fflow_pending ?? 0)}</span>
                </p>
              </div>
              <button onClick={() => setSheet(false)} className="size-9 rounded-full border border-border grid place-items-center">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              {FRAGMENT_TIERS.map((t) => {
                const disabled = (wallet?.fflow_pending ?? 0) < t.pending || (wallet?.rflow_balance ?? 0) < t.cost;
                return (
                  <button
                    key={t.id}
                    disabled={disabled || fragment.isPending}
                    onClick={() => fragment.mutate(t)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface-2 p-4 text-left transition-all hover:border-eco/50 disabled:opacity-40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-eco">{t.label}</span>
                        {t.badge && <span className="rounded-full bg-eco/15 px-2 py-0.5 font-mono text-[9px] text-eco">{t.badge}</span>}
                      </div>
                      <p className="mt-1 text-base font-semibold tabular">+{t.pending} fFLOW</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Комиссия</p>
                      <p className="mt-1 text-sm font-medium tabular">{fmtUZS(t.cost)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Комиссия списывается в rFLOW. Active fFLOW тратится на донаты, курсы и кастомизацию.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenCard({ label, value, accent }: { label: string; value: number; accent: "fflow" | "pending" }) {
  const colorCls = accent === "fflow" ? "bg-eco" : "bg-warning";
  const textCls = accent === "fflow" ? "text-eco" : "text-warning";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <div className={`size-1.5 rounded-full ${colorCls}`} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label} · fFLOW</span>
      </div>
      <p className={`mt-3 text-2xl font-bold tabular ${textCls}`}>{fmt(value)}</p>
    </div>
  );
}

function TxRow({ tx }: { tx: Tx }) {
  const positive = tx.rflow_delta > 0 || tx.fflow_active_delta > 0 || tx.fflow_pending_delta > 0;
  const Icon = positive ? ArrowDownLeft : ArrowUpRight;
  const main =
    tx.rflow_delta !== 0
      ? `${tx.rflow_delta > 0 ? "+" : ""}${fmtUZS(tx.rflow_delta)}`
      : tx.fflow_active_delta !== 0
      ? `${tx.fflow_active_delta > 0 ? "+" : ""}${fmt(tx.fflow_active_delta)} fFLOW`
      : `${tx.fflow_pending_delta > 0 ? "+" : ""}${fmt(tx.fflow_pending_delta)} pending`;
  const date = new Date(tx.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return (
    <li className="flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-surface/50">
      <div className={`grid size-10 place-items-center rounded-xl ${positive ? "bg-success/15 text-success" : "bg-surface text-muted-foreground"}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tx.counterparty ?? tx.type}</p>
        <p className="truncate text-xs text-muted-foreground">{tx.note ?? tx.type} · {date}</p>
      </div>
      <p className={`tabular text-sm font-semibold ${positive ? "text-success" : "text-foreground"}`}>{main}</p>
    </li>
  );
}
