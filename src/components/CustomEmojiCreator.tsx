import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia, pickFile } from "@/lib/upload";
import { motion } from "framer-motion";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mine = { id: string; shortcode: string; image_url: string };

export function CustomEmojiCreator({ isPremium }: { isPremium: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shortcode, setShortcode] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: mine } = useQuery({
    queryKey: ["my-custom-emojis", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Mine[]> => {
      const { data } = await supabase.from("custom_emojis" as never)
        .select("id,shortcode,image_url")
        .eq("owner_id", user!.id).order("created_at", { ascending: false });
      return (data as Mine[] | null) ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !pendingFile) throw new Error("Выберите файл");
      const sc = shortcode.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (sc.length < 2) throw new Error("Короткий shortcode");
      setBusy(true);
      const url = await uploadMedia(user.id, "emoji", pendingFile);
      const { error } = await supabase.rpc("app_create_custom_emoji" as never, {
        p_shortcode: sc, p_image_url: url,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Эмодзи создан");
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

  if (!isPremium) {
    return (
      <div className="lrf !rounded-2xl p-4 text-xs text-muted-foreground">
        Создание собственных эмодзи из изображений доступно только для <span className="text-eco">FLOW Premium</span>.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="lrf !rounded-2xl p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-eco">Создать эмодзи</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => { const f = await pickFile("image/*"); if (f) setPendingFile(f); }}
            className="lrf lrf-tap !rounded-2xl px-3 py-2 text-xs font-semibold"
          >
            {pendingFile ? <span className="truncate max-w-[100px] inline-block align-middle">{pendingFile.name}</span> : (<><Upload className="mr-1 inline size-3" />Изображение</>)}
          </button>
          <span className="text-xs text-muted-foreground">:</span>
          <input
            value={shortcode} onChange={(e) => setShortcode(e.target.value)}
            placeholder="shortcode"
            maxLength={24}
            className="flex-1 rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground/60"
          />
          <span className="text-xs text-muted-foreground">:</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => create.mutate()}
          disabled={busy || !pendingFile || shortcode.length < 2}
          className="mercury mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Создать"}
        </motion.button>
        <p className="mt-1.5 text-[10px] text-muted-foreground">Используйте в постах и чатах как <span className="font-mono">:{shortcode || "shortcode"}:</span></p>
      </div>

      {(mine ?? []).length > 0 && (
        <div className="lrf !rounded-2xl p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Мои эмодзи ({mine?.length})</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {mine!.map((e) => (
              <div key={e.id} className="relative rounded-xl bg-white/[0.04] p-2 text-center">
                <img src={e.image_url} alt={e.shortcode} className="mx-auto size-10 rounded-md object-cover" />
                <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">:{e.shortcode}:</p>
                <button onClick={() => del.mutate(e.id)}
                  className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-destructive/80 text-white">
                  <Trash2 className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
