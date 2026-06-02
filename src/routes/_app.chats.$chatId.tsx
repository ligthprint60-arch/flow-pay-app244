import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/theme";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile } from "lucide-react";
import { CUSTOM_EMOJIS, renderWithEmojis } from "@/lib/emoji";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chats/$chatId")({
  head: () => ({ meta: [{ title: "Чат — FLOW" }] }),
  component: ChatPage,
});

type Msg = { id: string; chat_id: string; sender_id: string; body: string; created_at: string };

function ChatPage() {
  const { chatId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chat } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const { data } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (!data) return null;
      const otherId = data.user_a === user?.id ? data.user_b : data.user_a;
      const { data: other } = await supabase.from("profiles")
        .select("id,username,display_name,is_verified,is_author")
        .eq("id", otherId).maybeSingle();
      return { ...data, other };
    },
    enabled: !!user,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase.from("messages")
        .select("*").eq("chat_id", chatId)
        .order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`messages:${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        () => { qc.invalidateQueries({ queryKey: ["messages", chatId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [chatId, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body) return;
      const { error } = await supabase.rpc("app_send_message", { chat_id: chatId, body });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["messages", chatId] }); qc.invalidateQueries({ queryKey: ["chats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownedEmojis = profile?.owned_emojis ?? [];
  const availableEmojis = CUSTOM_EMOJIS.filter((e) => ownedEmojis.includes(e.id));

  return (
    <div className="flex h-svh flex-col px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-10">
      <div className="lrf mb-3 flex items-center gap-2 !rounded-3xl px-3 py-2">
        <Link to="/chats" className="grid size-9 place-items-center rounded-full bg-white/[0.06] lrf-tap">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{chat?.other?.display_name ?? "..."}</p>
          <p className="truncate text-[11px] text-muted-foreground">@{chat?.other?.username}</p>
        </div>
      </div>

      <div ref={scrollRef} className="sheet-scroll relative z-10 flex-1 space-y-2 overflow-y-auto py-2">
        <AnimatePresence initial={false}>
          {(messages ?? []).map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? "bg-gradient-to-br from-eco/40 to-eco/20 emissive-eco"
                    : "lrf"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{renderWithEmojis(m.body)}</p>
                  <p className="mt-1 text-right font-mono text-[9px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {emojiOpen && availableEmojis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="lrf mb-2 flex flex-wrap gap-1.5 !rounded-2xl p-2"
          >
            {availableEmojis.map((e) => (
              <button key={e.id} onClick={() => setText((t) => t + `:${e.id}:`)}
                className="rounded-xl bg-white/[0.05] px-2 py-1.5 text-xl hover:bg-white/[0.12]">
                {e.char}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lrf flex items-center gap-1 !rounded-full px-2 py-1.5">
        <button onClick={() => setEmojiOpen((v) => !v)}
          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:text-eco">
          <Smile className="size-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send.mutate(); } }}
          placeholder="Сообщение..."
          className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => send.mutate()}
          disabled={!text.trim() || send.isPending}
          className="mercury grid size-9 place-items-center rounded-full disabled:opacity-40"
        >
          <Send className="size-4" />
        </motion.button>
      </div>
    </div>
  );
}
