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
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Spatial Wallet</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight chromatic">FLOW</h1>
        </div>
        <button className="lrf grid size-11 place-items-center !rounded-2xl">
          <QrCode className="relative z-10 size-4" />
        </button>
      </div>

      {/* Main balance — Thick LRF lens */}
      <div className="lrf lrf-thick relative p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-fiat/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 size-40 rounded-full bg-eco/20 blur-3xl" />
        <div className="relative z-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Available Liquidity · rFLOW</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-[44px] font-bold leading-none tabular tracking-tight">{fmt(wallet?.rflow_balance ?? 0)}</span>
            <span className="text-sm text-muted-foreground">UZS</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">≈ ${((wallet?.rflow_balance ?? 0) / 12500).toFixed(2)} USD</p>
          <div className="mt-2 h-px overflow-hidden rounded-full">
            <div className="h-full w-full shimmer-line" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={() => payQR.mutate()}
              disabled={payQR.isPending}
              className="mercury flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-50"
            >
              <QrCode className="size-4" /> Pay QR
            </button>
            <button className="lrf flex h-12 items-center justify-center gap-2 !rounded-2xl text-sm font-semibold">
              <ArrowUpRight className="relative z-10 size-4" />
              <span className="relative z-10">Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dual token lenses */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TokenCard label="Active" value={wallet?.fflow_active ?? 0} accent="fflow" />
        <TokenCard label="Pending" value={wallet?.fflow_pending ?? 0} accent="pending" />
      </div>

      {/* Fragmentation CTA */}
      <button
        onClick={() => setSheet(true)}
        className="lrf mt-3 flex w-full items-center justify-between p-4 text-left transition-transform active:scale-[0.99]"
      >
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-eco/20 emissive-eco">
            <Zap className="size-4 text-eco" />
          </div>
          <div>
            <p className="text-sm font-semibold">Fragmentation Engine</p>
            <p className="text-xs text-muted-foreground">Превратить pending → active</p>
          </div>
        </div>
        <ChevronRight className="relative z-10 size-4 text-muted-foreground" />
      </button>

      {/* Transactions */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Активность</h2>
          <span className="font-mono text-[10px] text-muted-foreground">{txs?.length ?? 0}</span>
        </div>

        {(!txs || txs.length === 0) ? (
          <div className="acrylic p-8 text-center">
            <Sparkles className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Здесь появятся ваши транзакции.</p>
            <p className="mt-1 text-xs text-muted-foreground">Попробуйте «Pay QR» выше.</p>
          </div>
        ) : (
          <ul className="acrylic divide-y divide-white/5 overflow-hidden">
            {txs.map((t) => <TxRow key={t.id} tx={t} />)}
          </ul>
        )}
      </div>

      {/* Fragmentation sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-md" onClick={() => setSheet(false)}>
          <div
            className="lrf lrf-thick w-full max-w-md !rounded-t-[36px] !rounded-b-none p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Fragmentation Engine</p>
                  <h3 className="mt-1 text-xl font-bold">Активируйте fFLOW</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pending: <span className="text-foreground tabular">{fmt(wallet?.fflow_pending ?? 0)}</span>
                  </p>
                </div>
                <button onClick={() => setSheet(false)} className="lrf grid size-10 place-items-center !rounded-2xl">
                  <X className="relative z-10 size-4" />
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
                      className="lrf flex w-full items-center justify-between p-4 text-left transition-all active:scale-[0.99] disabled:opacity-40"
                    >
                      <div className="relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-eco">{t.label}</span>
                          {t.badge && <span className="rounded-full bg-eco/20 px-2 py-0.5 font-mono text-[9px] text-eco">{t.badge}</span>}
                        </div>
                        <p className="mt-1 text-base font-semibold tabular">+{t.pending} fFLOW</p>
                      </div>
                      <div className="relative z-10 text-right">
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
        </div>
      )}
    </div>
  );
}

function TokenCard({ label, value, accent }: { label: string; value: number; accent: "fflow" | "pending" }) {
  const dotCls = accent === "fflow" ? "bg-eco emissive-eco" : "bg-warning";
  const textCls = accent === "fflow" ? "text-eco" : "text-warning";
  return (
    <div className="lrf relative p-4">
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <div className={`size-1.5 rounded-full ${dotCls}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label} · fFLOW</span>
        </div>
        <p className={`mt-3 text-2xl font-bold tabular ${textCls}`}>{fmt(value)}</p>
      </div>
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
