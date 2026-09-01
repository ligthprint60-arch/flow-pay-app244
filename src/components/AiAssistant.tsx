import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Loader2, SendHorizonal, Wand2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { activitySummary } from "@/lib/activity";
import { useProfile } from "@/lib/theme";
import { assistantChat } from "@/lib/ai.functions";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

export function AiAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, lang } = useI18n();
  const route = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useProfile();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const p = profile as { username?: string; balance_rflow?: number; balance_fflow?: number; premium_until?: string | null } | null | undefined;
      const res = await assistantChat({
        data: {
          lang,
          route,
          activity: activitySummary(),
          profile: p
            ? `@${p.username ?? "user"}, rFLOW: ${p.balance_rflow ?? 0}, fFLOW: ${p.balance_fflow ?? 0}, premium: ${p.premium_until ? "yes" : "no"}`
            : "",
          messages: next.slice(-12),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply || "…" }]);
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg === "credits_required" ? "AI credits required" : msg === "rate_limited" ? "Too many requests" : t("ai.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick !rounded-[28px] border-0 bg-transparent p-0 sm:max-w-md">
        <div className="relative z-10 flex h-[70vh] flex-col p-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-eco" /> {t("ai.title")}
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("ai.subtitle")}</p>

          <div className="sheet-scroll mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="lrf !rounded-2xl p-3 text-[12px] leading-relaxed text-muted-foreground">
                {t("ai.empty")}
              </div>
            )}
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-eco/20 text-foreground"
                    : "lrf mr-auto !rounded-2xl"
                }`}
              >
                {m.content}
              </motion.div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> {t("ai.thinking")}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <button
            onClick={() => send(lang === "en" ? "Analyze my recent activity and tell me what to do next." : "Проанализируй мои недавние действия и подскажи, что делать дальше.")}
            disabled={busy}
            className="mt-3 flex items-center justify-center gap-2 rounded-full bg-fiat/20 px-3 py-2 text-[11px] font-semibold text-fiat emissive-blue disabled:opacity-40"
          >
            <Wand2 className="size-3.5" /> {t("ai.analyze")}
          </button>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(input); }}
            className="mt-2 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai.placeholder")}
              className="lrf min-w-0 flex-1 !rounded-full bg-transparent px-4 py-2.5 text-[12.5px] outline-none placeholder:text-muted-foreground"
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="submit"
              disabled={busy || !input.trim()}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-eco/25 text-eco emissive-eco disabled:opacity-40"
              aria-label={t("common.send")}
            >
              <SendHorizonal className="size-4" />
            </motion.button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
