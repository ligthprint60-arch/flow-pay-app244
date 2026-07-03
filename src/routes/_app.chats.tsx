import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle, Search } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { toast } from "sonner";
import { renderWithEmojis } from "@/lib/emoji";

export const Route = createFileRoute("/_app/chats")({
  head: () => ({ meta: [{ title: "Чаты — FLOW" }] }),
  component: ChatsPage,
});

type ChatRow = {
  chat_id: string;
  other_id: string;
  other_username: string;
  other_display_name: string;
  other_is_verified: boolean;
  other_is_author: boolean;
  other_avatar_url?: string | null;
  last_message_at: string;
  last_body: string | null;
};

type UserResult = {
  id: string;
  username: string;
  display_name: string;
  is_verified: boolean;
  is_author: boolean;
  avatar_url?: string | null;
};

function ChatsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: chats, refetch } = useQuery({
    queryKey: ["chats"],
    queryFn: async (): Promise<ChatRow[]> => {
      const { data, error } = await supabase.rpc("app_list_chats");
      if (error) throw error;
      return (data ?? []) as ChatRow[];
    },
  });

  const normalizedSearch = search.trim().replace(/^@/, "").toLowerCase();

  const { data: users, isFetching: searchingUsers } = useQuery({
    queryKey: ["chat-user-search", normalizedSearch],
    enabled: normalizedSearch.length >= 2,
    queryFn: async (): Promise<UserResult[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,is_verified,is_author,avatar_url")
        .or(`username.ilike.%${normalizedSearch}%,display_name.ilike.%${normalizedSearch}%`)
        .eq("is_blocked", false)
        .limit(8);
      if (error) throw error;
      return (data ?? []) as UserResult[];
    },
  });

  const open = useMutation({
    mutationFn: async (username: string) => {
      const u = username.trim().replace(/^@/, "").toLowerCase();
      if (u.length < 3) throw new Error("Введите @username (минимум 3 символа)");
      const { data, error } = await supabase.rpc("app_open_chat", { other_username: u });
      if (error) {
        const map: Record<string, string> = {
          user_not_found: "Пользователь не найден",
          self_chat_forbidden: "Нельзя написать себе",
          not_authenticated: "Войдите в аккаунт",
        };
        throw new Error(map[error.message] ?? error.message);
      }
      const chatId = (data as { chat_id?: string } | null)?.chat_id;
      if (!chatId) throw new Error("Чат создан, но backend не вернул id");
      return { chat_id: chatId };
    },
    onSuccess: async (d) => {
      setSearch("");
      await navigate({ to: "/chats/$chatId", params: { chatId: d.chat_id } });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Сообщения</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Чаты</h1>
      </div>

      {normalizedSearch.length >= 2 && (
        <div className="lrf mb-4 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Найденные пользователи</p>
            {searchingUsers && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="space-y-1.5">
            {(users ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => open.mutate(u.username)}
                disabled={open.isPending}
                className="lrf-tap flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] p-2 text-left disabled:opacity-50"
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="size-10 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" />
                ) : (
                  <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/30 font-mono text-xs font-semibold emissive-eco">
                    {u.display_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{u.display_name}</span>
                    <VerifiedBadge isVerified={u.is_verified} isAuthor={u.is_author} size={14} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                </div>
                <span className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco">Написать</span>
              </button>
            ))}
            {!searchingUsers && users?.length === 0 && (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">Пользователь не найден</p>
            )}
          </div>
        </div>
      )}

      <div className="lrf mb-4 flex items-center gap-2 !rounded-2xl px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value.replace(/^@/, ""))}
          placeholder="Начать чат @username"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          onKeyDown={(e) => { if (e.key === "Enter" && search.trim()) open.mutate(search.trim()); }}
        />
        <button
          onClick={() => search.trim() && open.mutate(search.trim())}
          disabled={!search.trim() || open.isPending}
          className="mercury rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40"
        >
          Открыть
        </button>
      </div>

      <AnimatePresence>
        {(!chats || chats.length === 0) ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="acrylic p-10 text-center">
            <MessageCircle className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Чатов пока нет</p>
            <p className="mt-1 text-xs text-muted-foreground">Введите @username чтобы начать переписку</p>
          </motion.div>
        ) : (
          <ul className="space-y-2">
            {chats.map((c, i) => (
              <motion.li
                key={c.chat_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link to="/chats/$chatId" params={{ chatId: c.chat_id }} className="lrf lrf-tap flex items-center gap-3 !rounded-3xl p-3">
                  {c.other_avatar_url ? (
                    <img src={c.other_avatar_url} alt="" className="size-11 shrink-0 rounded-2xl object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/30 font-mono text-xs font-semibold emissive-eco">
                      {c.other_display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{c.other_display_name}</span>
                      <VerifiedBadge isVerified={c.other_is_verified} isAuthor={c.other_is_author} size={14} />
                      <span className="truncate text-[11px] text-muted-foreground">@{c.other_username}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.last_body ? renderWithEmojis(c.last_body) : "Нет сообщений"}
                    </p>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </AnimatePresence>
    </div>
  );
}
