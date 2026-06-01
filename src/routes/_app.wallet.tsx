import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile, getActiveSkinClass } from "@/lib/theme";
import { fmt, fmtUZS } from "@/lib/format";
import {
  ArrowDownLeft, ArrowUpRight, QrCode, Sparkles, Zap, X, ChevronRight,
  Send, Plus, CreditCard, AtSign,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/wallet")({
  head: () => ({ meta: [{ title: "Кошелёк — FLOW" }] }),
  component: WalletPage,
});

type Wallet = { rflow_balance: number; fflow_pending: number; fflow_active: number };
type Tx = {
  id: string; type: string;
  rflow_delta: number; fflow_pending_delta: number; fflow_active_delta: number;
  counterparty: string | null; note: string | null; created_at: string;
};

type Tier = { id: string; pending: number; cost: number; label: string; badge?: string };
const FRAGMENT_TIERS: Tier[] = [
  { id: "x1", pending: 100, cost: 1000, label: "Mode ×1" },
  { id: "x2", pending: 200, cost: 1800, label: "Mode ×2", badge: "−10%" },
  { id: "x5", pending: 500, cost: 4000, label: "Mode ×5", badge: "−20%" },
];

type Sheet = null | "fragment" | "p2p" | "topup";

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>(null);
  const { data: profile } = useProfile();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Wallet> => {
      const { data, error } = await supabase
        .from("wallets")
        .select("rflow_balance,fflow_pending,fflow_active")
        .eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data ?? { rflow_balance: 0, fflow_pending: 0, fflow_active: 0 };
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Tx[]> => {
      const { data, error } = await supabase
        .from("transactions").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

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
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skinClass = getActiveSkinClass(profile?.card_skin);

  return (
    <div className="px-5 pb-6 pt-12">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Spatial Wallet</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight chromatic">FLOW</h1>
        </div>
        <button className="lrf lrf-tap grid size-11 place-items-center !rounded-2xl">
          <QrCode className="size-4" />
        </button>
      </div>

      {/* Main balance lens — compact */}
      <div className={`lrf lrf-thick relative p-5 ${skinClass}`}>
        <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-fiat/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 size-28 rounded-full bg-eco/20 blur-3xl" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Available · rFLOW</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-[36px] font-bold leading-none tabular tracking-tight">{fmt(wallet?.rflow_balance ?? 0)}</span>
          <span className="text-xs text-muted-foreground">UZS</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">≈ ${((wallet?.rflow_balance ?? 0) / 12500).toFixed(2)}</p>
        <div className="mt-2 h-px overflow-hidden rounded-full">
          <div className="h-full w-full shimmer-line" />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <ActionBtn icon={QrCode} label="Pay" onClick={() => payQR.mutate()} loading={payQR.isPending} />
          <ActionBtn icon={Send}     label="P2P"    onClick={() => setSheet("p2p")} />
          <ActionBtn icon={Plus}     label="Top-up" onClick={() => setSheet("topup")} />
          <ActionBtn icon={Zap}      label="Fragm." onClick={() => setSheet("fragment")} accent />
        </div>
      </div>


      {/* Dual token */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TokenCard label="Active" value={wallet?.fflow_active ?? 0} accent="fflow" />
        <TokenCard label="Pending" value={wallet?.fflow_pending ?? 0} accent="pending" />
      </div>

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
          </div>
        ) : (
          <ul className="acrylic divide-y divide-white/5 overflow-hidden">
            {txs.map((t) => <TxRow key={t.id} tx={t} />)}
          </ul>
        )}
      </div>

      {sheet === "fragment" && <FragmentSheet wallet={wallet} onClose={() => setSheet(null)} onDone={refresh} />}
      {sheet === "p2p" && <P2PSheet wallet={wallet} onClose={() => setSheet(null)} onDone={refresh} />}
      {sheet === "topup" && <TopupSheet wallet={wallet} onClose={() => setSheet(null)} onDone={refresh} />}
    </div>
  );
}

/* ---------------- Components ---------------- */

