import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, ShieldCheck, ShieldOff, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ecosystem/$appId")({
  head: () => ({ meta: [{ title: "App — FLOW" }] }),
  component: EcosystemAppPage,
});

function EcosystemAppPage() {
  const { appId } = Route.useParams();
  const qc = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [running, setRunning] = useState(false);

  const { data: app } = useQuery({
    queryKey: ["mini_app", appId],
    queryFn: async () => {
      const { data, error } = await supabase.from("mini_apps").select("*").eq("id", appId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: perm } = useQuery({
    queryKey: ["mini_app_perm", appId],
    queryFn: async () => {
      const { data } = await supabase.from("mini_app_permissions")
        .select("wallet_access").eq("app_id", appId).maybeSingle();
      return data;
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_ecosystem_grant", { p_app_id: appId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Доступ выдан"); qc.invalidateQueries({ queryKey: ["mini_app_perm", appId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_ecosystem_revoke", { p_app_id: appId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Доступ отозван"); qc.invalidateQueries({ queryKey: ["mini_app_perm", appId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // postMessage bridge — мини-приложение может запросить контекст и списание
  useEffect(() => {
    if (!running) return;
    const onMsg = async (ev: MessageEvent) => {
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
      const msg = ev.data as { type?: string; id?: string; amount?: number; memo?: string };
      if (!msg?.type) return;
      const reply = (payload: unknown) =>
        iframeRef.current?.contentWindow?.postMessage({ id: msg.id, ...(payload as object) }, "*");

      if (msg.type === "flow:context") {
        const { data, error } = await supabase.rpc("app_ecosystem_get_context", { p_app_id: appId });
        if (error) return reply({ ok: false, error: error.message });
        reply({ ok: true, context: data });
      }
      if (msg.type === "flow:charge") {
        if (!msg.amount || msg.amount <= 0) return reply({ ok: false, error: "invalid_amount" });
        const { data, error } = await supabase.rpc("app_ecosystem_charge", {
          p_app_id: appId, p_amount: msg.amount, p_memo: msg.memo ?? null,
        });
        if (error) return reply({ ok: false, error: error.message });
        toast.success(`−${msg.amount} fFLOW · ${app?.name ?? "app"}`);
        reply({ ok: true, result: data });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [running, appId, app?.name]);

  if (!app) {
    return <div className="px-5 pt-16 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const hasAccess = !!perm?.wallet_access;

  return (
    <div className="px-4 pb-6 pt-12">
      <Link to="/ecosystem" className="lrf lrf-tap mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
        <ArrowLeft className="size-3.5" /> Каталог
      </Link>

      <div className="lrf p-4">
        <div className="relative z-10 flex items-start gap-3">
          <div className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/30 emissive-eco">
            {app.icon_url ? <img src={app.icon_url} alt="" className="size-full object-cover" /> : <Sparkles className="size-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">{app.name}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{app.tagline}</p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{app.installs.toLocaleString("ru-RU")} установок · {app.category}</p>
          </div>
        </div>
        {app.description && <p className="relative z-10 mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{app.description}</p>}
      </div>

      <div className="lrf mt-3 p-4">
        <div className="relative z-10 flex items-start gap-3">
          {hasAccess ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-eco" /> : <Shield className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{hasAccess ? "Доступ к кошельку выдан" : "Требуется разрешение"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Приложение сможет читать баланс активных fFLOW и списывать средства по вашему запросу. 30% каждого списания сгорает, 70% идёт разработчику.
            </p>
            <div className="mt-3 flex gap-2">
              {hasAccess ? (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => revoke.mutate()} disabled={revoke.isPending}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs font-semibold">
                  <ShieldOff className="size-3.5" /> Отозвать
                </motion.button>
              ) : (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => grant.mutate()} disabled={grant.isPending}
                  className="mercury flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
                  <ShieldCheck className="size-3.5" /> Разрешить
                </motion.button>
              )}
              <a href={app.app_url} target="_blank" rel="noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs">
                <ExternalLink className="size-3.5" /> В новом окне
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="lrf mt-3 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">iframe · sandbox</p>
          {!running && (
            <button onClick={() => setRunning(true)} className="text-xs font-semibold text-eco">Запустить ▸</button>
          )}
        </div>
        {running ? (
          <iframe
            ref={iframeRef}
            src={app.app_url}
            title={app.name}
            className="h-[70vh] w-full bg-black"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
            referrerPolicy="no-referrer"
            allow="clipboard-write"
          />
        ) : (
          <div className="grid h-[40vh] place-items-center p-6 text-center">
            <div>
              <Sparkles className="mx-auto mb-2 size-6 text-eco" />
              <p className="text-sm text-muted-foreground">Приложение работает в изолированном iframe.<br />Нажмите «Запустить», чтобы загрузить.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
