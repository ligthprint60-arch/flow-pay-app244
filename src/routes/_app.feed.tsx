import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Heart, MessageCircle, Sparkles, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/feed")({
  head: () => ({ meta: [{ title: "Лента — FLOW" }] }),
  component: FeedPage,
});

type Post = {
  id: string;
  author_id: string;
  body: string;
  topic: string | null;
  likes: number;
  created_at: string;
  author: { username: string; display_name: string; is_author: boolean; is_verified: boolean } | null;
};

function FeedPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [composer, setComposer] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("is_author,display_name,username").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select("id,author_id,body,topic,likes,created_at,author:profiles!posts_author_id_fkey(username,display_name,is_author)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user || !composer.trim()) return;
      const { error } = await supabase.from("posts").insert({ author_id: user.id, body: composer.trim(), topic: "thoughts" });
      if (error) throw error;
    },
    onSuccess: () => {
      setComposer("");
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Опубликовано");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Лента</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Инсайты</h1>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-eco">Verified only</span>
      </div>

      {profile?.is_author ? (
        <div className="lrf mb-6 p-4">
          <div className="relative z-10">
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              rows={3}
              placeholder="Поделитесь финансовой мыслью…"
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{composer.length}/500</span>
              <button
                onClick={() => createPost.mutate()}
                disabled={!composer.trim() || createPost.isPending}
                className="mercury h-9 rounded-full px-4 text-sm font-semibold disabled:opacity-40"
              >
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="acrylic mb-6 flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-eco" />
          <div className="text-xs text-muted-foreground">
            Только верифицированные авторы могут публиковать.{" "}
            <span className="text-foreground">Подайте заявку в профиле</span> — модерация защищает ленту от скама.
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonFeed />
      ) : (!posts || posts.length === 0) ? (
        <Empty />
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </ul>
      )}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const ago = timeAgo(post.created_at);
  const initials = (post.author?.display_name ?? "??").slice(0, 2).toUpperCase();
  return (
    <li className="lrf p-4">
      <div className="relative z-10 flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-eco/40 to-fiat/40 font-mono text-[11px] font-semibold emissive-eco">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{post.author?.display_name ?? "Аноним"}</span>
            {post.author?.is_author && <BadgeCheck className="size-3.5 text-eco" />}
            <span className="truncate text-xs text-muted-foreground">@{post.author?.username}</span>
            <span className="text-muted-foreground">·</span>
            <span className="shrink-0 text-xs text-muted-foreground">{ago}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{post.body}</p>
          <div className="mt-3 flex items-center gap-4 text-muted-foreground">
            <button className="flex items-center gap-1.5 text-xs hover:text-eco">
              <Heart className="size-3.5" /> {post.likes}
            </button>
            <button className="flex items-center gap-1.5 text-xs hover:text-foreground">
              <MessageCircle className="size-3.5" /> Ответить
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Empty() {
  return (
    <div className="acrylic p-10 text-center">
      <p className="text-sm text-muted-foreground">Лента пока пуста.</p>
      <p className="mt-1 text-xs text-muted-foreground">Станьте автором — расскажите комьюнити о финансах.</p>
    </div>
  );
}

function SkeletonFeed() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "сейчас";
  if (s < 3600) return `${Math.floor(s / 60)}м`;
  if (s < 86400) return `${Math.floor(s / 3600)}ч`;
  return `${Math.floor(s / 86400)}д`;
}
