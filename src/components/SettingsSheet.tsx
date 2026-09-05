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
  Image as ImageIcon, Music2, MapPin, Bell, ShoppingBag, Trash2, Crown, Link2, Loader2, UserCircle2, Film,
  SlidersHorizontal, Languages,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function SettingsSheet({
  open, onOpenChange, onOpenShop, onOpenNotifications, onOpenPremium, onOpenGraphics,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onOpenShop: () => void; onOpenNotifications: () => void; onOpenPremium: () => void;
  onOpenGraphics: () => void;
}) {
  const { t, lang, setLang } = useI18n();
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
        p_social_links: undefined, p_audio_url: url, p_sandbox_html: undefined, p_bio: undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Аудио обновлено"); },
    onError: (e: Error) => toast.error(e.message === "premium_required" ? "Нужен FLOW Premium" : e.message),
  });

  async function uploadAppBg(kind: "image" | "video") {
    if (!user) return;
    const f = await pickFile(kind === "video" ? "video/mp4,video/webm,video/*" : "image/*");
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("Файл больше 25 МБ"); return; }
    setBusy(kind === "video" ? "appbg-vid" : "appbg");
    try {
      const url = await uploadMedia(user.id, "app-bg", f);
      await setAppBg.mutateAsync(url);
      toast.success(kind === "video" ? "Видео-фон установлен" : "Фон обновлён");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function uploadAvatar() {
    if (!user) return;
    const f = await pickFile("image/*");
    if (!f) return;
    setBusy("avatar");
    try {
      const url = await uploadMedia(user.id, "avatar", f);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Фото профиля обновлено");
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
          <DialogTitle className="text-base font-semibold">{t("settings.title")}</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("settings.subtitle")}</p>

          <div className="sheet-scroll mt-4 space-y-2" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <Row icon={UserCircle2} title={t("settings.avatar")} desc={t("settings.avatar.desc")}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={uploadAvatar} disabled={busy === "avatar"}
                className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco emissive-eco disabled:opacity-40">
                {busy === "avatar" ? <Loader2 className="size-3 animate-spin" /> : t("common.upload")}
              </motion.button>
            </Row>

            <Row icon={ImageIcon} title={t("settings.bg")}
              desc={appBg ? t("settings.bg.set") : t("settings.bg.desc")}>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => uploadAppBg("image")} disabled={busy === "appbg"}
                  className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco emissive-eco disabled:opacity-40">
                  {busy === "appbg" ? <Loader2 className="size-3 animate-spin" /> : t("common.photo")}
                </motion.button>
                {appBg && (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setAppBg.mutate(null)}
                    className="rounded-full bg-white/[0.05] px-2 py-1.5 text-[11px] font-semibold">
                    <Trash2 className="size-3" />
                  </motion.button>
                )}
              </div>
            </Row>

            <Row icon={Film} title={t("settings.video")} desc={t("settings.video.desc")}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => uploadAppBg("video")} disabled={busy === "appbg-vid"}
                className="rounded-full bg-fiat/20 px-3 py-1.5 text-[11px] font-semibold text-fiat emissive-blue disabled:opacity-40">
                {busy === "appbg-vid" ? <Loader2 className="size-3 animate-spin" /> : t("common.upload")}
              </motion.button>
            </Row>

            <Row icon={Music2} title={t("settings.audio")}
              desc={isPremium ? t("settings.audio.desc") : t("settings.audio.locked")}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={uploadAudioFile}
                disabled={busy === "audio" || !isPremium}
                className="rounded-full bg-fiat/20 px-3 py-1.5 text-[11px] font-semibold text-fiat emissive-blue disabled:opacity-40">
                {busy === "audio" ? <Loader2 className="size-3 animate-spin" /> : isPremium ? t("common.upload") : t("common.premium")}
              </motion.button>
            </Row>

            <Row icon={MapPin} title={t("settings.geo")}
              desc={geo ?? t("settings.geo.desc")}>
              <motion.button whileTap={{ scale: 0.96 }} onClick={requestGeo} disabled={busy === "geo"}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold">
                {busy === "geo" ? <Loader2 className="size-3 animate-spin" /> : t("common.allow")}
              </motion.button>
            </Row>

            <Row icon={Bell} title={t("settings.notifications")} desc={t("settings.notifications.desc")}>
              <button onClick={() => { onOpenChange(false); onOpenNotifications(); }}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold">{t("common.open")}</button>
            </Row>

            <Row icon={ShoppingBag} title={t("settings.shop")} desc={t("settings.shop.desc")}>
              <button onClick={() => { onOpenChange(false); onOpenShop(); }}
                className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco">{t("common.open")}</button>
            </Row>

            <Row icon={SlidersHorizontal} title={t("settings.graphics")} desc={t("settings.graphics.desc")}>
              <button onClick={() => { onOpenChange(false); onOpenGraphics(); }}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold">{t("common.open")}</button>
            </Row>

            <Row icon={Languages} title={t("settings.lang")} desc={t("settings.lang.desc")}>
              <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-0.5">
                {(["ru", "en"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${lang === l ? "bg-eco/25 text-eco emissive-eco" : "text-muted-foreground"}`}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </Row>

            <Row icon={isPremium ? Link2 : Crown}
              title={isPremium ? t("settings.premium.on") : t("settings.premium.off")}
              desc={isPremium ? t("settings.premium.on.desc") : t("settings.premium.off.desc")}>
              <button onClick={() => { onOpenChange(false); isPremium ? onOpenPremium() : onOpenShop(); }}
                className="rounded-full bg-fiat/20 px-3 py-1.5 text-[11px] font-semibold text-fiat">
                {isPremium ? t("common.open") : t("common.premium")}
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
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.05]">
        <Icon className="size-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
