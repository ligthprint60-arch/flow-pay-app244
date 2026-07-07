import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/theme";
import { uploadMedia, pickFile } from "@/lib/upload";
import { motion } from "framer-motion";
import { Upload, Trash2, Loader2, Plus, Star, StarOff, ImagePlus } from "lucide-react";
import { toast } from "sonner";

type Pack = { id: string; name: string; cover_url: string | null };
type Emoji = { id: string; shortcode: string; image_url: string; pack_id: string | null };

export function CustomEmojiCreator({ isPremium }: { isPremium: boolean }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [activePack, setActivePack] = useState<string | null>(null);
  const [newPackName, setNewPackName] = useState("");
  const [shortcode, setShortcode] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: packs } = useQuery({
    queryKey: ["my-emoji-packs", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Pack[]> => {
      const { data } = await supabase.from("emoji_packs" as never)
        .select("id,name,cover_url")
        .eq("owner_id", user!.id).order("created_at", { ascending: false });
      return (data as Pack[] | null) ?? [];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-custom-emojis", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Emoji[]> => {
      const { data } = await supabase.from("custom_emojis" as never)
        .select("id,shortcode,image_url,pack_id")
        .eq("owner_id", user!.id).order("created_at", { ascending: false });
      return (data as Emoji[] | null) ?? [];
    },
  });

  const featured = (profile as { featured_emoji?: string | null } | undefined)?.featured_emoji ?? null;

  const createPack = useMutation({
    mutationFn: async () => {
      const nm = newPackName.trim();
      if (nm.length < 2) throw new Error("Название слишком короткое");
      let coverUrl: string | null = null;
      if (pendingFile && user) coverUrl = await uploadMedia(user.id, "emoji", pendingFile);
      const { data, error } = await supabase.rpc("app_create_emoji_pack" as never, {
        p_name: nm, p_cover_url: coverUrl,
      } as never);
      if (error) throw new Error(error.message);
      return data as { id: string };
    },
    onSuccess: (d) => {
      toast.success("Пак создан");
      setNewPackName(""); setPendingFile(null); setActivePack(d.id);
      qc.invalidateQueries({ queryKey: ["my-emoji-packs"] });
    },
    onError: (e: Error) => toast.error(e.message === "premium_required" ? "Нужен FLOW Premium" : e.message),
  });

  const delPack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("app_delete_emoji_pack" as never, { p_id: id } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      if (activePack) setActivePack(null);
      qc.invalidateQueries({ queryKey: ["my-emoji-packs"] });
      qc.invalidateQueries({ queryKey: ["my-custom-emojis"] });
      qc.invalidateQueries({ queryKey: ["custom-emojis-global"] });
    },
  });

  const addEmoji = useMutation({
    mutationFn: async () => {
      if (!user || !pendingFile) throw new Error("Выберите изображение");
      const sc = shortcode.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (sc.length < 2) throw new Error("Короткий shortcode");
      setBusy(true);
      const url = await uploadMedia(user.id, "emoji", pendingFile);
      if (activePack) {
        const { error } = await supabase.rpc("app_add_emoji_to_pack" as never, {
          p_pack_id: activePack, p_shortcode: sc, p_image_url: url,
        } as never);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("app_create_custom_emoji" as never, {
          p_shortcode: sc, p_image_url: url,
        } as never);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Эмодзи добавлен");
      setShortcode(""); setPendingFile(null);
      qc.invalidateQueries({ queryKey: ["my-custom-emojis"] });
      qc.invalidateQueries({ queryKey: ["custom-emojis-global"] });
    },
    onError: (e: Error) => toast.error(e.message === "premium_required" ? "Нужен FLOW Premium" : e.message),
    onSettled: () => setBusy(false),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("app_delete_custom_emoji" as never, { p_id: id } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-custom-emojis"] });
      qc.invalidateQueries({ queryKey: ["custom-emojis-global"] });
    },
  });

  const setFeatured = useMutation({
    mutationFn: async (value: string | null) => {
      const { error } = await supabase.rpc("app_set_featured_emoji" as never, { p_value: value ?? "" } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  if (!isPremium) {
    return (
      <div className="lrf !rounded-2xl p-4 text-xs text-muted-foreground">
        Создание эмодзи и паков из изображений — для <span className="text-eco">FLOW Premium</span>.
      </div>
    );
  }

  const filteredEmojis = (mine ?? []).filter((e) => (activePack ? e.pack_id === activePack : !e.pack_id));

  return (
    <div className="space-y-3">
      {/* Packs strip */}
      <div className="lrf !rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Мои паки</p>
          <span className="font-mono text-[9px] text-muted-foreground">{packs?.length ?? 0}/20</span>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActivePack(null)}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold ${activePack === null ? "bg-eco/25 text-eco" : "bg-white/[0.05] text-muted-foreground"}`}>
            Без пака
          </button>
          {(packs ?? []).map((p) => (
            <button key={p.id} onClick={() => setActivePack(p.id)}
              className={`group relative shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold ${activePack === p.id ? "bg-eco/25 text-eco" : "bg-white/[0.05] text-muted-foreground"}`}>
              <span className="flex items-center gap-1.5">
                {p.cover_url && <img src={p.cover_url} alt="" className="size-4 rounded object-cover" />}
                {p.name}
              </span>
            </button>
          ))}
        </div>

        {/* Create pack */}
        <div className="mt-3 flex items-center gap-2">
          <button type="button"
            onClick={async () => { const f = await pickFile("image/*"); if (f) setPendingFile(f); }}
            className="lrf lrf-tap grid size-9 place-items-center !rounded-xl"
            title="Обложка пака из галереи">
            <ImagePlus className="size-4" />
          </button>
          <input value={newPackName} onChange={(e) => setNewPackName(e.target.value)}
            placeholder="Название нового пака"
            maxLength={40}
            className="flex-1 rounded-xl bg-white/[0.05] px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/60" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => createPack.mutate()}
            disabled={createPack.isPending || newPackName.trim().length < 2}
            className="mercury flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-semibold disabled:opacity-40">
            {createPack.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Пак
          </motion.button>
          {activePack && (
            <button onClick={() => { if (confirm("Удалить пак?")) delPack.mutate(activePack); }}
              className="grid size-9 place-items-center rounded-xl bg-destructive/20 text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Add emoji to selected pack (or standalone) */}
      <div className="lrf !rounded-2xl p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-eco">
          Добавить в {activePack ? "пак" : "личные"}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button type="button"
            onClick={async () => { const f = await pickFile("image/*"); if (f) setPendingFile(f); }}
            className="lrf lrf-tap !rounded-2xl px-3 py-2 text-xs font-semibold">
            {pendingFile ? <span className="truncate max-w-[100px] inline-block align-middle">{pendingFile.name}</span> : (<><Upload className="mr-1 inline size-3" />Из галереи</>)}
          </button>
          <span className="text-xs text-muted-foreground">:</span>
          <input value={shortcode} onChange={(e) => setShortcode(e.target.value)}
            placeholder="shortcode" maxLength={24}
            className="flex-1 rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground">:</span>
        </div>
        <motion.button whileTap={{ scale: 0.96 }}
          onClick={() => addEmoji.mutate()}
          disabled={busy || !pendingFile || shortcode.length < 2}
          className="mercury mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold disabled:opacity-40">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Добавить эмодзи"}
        </motion.button>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          В постах/чате: <span className="font-mono">:{shortcode || "shortcode"}:</span>
        </p>
      </div>

      {/* Emoji grid for current selection */}
      {filteredEmojis.length > 0 && (
        <div className="lrf !rounded-2xl p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {activePack ? "Эмодзи пака" : "Личные эмодзи"} ({filteredEmojis.length})
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {filteredEmojis.map((e) => {
              const isFeat = featured === e.shortcode;
              return (
                <div key={e.id} className="relative rounded-xl bg-white/[0.04] p-2 text-center">
                  <img src={e.image_url} alt={e.shortcode} className="mx-auto size-10 rounded-md object-cover" />
                  <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">:{e.shortcode}:</p>
                  <button
                    onClick={() => setFeatured.mutate(isFeat ? null : e.shortcode)}
                    className={`absolute -left-1 -top-1 grid size-5 place-items-center rounded-full ${isFeat ? "bg-eco text-black" : "bg-white/10 text-muted-foreground"}`}
                    title={isFeat ? "Убрать из профиля" : "Показать в профиле"}>
                    {isFeat ? <Star className="size-2.5" /> : <StarOff className="size-2.5" />}
                  </button>
                  <button onClick={() => del.mutate(e.id)}
                    className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-destructive/80 text-white">
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
