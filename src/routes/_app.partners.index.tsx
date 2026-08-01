import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, X, Users, Handshake, ShieldCheck, PenLine, Eraser } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia, pickFile } from "@/lib/upload";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/partners/")({
  head: () => ({
    meta: [
      { title: "Партнёрства — FLOW PAS" },
      { name: "description", content: "Цифровые партнёрства FLOW PAS: создавайте организации, подписывайте соглашения, ведите проекты и финансы." },
      { property: "og:title", content: "Партнёрства — FLOW PAS" },
      { property: "og:description", content: "Экосистема цифровых организаций: соглашения, проекты, финансы и репутация." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

export type PartnerRow = {
  id: string; slug: string; name: string; logo_url: string | null;
  description: string | null; field: string; is_open: boolean;
  reputation: number; followers_count: number; members_count: number;
  founded_at: string; my_role: string | null;
};

const FIELDS = ["general", "startup", "studio", "agency", "research", "creative", "family"] as const;

function PartnersPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["partnerships", tab, q],
    queryFn: async (): Promise<PartnerRow[]> => {
      const { data, error } = await supabase.rpc("app_list_partnerships", {
        p_search: q.trim() || undefined,
        p_only_mine: tab === "mine",
      });
      if (error) throw error;
      return (data ?? []) as PartnerRow[];
    },
  });

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">FLOW PAS</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Партнёрства</h1>
        </div>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => setCreateOpen(true)}
          className="mercury flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
          <Plus className="size-3.5" /> Создать
        </motion.button>
      </div>

      <div className="lrf mb-3 flex items-center gap-2 p-2">
        <Search className="ml-1 size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск партнёрств…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
      </div>

      <div className="mb-4 flex gap-1 rounded-2xl bg-white/[0.04] p-1">
        {(["all", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative flex-1 rounded-xl px-3 py-2 text-xs font-medium transition ${tab === t ? "text-foreground" : "text-muted-foreground"}`}>
            {tab === t && <motion.span layoutId="pas-tab" className="absolute inset-0 rounded-xl bg-white/[0.08]" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="relative">{t === "all" ? "Все" : "Мои"}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-3xl bg-white/[0.04]" />)}</div>
      ) : !data || data.length === 0 ? (
        <div className="acrylic p-10 text-center">
          <Handshake className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === "mine" ? "Вы пока не состоите в партнёрствах." : "Ничего не найдено."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <Link to="/partners/$slug" params={{ slug: p.slug }} className="lrf lrf-tap flex items-center gap-3 p-3">
                {p.logo_url
                  ? <img src={p.logo_url} alt={p.name} className="size-11 shrink-0 rounded-2xl object-cover" />
                  : <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/25 text-sm font-bold">{p.name.slice(0, 2).toUpperCase()}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {!p.is_open && <ShieldCheck className="size-3 shrink-0 text-muted-foreground" />}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{p.description || p.field}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                    <Users className="size-3" />{p.members_count}
                  </p>
                  <p className="text-[10px] font-mono text-eco">REP {p.reputation}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>{createOpen && <CreateDialog onClose={() => setCreateOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "", description: "", goals: "", field: "startup", language: "ru",
    is_open: true, decision_rule: "majority", revenue_model: "equal", logo_url: "",
  });
  const [fullName, setFullName] = useState("");
  const sigRef = useRef<HTMLCanvasElement>(null);
  const [hasSig, setHasSig] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const draw = (e: React.PointerEvent<HTMLCanvasElement>, start: boolean) => {
    const cv = sigRef.current; if (!cv) return;
    if (!start && e.buttons !== 1) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * (cv.width / r.width);
    const y = (e.clientY - r.top) * (cv.height / r.height);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#eafff5";
    if (start) { ctx.beginPath(); ctx.moveTo(x, y); } else { ctx.lineTo(x, y); ctx.stroke(); setHasSig(true); }
  };
  const clearSig = () => {
    const cv = sigRef.current; if (!cv) return;
    cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
    setHasSig(false);
  };

  const create = useMutation({
    mutationFn: async () => {
      const sig = (hasSig ? sigRef.current?.toDataURL("image/png") : "") ?? "";
      const { data, error } = await supabase.rpc("app_create_partnership", {
        p_name: form.name, p_description: form.description, p_goals: form.goals,
        p_field: form.field, p_language: form.language, p_is_open: form.is_open,
        p_decision_rule: form.decision_rule, p_revenue_model: form.revenue_model,
        p_logo_url: form.logo_url, p_full_name: fullName, p_signature: sig,
      });
      if (error) throw error;
      return data as { slug: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnerships"] });
      toast.success("Партнёрство создано, соглашение подписано");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = async () => {
    if (!user) return;
    const f = await pickFile("image/*"); if (!f) return;
    try { set("logo_url", await uploadMedia(user.id, "avatar", f)); toast.success("Логотип загружен"); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 14 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="lrf lrf-thick sheet-scroll max-h-[86svh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{step === 1 ? "Новое партнёрство" : "Цифровое соглашение"}</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-white/[0.06]"><X className="size-4" /></button>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <button onClick={uploadLogo} className="lrf flex w-full items-center gap-3 p-3 text-left">
              {form.logo_url
                ? <img src={form.logo_url} alt="Логотип партнёрства" className="size-10 rounded-xl object-cover" />
                : <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06]"><Plus className="size-4" /></div>}
              <span className="text-xs text-muted-foreground">Логотип из галереи</span>
            </button>
            <Field label="Название" value={form.name} onChange={(v) => set("name", v)} />
            <Field label="Описание" value={form.description} onChange={(v) => set("description", v)} area />
            <Field label="Цели" value={form.goals} onChange={(v) => set("goals", v)} area />
            <Row label="Направление">
              <Select value={form.field} onChange={(v) => set("field", v)} options={FIELDS as unknown as string[]} />
            </Row>
            <Row label="Язык">
              <Select value={form.language} onChange={(v) => set("language", v)} options={["ru", "en", "uz"]} />
            </Row>
            <Row label="Участие">
              <Select value={form.is_open ? "open" : "closed"} onChange={(v) => set("is_open", v === "open")}
                options={["open", "closed"]} labels={{ open: "Открытое", closed: "Закрытое" }} />
            </Row>
            <Row label="Решения">
              <Select value={form.decision_rule} onChange={(v) => set("decision_rule", v)}
                options={["majority", "unanimous", "founder"]}
                labels={{ majority: "Большинством", unanimous: "Единогласно", founder: "Основатель" }} />
            </Row>
            <Row label="Доходы">
              <Select value={form.revenue_model} onChange={(v) => set("revenue_model", v)}
                options={["equal", "shares", "contribution"]}
                labels={{ equal: "Поровну", shares: "По долям", contribution: "По вкладу" }} />
            </Row>
            <button disabled={form.name.trim().length < 2} onClick={() => setStep(2)}
              className="mercury h-11 w-full rounded-2xl text-sm font-semibold disabled:opacity-40">
              Далее — подписание
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="lrf max-h-40 overflow-y-auto p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">СОГЛАШЕНИЕ О ЦИФРОВОМ ПАРТНЁРСТВЕ</p>
              <p>Название: {form.name}</p>
              <p>Направление: {form.field}</p>
              <p>Правила решений: {form.decision_rule}</p>
              <p>Распределение доходов: {form.revenue_model}</p>
              <p>Участие: {form.is_open ? "открытое" : "закрытое"}</p>
              <p className="mt-2">Подписывая настоящее соглашение, участник подтверждает достоверность указанных данных.
                Документу присваивается уникальный номер, фиксируются дата и время подписания, целостность защищается цифровым хэшем.</p>
            </div>
            <Field label="ФИО подписанта" value={fullName} onChange={setFullName} />
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <PenLine className="size-3" /> Рукописная подпись
              </p>
              <canvas ref={sigRef} width={520} height={180}
                onPointerDown={(e) => draw(e, true)} onPointerMove={(e) => draw(e, false)}
                className="lrf h-28 w-full touch-none" />
              <button onClick={clearSig} className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Eraser className="size-3" /> Очистить
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="lrf h-11 flex-1 rounded-2xl text-sm">Назад</button>
              <button disabled={fullName.trim().length < 3 || create.isPending}
                onClick={() => create.mutate()}
                className="mercury h-11 flex-[2] rounded-2xl text-sm font-semibold disabled:opacity-40">
                {create.isPending ? "Подписание…" : "Подписать и создать"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, onChange, area }: { label: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className="lrf w-full resize-none bg-transparent p-3 text-sm outline-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="lrf h-11 w-full bg-transparent px-3 text-sm outline-none" />
      )}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="lrf h-9 bg-transparent px-2 text-xs outline-none [&>option]:bg-background">
      {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}
