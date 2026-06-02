import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/theme";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Link2, Music2, Code2, Save } from "lucide-react";

export function PremiumEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const links = (profile?.social_links ?? {}) as Record<string, string>;

  const [twitter, setTwitter] = useState(links.twitter ?? "");
  const [telegram, setTelegram] = useState(links.telegram ?? "");
  const [instagram, setInstagram] = useState(links.instagram ?? "");
  const [website, setWebsite] = useState(links.website ?? "");
  const [audio, setAudio] = useState(profile?.audio_url ?? "");
  const [html, setHtml] = useState(profile?.sandbox_html ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_update_profile_extras", {
        p_social_links: { twitter, telegram, instagram, website },
        p_audio_url: audio,
        p_sandbox_html: html,
      });
      if (error) throw new Error(error.message === "premium_required" ? "Нужен FLOW Premium" : error.message);
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["profile"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick !rounded-[28px] border-0 bg-transparent p-0 sm:max-w-md">
        <div className="sheet-scroll relative z-10 p-5" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogTitle className="text-base font-semibold">Premium · Профиль</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">Настройте дополнительные возможности</p>

          <Section icon={Link2} title="Соцсети">
            {[
              { k: "twitter", v: twitter, set: setTwitter, ph: "https://x.com/..." },
              { k: "telegram", v: telegram, set: setTelegram, ph: "https://t.me/..." },
              { k: "instagram", v: instagram, set: setInstagram, ph: "https://instagram.com/..." },
              { k: "website", v: website, set: setWebsite, ph: "https://..." },
            ].map((f) => (
              <input
                key={f.k}
                value={f.v}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                className="lrf mb-2 w-full !rounded-2xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
              />
            ))}
          </Section>

          <Section icon={Music2} title="Аудио в профиле (MP3 URL)">
            <input
              value={audio}
              onChange={(e) => setAudio(e.target.value)}
              placeholder="https://.../track.mp3"
              className="lrf w-full !rounded-2xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {audio && <audio src={audio} controls className="mt-2 w-full" />}
          </Section>

          <Section icon={Code2} title="Песочница HTML">
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={6}
              placeholder="<h1>Hello FLOW</h1>"
              className="lrf w-full !rounded-2xl bg-transparent px-3 py-2 font-mono text-xs outline-none placeholder:text-muted-foreground/60"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Открывается в безопасном iframe на /sandbox/@{profile?.username}
            </p>
          </Section>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mercury mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-40"
          >
            <Save className="size-4" />
            Сохранить
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="size-3.5 text-eco" />
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