function ActionBtn({
  icon: Icon, label, onClick, loading, accent,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; loading?: boolean; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`lrf lrf-tap flex flex-col items-center gap-1 !rounded-2xl py-3 text-[11px] font-semibold disabled:opacity-50 ${accent ? "emissive-eco" : ""}`}
    >
      <Icon className={`size-4 ${accent ? "text-eco" : ""}`} />
      <span>{label}</span>
    </button>
  );
}

function TokenCard({ label, value, accent }: { label: string; value: number; accent: "fflow" | "pending" }) {
  const dotCls = accent === "fflow" ? "bg-eco emissive-eco" : "bg-warning";
  const textCls = accent === "fflow" ? "text-eco" : "text-warning";
  return (
    <div className="lrf relative p-4">
      <div className="flex items-center gap-2">
        <div className={`size-1.5 rounded-full ${dotCls}`} />
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
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
      <div className={`grid size-10 place-items-center rounded-2xl ${positive ? "bg-success/15 text-success emissive-eco" : "bg-white/5 text-muted-foreground"}`}>
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

/* ---------------- Sheets ---------------- */

function SheetShell({ children, onClose, title, badge }: { children: React.ReactNode; onClose: () => void; title: string; badge: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div
        className="lrf lrf-thick w-full max-w-md !rounded-t-[32px] !rounded-b-none p-5 pb-[max(env(safe-area-inset-bottom),20px)] animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-eco">{badge}</p>
            <h3 className="mt-1 text-xl font-bold">{title}</h3>
          </div>
          <button onClick={onClose} className="lrf lrf-tap grid size-10 place-items-center !rounded-2xl">
            <X className="size-4" />
          </button>
        </div>
        <div className="sheet-scroll -mx-1 px-1">
          {children}
        </div>
      </div>
    </div>
  );
}


function FragmentSheet({ wallet, onClose, onDone }: { wallet: Wallet | undefined; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const m = useMutation({
    mutationFn: async (tier: Tier) => {
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
        user_id: user!.id, type: "fragmentation",
        rflow_delta: -tier.cost, fflow_pending_delta: -tier.pending, fflow_active_delta: tier.pending,
        counterparty: "FLOW Engine", note: `Фрагментация ${tier.label}`,
      });
      return tier;
    },
    onSuccess: (t) => {
      toast.success(`+${t.pending} fFLOW активировано`, { description: `Комиссия: ${fmtUZS(t.cost)}` });
      onDone(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SheetShell onClose={onClose} title="Активируйте fFLOW" badge="Fragmentation Engine">
      <p className="mb-3 text-xs text-muted-foreground">
        Pending: <span className="text-foreground tabular">{fmt(wallet?.fflow_pending ?? 0)}</span>
      </p>
      <div className="space-y-2">
        {FRAGMENT_TIERS.map((t) => {
          const disabled = (wallet?.fflow_pending ?? 0) < t.pending || (wallet?.rflow_balance ?? 0) < t.cost;
          return (
            <button
              key={t.id} disabled={disabled || m.isPending}
              onClick={() => m.mutate(t)}
              className="lrf lrf-tap flex w-full items-center justify-between p-4 text-left disabled:opacity-40"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-eco">{t.label}</span>
                  {t.badge && <span className="rounded-full bg-eco/20 px-2 py-0.5 font-mono text-[9px] text-eco">{t.badge}</span>}
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
    </SheetShell>
  );
}

function P2PSheet({ wallet, onClose, onDone }: { wallet: Wallet | undefined; onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const u = username.trim().replace(/^@/, "");
      const amt = Math.floor(Number(amount));
      if (u.length < 3) throw new Error("Введите корректный @username");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Сумма должна быть > 0");
      if (wallet && amt > wallet.rflow_balance) throw new Error("Недостаточно rFLOW");
      const { data, error } = await supabase.rpc("app_p2p_transfer", {
        recipient_username: u, amount: amt, memo: memo.trim() || undefined,
      });
      if (error) {
        const map: Record<string, string> = {
          recipient_not_found: "Пользователь не найден",
          self_transfer_forbidden: "Нельзя отправить себе",
          insufficient_funds: "Недостаточно rFLOW",
          invalid_amount: "Некорректная сумма",
        };
        throw new Error(map[error.message] ?? error.message);
      }
      return data as { recipient_username: string; recipient_name: string; amount: number };
    },
    onSuccess: (r) => {
      toast.success(`Отправлено ${fmtUZS(r.amount)}`, { description: `→ ${r.recipient_name} (@${r.recipient_username})` });
      onDone(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SheetShell onClose={onClose} title="P2P перевод" badge="rFLOW · по @нику">
      <div className="space-y-3">
        <Field icon={AtSign} value={username} onChange={setUsername} placeholder="username получателя" />
        <Field            value={amount} onChange={setAmount} placeholder="Сумма в UZS (rFLOW)" inputMode="numeric" />
        <Field            value={memo} onChange={setMemo} placeholder="Комментарий (необязательно)" maxLength={80} />
        <p className="px-1 text-[11px] text-muted-foreground">
          Доступно: <span className="text-foreground tabular">{fmtUZS(wallet?.rflow_balance ?? 0)}</span>
        </p>
        <button
          onClick={() => m.mutate()} disabled={m.isPending}
          className="mercury flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-50"
        >
          <Send className="size-4" />
          {m.isPending ? "Отправляю…" : "Отправить"}
        </button>
      </div>
    </SheetShell>
  );
}

function TopupSheet({ wallet, onClose, onDone }: { wallet: Wallet | undefined; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("100000");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const presets = [50000, 100000, 250000, 500000];

  const m = useMutation({
    mutationFn: async () => {
      const amt = Math.floor(Number(amount));
      if (!Number.isFinite(amt) || amt < 1000) throw new Error("Минимум 1 000 UZS");
      const digits = card.replace(/\s/g, "");
      if (digits.length < 12) throw new Error("Некорректный номер карты");
      // simulated card auth latency
      await new Promise((r) => setTimeout(r, 900));
      await supabase.from("wallets").update({
        rflow_balance: (wallet?.rflow_balance ?? 0) + amt,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user!.id);
      await supabase.from("transactions").insert({
        user_id: user!.id, type: "transfer",
        rflow_delta: amt, counterparty: `•••• ${digits.slice(-4)}`,
        note: "Пополнение с карты → rFLOW",
      });
      return amt;
    },
    onSuccess: (amt) => {
      toast.success(`Зачислено ${fmtUZS(amt)}`, { description: "Карта → rFLOW (1:1)" });
      onDone(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SheetShell onClose={onClose} title="Пополнить rFLOW" badge="Card → rFLOW · 1:1">
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p} onClick={() => setAmount(String(p))}
              className={`lrf lrf-tap !rounded-2xl py-2 text-xs font-semibold ${String(p) === amount ? "emissive-eco text-eco" : ""}`}
            >
              {p / 1000}k
            </button>
          ))}
        </div>
        <Field value={amount} onChange={setAmount} placeholder="Сумма UZS" inputMode="numeric" />
        <Field icon={CreditCard} value={card} onChange={(v) => setCard(formatCard(v))} placeholder="Номер карты" inputMode="numeric" maxLength={19} />
        <p className="px-1 text-[11px] text-muted-foreground">
          Демо-карта: 4242 4242 4242 4242. Реальные деньги не списываются.
        </p>
        <button
          onClick={() => m.mutate()} disabled={m.isPending}
          className="mercury flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-50"
        >
          <Plus className="size-4" />
          {m.isPending ? "Авторизация…" : `Пополнить на ${fmtUZS(Math.floor(Number(amount) || 0))}`}
        </button>
      </div>
    </SheetShell>
  );
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function Field({
  icon: Icon, value, onChange, placeholder, inputMode, maxLength,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  value: string; onChange: (v: string) => void; placeholder: string;
  inputMode?: "numeric" | "text"; maxLength?: number;
}) {
  return (
    <label className="lrf flex items-center gap-2 !rounded-2xl px-4 py-3">
      {Icon && <Icon className="size-4 text-muted-foreground" />}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
    </label>
  );
}
// Force chevron import retained for tree-shake friendliness
export const _icon = ChevronRight;
