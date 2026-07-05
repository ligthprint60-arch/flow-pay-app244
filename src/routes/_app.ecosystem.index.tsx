import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Rocket, X, Package, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ecosystem/")({
  head: () => ({ meta: [{ title: "Экосистема — FLOW" }] }),
  component: EcosystemPage,
});

type App = {
  id: string; owner_id: string; owner_username: string | null;
  name: string; slug: string; tagline: string | null;
  description: string | null; icon_url: string | null; app_url: string;
  category: string; status: string; installs: number;
};

const CATEGORIES = ["all", "utilities", "finance", "games", "social", "ai", "tools"] as const;

function EcosystemPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");
  const [tab, setTab] = useState<"catalog" | "mine">("catalog");
  const [submitOpen, setSubmitOpen] = useState(false);

  const { data: apps, isLoading } = useQuery({
    queryKey: ["mini_apps", tab, cat, q],
    queryFn: async (): Promise<App[]> => {
      const { data, error } = await supabase.rpc("app_list_mini_apps", {
        p_category: cat === "all" ? undefined : cat,
        p_search: q.trim() || undefined,
        p_only_mine: tab === "mine",
      });
      if (error) throw error;
      return (data ?? []) as App[];
    },
  });

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">FLOW Store</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Экосистема</h1>
        </div>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => setSubmitOpen(true)}
          className="mercury flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
          <Plus className="size-3.5" /> Опубликовать
        </motion.button>
      </div>

      <div className="lrf mb-3 flex items-center gap-2 p-2">
        <Search className="ml-1 size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск приложений…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
      </div>

      <div className="mb-4 flex gap-1 rounded-2xl bg-white/[0.04] p-1">
        {(["catalog", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>
            {tab === t && <motion.span layoutId="eco-tab" className="absolute inset-0 rounded-xl bg-white/[0.08]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="relative">{t === "catalog" ? "Каталог" : "Мои заявки"}</span>
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium capitalize transition ${cat === c ? "bg-eco/30 text-foreground emissive-eco" : "bg-white/[0.05] text-muted-foreground hover:text-foreground"}`}>
              {c === "all" ? "Все" : c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-3xl bg-white/[0.04]" />)}</div>
      ) : !apps || apps.length === 0 ? (
        <div className="acrylic p-10 text-center">
          <Package className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tab === "mine" ? "Вы ещё не опубликовали приложений." : "Ничего не найдено."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {apps.map((a, i) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}>
              <AppCard app={a} isMine={tab === "mine"} />
            </motion.li>
          ))}
        </ul>
      )}

      <AnimatePresence>{submitOpen && <SubmitSheet onClose={() => setSubmitOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function AppCard({ app, isMine }: { app: App; isMine: boolean }) {
  const statusColor = app.status === "approved" ? "text-eco" : app.status === "rejected" ? "text-destructive" : "text-warning";
  return (
    <div className="lrf p-3">
      <div className="relative z-10 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/30 emissive-eco overflow-hidden">
          {app.icon_url ? <img src={app.icon_url} alt="" className="size-full object-cover" /> : <Sparkles className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold">{app.name}</h3>
            {isMine && <span className={`font-mono text-[9px] uppercase ${statusColor}`}>· {app.status}</span>}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{app.tagline ?? `by @${app.owner_username ?? "flow"}`}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{app.installs.toLocaleString("ru-RU")} установок · {app.category}</p>
        </div>
        {app.status === "approved" && (
          <Link to="/ecosystem/$appId" params={{ appId: app.id }}
            className="mercury flex size-9 items-center justify-center rounded-full">
            <Rocket className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function SubmitSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", slug: "", tagline: "", description: "", icon_url: "", app_url: "", category: "utilities" });

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("app_submit_mini_app", {
        p_name: form.name, p_slug: form.slug, p_tagline: form.tagline,
        p_description: form.description, p_icon_url: form.icon_url,
        p_app_url: form.app_url, p_category: form.category,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Заявка отправлена на модерацию");
      qc.invalidateQueries({ queryKey: ["mini_apps"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="lrf lrf-thick w-full max-w-md !rounded-t-[32px] !rounded-b-none p-5 pb-[calc(env(safe-area-inset-bottom)+120px)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Publish app</p>
            <h3 className="mt-1 text-xl font-bold">Заявка в FLOW Store</h3>
          </div>
          <button onClick={onClose} className="lrf lrf-tap grid size-10 place-items-center !rounded-2xl"><X className="size-4" /></button>
        </div>
        <div className="sheet-scroll space-y-2">
          <Field label="Название"    value={form.name}        onChange={(v) => setForm({ ...form, name: v })}        placeholder="Например: FLUX Terminal" />
          <Field label="Slug (URL)"  value={form.slug}        onChange={(v) => setForm({ ...form, slug: v })}        placeholder="flux-terminal" />
          <Field label="Слоган"       value={form.tagline}     onChange={(v) => setForm({ ...form, tagline: v })}     placeholder="Быстрый анализ рынка" />
          <Field label="Описание"     value={form.description} onChange={(v) => setForm({ ...form, description: v })} textarea placeholder="Что делает приложение…" />
          <Field label="Иконка URL"   value={form.icon_url}    onChange={(v) => setForm({ ...form, icon_url: v })}    placeholder="https://…/icon.png" />
          <Field label="URL приложения" value={form.app_url}   onChange={(v) => setForm({ ...form, app_url: v })}     placeholder="https://your.app" />
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Категория</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-2xl bg-white/[0.05] px-3 py-2.5 text-sm outline-none">
              {CATEGORIES.filter(c => c !== "all").map(c => <option key={c} value={c} className="bg-background">{c}</option>)}
            </select>
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">
            Приложение появится в каталоге после одобрения модератором. Пользователи могут выдать ему доступ к fFLOW-кошельку — 70% списаний идут вам, 30% сгорает.
          </p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => submit.mutate()}
            disabled={submit.isPending || !form.name || !form.app_url}
            className="mercury mt-2 h-11 w-full rounded-2xl text-sm font-semibold disabled:opacity-40">
            {submit.isPending ? "Отправка…" : "Отправить заявку"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder}
          className="w-full resize-none rounded-2xl bg-white/[0.05] px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-2xl bg-white/[0.05] px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50" />
      )}
    </div>
  );
}
