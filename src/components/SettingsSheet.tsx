import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/theme";
import { uploadMedia, pickFile } from "@/lib/upload";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Image as ImageIcon, Music2, MapPin, Bell, ShoppingBag, Trash2, Crown, Link2, Loader2,
} from "lucide-react";

export function SettingsSheet({
  open, onOpenChange, onOpenShop, onOpenNotifications, onOpenPremium,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onOpenShop: () => void; onOpenNotifications: () => void; onOpenPremium: () => void;
}) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [geo, setGeo] = useState<string | null>(null);

  const isPremium = !!profile?.premium_until && new Date(profile.premium_until) > new Date();
  const appBg = (profile as { app_background_url?: string | null } | null | undefined)?.app_background_url ?? null;

  const setAppBg = useMutation({
    mutationFn: async (url: string | null) => {
      const { error } = await supabase.rpc("app_set_app_background" as never, { p_url: url ?? "" } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  const setAudio = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase.rpc("app_update_profile_extras", {
        p_social_links: null, p_audio_url: url, p_sandbox_html: null, p_bio: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Аудио обновлено"); },
    onError: (e: Error) => toast.error(e.message === "premium_required" ? "Нужен FLOW Premium" : e.message),
  });

  async function uploadAppBg() {
    if (!user) return;
    const f = await pickFile("image/*");
    if (!f) return;
    setBusy("appbg");
    try {
      const url = await uploadMedia(user.id, "app-bg", f);
      await setAppBg.mutateAsync(url);
      toast.success("Фон приложения обновлён");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function uploadAudioFile() {
    if (!user) return;
    if (!isPremium) { toast.error("Нужен FLOW Premium"); return; }
    const f = await pickFile("audio/mpeg,audio/mp3,audio/*");
    if (!f) return;
    setBusy("audio");
    try {
      const url = await uploadMedia(user.id, "audio", f);
      await setAudio.mutateAsync(url);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  function requestGeo() {
    if (!("geolocation" in navigator)) { toast.error("Геолокация не поддерживается"); return; }
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        toast.success("Доступ к местоположению получен");
        setBusy(null);
      },
      (err) => { toast.error("Отказано: " + err.message); setBusy(null); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick !rounded-[28px] border-0 bg-transparent p-0 sm:max-w-md">
        <div className="relative z-10 p-5">
          <DialogTitle className="text-base font-semibold">Настройки</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">Персонализация и доступы</p>

          <div className="sheet-scroll mt-4 space-y-2" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <Row icon={ImageIcon} title="Фон приложения"
              desc={appBg ? "Установлен пользовательский фон" : "Загрузите изображение из устройства"}>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={uploadAppBg} disabled={busy === "appbg"}
                  className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco emissive-eco disabled:opacity-40">
                  {busy === "appbg" ? <Loader2 className="size-3 animate-spin" /> : "Загрузить"}
                </motion.button>
                {appBg && (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setAppBg.mutate(null)}
                    className="rounded-full bg-white/[0.05] px-2 py-1.5 text-[11px] font-semibold">
                    <Trash2 className="size-3" />
                  </motion.button>
                )}
              </div>
            </Row>

            <Row icon={Music2} title="Аудио в профиле"
              desc={isPremium ? "MP3 для фона профиля" : "Только Premium"}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={uploadAudioFile}
                disabled={busy === "audio" || !isPremium}
                className="rounded-full bg-fiat/20 px-3 py-1.5 text-[11px] font-semibold text-fiat emissive-blue disabled:opacity-40">
                {busy === "audio" ? <Loader2 className="size-3 animate-spin" /> : isPremium ? "Загрузить" : "Premium"}
              </motion.button>
            </Row>

            <Row icon={MapPin} title="Местоположение"
              desc={geo ?? "Разрешите доступ для геофункций"}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={requestGeo} disabled={busy === "geo"}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold">
                {busy === "geo" ? <Loader2 className="size-3 animate-spin" /> : "Разрешить"}
              </motion.button>
            </Row>

            <Row icon={Bell} title="Уведомления" desc="Объявления команды FLOW">
              <button onClick={() => { onOpenChange(false); onOpenNotifications(); }}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold">Открыть</button>
            </Row>

            <Row icon={ShoppingBag} title="FLOW Shop" desc="Скины · эмодзи · Premium">
              <button onClick={() => { onOpenChange(false); onOpenShop(); }}
                className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco">Открыть</button>
            </Row>

            <Row icon={isPremium ? Link2 : Crown}
              title={isPremium ? "Premium · соцсети / песочница" : "Получить Premium"}
              desc={isPremium ? "Настройки premium-возможностей" : "Кастомные эмодзи, аудио, песочница"}>
              <button onClick={() => { onOpenChange(false); isPremium ? onOpenPremium() : onOpenShop(); }}
                className="rounded-full bg-fiat/20 px-3 py-1.5 text-[11px] font-semibold text-fiat">
                {isPremium ? "Открыть" : "Premium"}
              </button>
            </Row>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, title, desc, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="lrf flex items-center gap-3 !rounded-2xl p-3">
      <div className="grid size-9 place-items-center rounded-xl bg-white/[0.05]">
        <Icon className="size-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}
