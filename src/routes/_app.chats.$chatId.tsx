import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/theme";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, ImagePlus, Loader2, Wallpaper } from "lucide-react";
import { CUSTOM_EMOJIS, renderWithEmojis } from "@/lib/emoji";
import { uploadMedia, pickFile } from "@/lib/upload";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const Route = createFileRoute("/_app/chats/$chatId")({
  head: () => ({ meta: [{ title: "Чат — FLOW" }] }),
  component: ChatPage,
});

type Msg = { id: string; chat_id: string; sender_id: string; body: string; created_at: string };
type Other = { id: string; username: string; display_name: string; is_verified: boolean; is_author: boolean; avatar_url: string | null };

function ChatPage() {
  const { chatId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chat } = useQuery({
    queryKey: ["chat", chatId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (!data) return null;
      const otherId = data.user_a === user?.id ? data.user_b : data.user_a;
      const { data: other } = await supabase.from("profiles")
        .select("id,username,display_name,is_verified,is_author,avatar_url")
        .eq("id", otherId).maybeSingle();
      const { data: settings } = await supabase.from("chat_settings" as never)
        .select("background_url").eq("chat_id", chatId).eq("user_id", user!.id).maybeSingle();
      return { ...data, other: other as Other | null, background_url: (settings as { background_url: string | null } | null)?.background_url ?? null };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async (): Promise<Msg[]> => {
      const { data, error } = await supabase.from("messages")
        .select("*").eq("chat_id", chatId)
        .order("created_at", { ascending: true }).limit(300);
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

  async function send(body?: string) {
    const b = (body ?? text).trim();
    if (!b || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("app_send_message", { chat_id: chatId, body: b });
      if (error) throw new Error(error.message);
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", chatId] });
      qc.invalidateQueries({ queryKey: ["chats"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  }

  async function attachImage() {
    if (!user) return;
    const f = await pickFile("image/*");
    if (!f) return;
    setSending(true);
    try {
      const url = await uploadMedia(user.id, "emoji", f);
      await send(`[image]${url}`);
    } catch (e) { toast.error((e as Error).message); setSending(false); }
  }

  async function changeBg() {
    if (!user) return;
    const f = await pickFile("image/*");
    if (!f) return;
    try {
      const url = await uploadMedia(user.id, "chat-bg", f);
      const { error } = await supabase.rpc("app_set_chat_background" as never,
        { p_chat_id: chatId, p_url: url } as never);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["chat", chatId] });
      toast.success("Фон чата обновлён");
    } catch (e) { toast.error((e as Error).message); }
  }

  const ownedEmojis = profile?.owned_emojis ?? [];
  const availableEmojis = CUSTOM_EMOJIS.filter((e) => ownedEmojis.includes(e.id));
  const other = chat?.other;
  const initials = (other?.display_name ?? "??").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background/40 backdrop-blur-xl">
      {chat?.background_url && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-60"
             style={{ backgroundImage: `url("${chat.background_url}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-background/70 via-background/30 to-background/80" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 border-b border-white/10 px-3 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-md">
        <Link to="/chats" className="grid size-10 place-items-center rounded-full bg-white/[0.06] lrf-tap">
          <ArrowLeft className="size-4" />
        </Link>
        {other?.avatar_url ? (
          <img src={other.avatar_url} alt="" className="size-10 rounded-full object-cover ring-1 ring-white/15" />
        ) : (
          <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-eco/40 to-fiat/30 font-mono text-[11px] font-bold emissive-eco">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{other?.display_name ?? "..."}</p>
            <VerifiedBadge isVerified={other?.is_verified} isAuthor={other?.is_author} size={14} />
          </div>
          <p className="truncate text-[11px] text-muted-foreground">@{other?.username}</p>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={changeBg}
          className="grid size-10 place-items-center rounded-full bg-white/[0.06] lrf-tap"
          aria-label="Фон чата">
          <Wallpaper className="size-4" />
        </motion.button>
      </div>

      {/* Messages */}
      <div ref={scrollRef}
           className="sheet-scroll relative z-10 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        <AnimatePresence initial={false}>
          {(messages ?? []).map((m) => {
            const mine = m.sender_id === user?.id;
            const img = m.body.startsWith("[image]") ? m.body.slice(7) : null;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[78%] ${img ? "p-1" : "px-3 py-2"} rounded-2xl text-sm leading-relaxed ${
                  mine
                    ? "bg-gradient-to-br from-eco/55 to-eco/25 emissive-eco text-foreground"
                    : "lrf"
                }`}>
                  {img ? (
                    <img src={img} alt="" className="max-h-72 rounded-xl object-cover" />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{renderWithEmojis(m.body)}</p>
                  )}
                  <p className={`mt-1 ${img ? "px-2 pb-1" : ""} text-right font-mono text-[9px] opacity-70`}>
                    {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            );
          })}
          {(!messages || messages.length === 0) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mx-auto mt-16 max-w-xs text-center">
              <p className="text-sm text-muted-foreground">Напишите первое сообщение @{other?.username ?? "..."}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Emoji bar */}
      <AnimatePresence>
        {emojiOpen && availableEmojis.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="lrf relative z-10 mx-3 mb-2 flex flex-wrap gap-1.5 !rounded-2xl p-2"
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

      {/* Composer */}
      <div className="relative z-10 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
        <div className="lrf flex items-center gap-1 !rounded-full px-1.5 py-1.5">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEmojiOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:text-eco">
            <Smile className="size-4" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={attachImage}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:text-fiat">
            <ImagePlus className="size-4" />
          </motion.button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Сообщение..."
            className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => send()}
            disabled={!text.trim() || sending}
            className="mercury grid size-9 place-items-center rounded-full disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
