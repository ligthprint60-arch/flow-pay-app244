import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Eye, Send, Bell, BellRing, Trash2, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtViews, fmtDuration, timeAgo } from "@/lib/video";

export const Route = createFileRoute("/_app/video/$videoId")({
  head: () => ({
    meta: [
      { title: "Просмотр видео — FLOW Video" },
      { name: "description", content: "Смотрите видео в сети FLOW: лайки, комментарии и подписка на канал автора." },
      { property: "og:title", content: "Просмотр видео — FLOW Video" },
      { property: "og:description", content: "Смотрите видео в сети FLOW: лайки, комментарии и подписка на канал автора." },
    ],
  }),
  component: VideoWatch,
});

type Author = { id: string; username: string; display_name: string; avatar_url: string | null; is_verified: boolean; is_author: boolean };

function VideoWatch() {
  const { videoId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const viewed = useRef(false);

  const { data: video, isLoading } = useQuery({
    queryKey: ["video", videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*, author:author_id(id,username,display_name,avatar_url,is_verified,is_author)")
        .eq("id", videoId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as (Record<string, never> & {
        id: string; title: string; description: string | null; video_url: string; thumb_url: string | null;
        duration: number; views: number; likes: number; created_at: string; author_id: string; author: Author | null;
      }) | null;
    },
  });

  const { data: liked } = useQuery({
    queryKey: ["video-liked", videoId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("video_likes").select("video_id").eq("video_id", videoId).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const { data: subscribed } = useQuery({
    queryKey: ["subscribed", video?.author_id, user?.id],
    enabled: !!user && !!video?.author_id,
    queryFn: async () => {
      const { data } = await supabase.from("channel_subscriptions").select("channel_id")
        .eq("channel_id", video!.author_id).eq("subscriber_id", user!.id).maybeSingle();
      return !!data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["video-comments", videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_comments")
        .select("id,body,created_at,author_id,author:author_id(username,display_name,avatar_url,is_verified,is_author)")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; body: string; created_at: string; author_id: string; author: Omit<Author, "id"> | null }>;
    },
  });

  const { data: more } = useQuery({
    queryKey: ["video-more", videoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("id,title,thumb_url,duration,views")
        .eq("is_published", true)
        .neq("id", videoId)
        .order("views", { ascending: false })
        .limit(8);
      return (data ?? []) as Array<{ id: string; title: string; thumb_url: string | null; duration: number; views: number }>;
    },
  });

  useEffect(() => {
    if (viewed.current || !video) return;
    viewed.current = true;
    void supabase.rpc("app_video_view", { p_video_id: videoId });
  }, [video, videoId]);

  const toggleLike = async () => {
    const { error } = await supabase.rpc("app_video_toggle_like", { p_video_id: videoId });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["video", videoId] });
    qc.invalidateQueries({ queryKey: ["video-liked", videoId] });
  };

  const toggleSub = async () => {
    if (!video) return;
    const { error } = await supabase.rpc("app_toggle_subscription", { p_channel_id: video.author_id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["subscribed", video.author_id] });
  };

  const sendComment = async () => {
    if (!comment.trim() || !user) return;
    const { error } = await supabase.from("video_comments").insert({ video_id: videoId, author_id: user.id, body: comment.trim() });
    if (error) { toast.error(error.message); return; }
    setComment("");
    qc.invalidateQueries({ queryKey: ["video-comments", videoId] });
  };

  const removeVideo = async () => {
    const { error } = await supabase.from("videos").delete().eq("id", videoId);
    if (error) { toast.error(error.message); return; }
    toast.success("Видео удалено");
    navigate({ to: "/video" });
  };

  if (isLoading) {
    return <div className="grid place-items-center py-24"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!video) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Видео не найдено</p>
        <Link to="/video" className="lrf lrf-tap mt-4 inline-flex h-10 items-center px-4 text-sm">К каталогу</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center gap-2 pt-2">
        <Link to="/video" className="lrf lrf-tap grid size-9 place-items-center !rounded-full">
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-xs text-muted-foreground">FLOW Video</span>
      </div>

      <div className="lrf overflow-hidden">
        <video
          src={video.video_url}
          poster={video.thumb_url ?? undefined}
          controls
          playsInline
          className="aspect-video w-full bg-black"
        />
      </div>

      <div className="space-y-2">
        <h1 className="text-base font-semibold leading-snug">{video.title}</h1>
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Eye className="size-3" /> {fmtViews(video.views)} · {timeAgo(video.created_at)}
        </p>
      </div>

      <div className="lrf flex items-center gap-3 p-3">
        <span className="size-10 shrink-0 overflow-hidden rounded-full bg-foreground/10">
          {video.author?.avatar_url && <img src={video.author.avatar_url} alt="" className="size-full object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {video.author?.display_name ?? "—"}
            {video.author && <VerifiedBadge isVerified={video.author.is_verified} isAuthor={video.author.is_author} />}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">@{video.author?.username}</p>
        </div>
        {user?.id !== video.author_id && (
          <motion.button whileTap={{ scale: 0.94 }} onClick={toggleSub}
            className={`lrf lrf-tap flex h-9 items-center gap-1.5 px-3 text-xs font-semibold ${subscribed ? "text-muted-foreground" : "text-foreground"}`}>
            {subscribed ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />}
            {subscribed ? "Вы подписаны" : "Подписаться"}
          </motion.button>
        )}
      </div>

      <div className="flex gap-2">
        <motion.button whileTap={{ scale: 0.94 }} onClick={toggleLike}
          className="lrf lrf-tap flex h-10 flex-1 items-center justify-center gap-2 text-sm font-medium">
          <Heart className={`size-4 ${liked ? "fill-eco text-eco" : ""}`} /> {video.likes}
        </motion.button>
        {user?.id === video.author_id && (
          <motion.button whileTap={{ scale: 0.94 }} onClick={removeVideo}
            className="lrf lrf-tap grid h-10 w-12 place-items-center text-destructive">
            <Trash2 className="size-4" />
          </motion.button>
        )}
      </div>

      {video.description && (
        <div className="lrf whitespace-pre-wrap p-3 text-sm leading-relaxed text-muted-foreground">{video.description}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Комментарии · {comments?.length ?? 0}</h2>
        <div className="lrf flex items-center gap-2 px-3 py-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sendComment(); }}
            placeholder="Добавить комментарий"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => void sendComment()} aria-label="Отправить" className="lrf-tap text-eco">
            <Send className="size-4" />
          </button>
        </div>
        <div className="space-y-2">
          {comments?.map((c) => (
            <div key={c.id} className="lrf flex gap-3 p-3">
              <span className="size-8 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                {c.author?.avatar_url && <img src={c.author.avatar_url} alt="" className="size-full object-cover" />}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-xs font-semibold">
                  {c.author?.display_name ?? "—"}
                  {c.author && <VerifiedBadge isVerified={c.author.is_verified} isAuthor={c.author.is_author} size={12} />}
                  <span className="font-normal text-muted-foreground">· {timeAgo(c.created_at)}</span>
                </p>
                <p className="mt-1 break-words text-sm">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!!more?.length && (
        <section className="space-y-3 pb-4">
          <h2 className="text-sm font-semibold">Смотрите также</h2>
          <div className="space-y-2">
            {more.map((m) => (
              <Link key={m.id} to="/video/$videoId" params={{ videoId: m.id }} className="lrf lrf-tap flex gap-3 p-2">
                <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-foreground/5">
                  {m.thumb_url
                    ? <img src={m.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                    : <span className="grid size-full place-items-center"><PlayCircle className="size-5 text-muted-foreground" /></span>}
                  {m.duration > 0 && (
                    <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1 font-mono text-[9px]">{fmtDuration(m.duration)}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-xs font-medium">{m.title}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">{fmtViews(m.views)} просмотров</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
