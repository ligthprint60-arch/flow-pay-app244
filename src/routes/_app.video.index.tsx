import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia, pickFile } from "@/lib/upload";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Upload, Search, PlayCircle, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtViews, fmtDuration, VIDEO_CATEGORIES } from "@/lib/video";

export const Route = createFileRoute("/_app/video/")({
  head: () => ({
    meta: [
      { title: "FLOW Video — видеохостинг сети FLOW" },
      { name: "description", content: "Смотрите и публикуйте видео внутри сети FLOW: каналы, подписки, лайки и комментарии." },
      { property: "og:title", content: "FLOW Video — видеохостинг сети FLOW" },
      { property: "og:description", content: "Смотрите и публикуйте видео внутри сети FLOW: каналы, подписки, лайки и комментарии." },
    ],
  }),
  component: VideoIndex,
});

type VideoRow = {
  id: string;
  title: string;
  thumb_url: string | null;
  duration: number;
  views: number;
  category: string;
  created_at: string;
  author_id: string;
  author: { username: string; display_name: string; avatar_url: string | null; is_verified: boolean; is_author: boolean } | null;
};

function VideoIndex() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["videos", q, cat],
    queryFn: async () => {
      let query = supabase
        .from("videos")
        .select("id,title,thumb_url,duration,views,category,created_at,author_id,author:author_id(username,display_name,avatar_url,is_verified,is_author)")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(60);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      if (cat !== "all") query = query.eq("category", cat);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as VideoRow[];
    },
  });

  return (
    <div className="space-y-4 px-4">
      <header className="flex items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">FLOW Video</h1>
          <p className="text-[11px] text-muted-foreground">Видеохостинг сети</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setUploadOpen(true)}
          className="lrf lrf-tap flex h-10 items-center gap-2 px-4 text-sm font-medium"
        >
          <Upload className="size-4" /> Загрузить
        </motion.button>
      </header>

      <div className="lrf flex items-center gap-2 px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск видео"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="sheet-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ id: "all", label: "Все" }, ...VIDEO_CATEGORIES].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`lrf lrf-tap shrink-0 px-3 py-1.5 text-xs font-medium ${cat === c.id ? "text-foreground" : "text-muted-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !videos?.length && (
        <div className="lrf grid place-items-center gap-2 p-8 text-center">
          <PlayCircle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Пока нет видео. Загрузите первое.</p>
        </div>
      )}

      <div className="grid gap-4">
        {videos?.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.03, type: "spring", stiffness: 360, damping: 30 }}
          >
            <Link to="/video/$videoId" params={{ videoId: v.id }} className="lrf lrf-tap block overflow-hidden">
              <div className="relative aspect-video w-full overflow-hidden bg-foreground/5">
                {v.thumb_url ? (
                  <img src={v.thumb_url} alt={v.title} loading="lazy" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center">
                    <PlayCircle className="size-9 text-muted-foreground" />
                  </div>
                )}
                {v.duration > 0 && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px]">
                    {fmtDuration(v.duration)}
                  </span>
                )}
              </div>
              <div className="flex gap-3 p-3">
                <span className="size-9 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                  {v.author?.avatar_url && <img src={v.author.avatar_url} alt="" className="size-full object-cover" />}
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {v.author?.display_name ?? "—"}
                    {v.author && <VerifiedBadge isVerified={v.author.is_verified} isAuthor={v.author.is_author} />}
                    <span>· <Eye className="inline size-3" /> {fmtViews(v.views)}</span>
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        userId={user?.id ?? null}
        onDone={() => qc.invalidateQueries({ queryKey: ["videos"] })}
      />
    </div>
  );
}

function UploadDialog({
  open, onOpenChange, userId, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(VIDEO_CATEGORIES[0]!.id);
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!userId) return;
    if (!title.trim() || !file) { toast.error("Нужны название и видеофайл"); return; }
    setBusy(true);
    try {
      const duration = await readDuration(file);
      const videoUrl = await uploadMedia(userId, "video", file);
      const thumbUrl = thumb ? await uploadMedia(userId, "thumb", thumb) : null;
      const { error } = await supabase.from("videos").insert({
        author_id: userId,
        title: title.trim(),
        description: desc.trim() || null,
        video_url: videoUrl,
        thumb_url: thumbUrl,
        duration,
        category: cat,
      });
      if (error) throw new Error(error.message);
      toast.success("Видео опубликовано");
      setTitle(""); setDesc(""); setFile(null); setThumb(null);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick max-w-[420px] border-0 p-0">
        <div className="sheet-scroll max-h-[75svh] space-y-3 overflow-y-auto p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base">Загрузка видео</DialogTitle>
          </DialogHeader>

          <button
            onClick={async () => setFile((await pickFile("video/*")) ?? null)}
            className="lrf lrf-tap flex w-full items-center justify-between px-3 py-3 text-sm"
          >
            <span className="truncate">{file ? file.name : "Выбрать видеофайл"}</span>
            <Upload className="size-4 shrink-0 text-muted-foreground" />
          </button>

          <button
            onClick={async () => setThumb((await pickFile("image/*")) ?? null)}
            className="lrf lrf-tap flex w-full items-center justify-between px-3 py-3 text-sm"
          >
            <span className="truncate">{thumb ? thumb.name : "Обложка (необязательно)"}</span>
            <Upload className="size-4 shrink-0 text-muted-foreground" />
          </button>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            className="lrf w-full bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Описание"
            rows={3}
            className="lrf w-full resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />

          <div className="flex flex-wrap gap-2">
            {VIDEO_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`lrf lrf-tap px-3 py-1.5 text-xs ${cat === c.id ? "text-foreground" : "text-muted-foreground"}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={busy}
            onClick={submit}
            className="lrf lrf-thick lrf-tap flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? "Загрузка…" : "Опубликовать"}
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(el.src);
        resolve(Number.isFinite(el.duration) ? Math.round(el.duration) : 0);
      };
      el.onerror = () => resolve(0);
      el.src = URL.createObjectURL(file);
    } catch {
      resolve(0);
    }
  });
}
