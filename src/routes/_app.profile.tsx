import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/theme";
import { useIsAdmin } from "@/lib/admin";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ShopDialog } from "@/components/Shop";
import { PremiumEditor } from "@/components/PremiumEditor";
import { fmt } from "@/lib/format";
import { AudioPlayer } from "@/components/AudioPlayer";
import { CustomEmojiCreator } from "@/components/CustomEmojiCreator";
import { useImageEmojis, buildImageEmojiMap } from "@/lib/emoji";
import { LogOut, BadgeCheck, ShoppingBag, Crown, Shield, Ban, Code2, ExternalLink, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Профиль — FLOW" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isAdmin = useIsAdmin();
  const [shopOpen, setShopOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const isPremium = !!profile?.premium_until && new Date(profile.premium_until) > new Date();

  const requestVerif = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_request_verification", { note: "Прошу синюю верификацию" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Заявка отправлена"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const applyAuthor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ is_author: true }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Статус автора активирован"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (profile?.display_name ?? "??").slice(0, 2).toUpperCase();
  const social = (profile?.social_links ?? {}) as Record<string, string>;

  return (
    <div className="px-5 pb-6 pt-12">
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Профиль</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Аккаунт</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lrf lrf-thick p-5">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar"
                 className="size-16 shrink-0 rounded-2xl object-cover ring-2 ring-eco/40 emissive-eco" />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-eco/60 to-fiat/40 font-mono text-lg font-bold emissive-eco">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-lg font-semibold">{profile?.display_name}</h2>
              <VerifiedBadge isVerified={profile?.is_verified} isAuthor={profile?.is_author} size={16} />
              {isPremium && <Crown className="size-4 text-eco" />}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{profile?.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        {profile?.is_blocked && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <Ban className="size-4" />
            Аккаунт ограничен модерацией.
          </div>
        )}

        {/* social links */}
        {Object.values(social).some(Boolean) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(social).filter(([, v]) => !!v).map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noreferrer"
                 className="lrf inline-flex items-center gap-1 !rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px]">
                <ExternalLink className="size-3" />{k}
              </a>
            ))}
          </div>
        )}

        {profile?.audio_url && (
          <div className="mt-3">
            <AudioPlayer src={profile.audio_url} title={`${profile.display_name} · трек`} />
          </div>
        )}

        {profile?.sandbox_html && (
          <Link to="/sandbox/$username" params={{ username: profile.username }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-fiat hover:underline">
            <Code2 className="size-3.5" />Открыть мою песочницу
          </Link>
        )}
      </motion.div>

      {/* Quick actions */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShopOpen(true)}
          className="lrf lrf-tap flex items-center gap-2 !rounded-3xl p-4 text-left">
          <div className="grid size-10 place-items-center rounded-2xl bg-eco/20 emissive-eco">
            <ShoppingBag className="size-5 text-eco" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">FLOW Shop</p>
            <p className="truncate text-[10px] text-muted-foreground">скины · эмодзи · premium</p>
          </div>
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => isPremium ? setEditorOpen(true) : setShopOpen(true)}
          className="lrf lrf-tap flex items-center gap-2 !rounded-3xl p-4 text-left">
          <div className="grid size-10 place-items-center rounded-2xl bg-fiat/20 emissive-blue">
            {isPremium ? <Settings2 className="size-5 text-fiat" /> : <Crown className="size-5 text-fiat" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{isPremium ? "Premium · настройки" : "Premium"}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {isPremium ? "соцсети · аудио · песочница" : "разблокировать"}
            </p>
          </div>
        </motion.button>
      </div>

      {isAdmin && (
        <Link to="/admin" className="lrf lrf-tap mt-3 flex w-full items-center justify-between !rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-fiat/20 emissive-blue">
              <Shield className="size-5 text-fiat" />
            </div>
            <div>
              <p className="text-sm font-semibold">Admin Panel</p>
              <p className="text-xs text-muted-foreground">Treasury, верификация, блокировки</p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-fiat">root</span>
        </Link>
      )}

      {!profile?.is_verified && (
        <button
          onClick={() => requestVerif.mutate()}
          disabled={requestVerif.isPending || profile?.verification_requested}
          className="lrf lrf-tap mt-3 flex w-full items-center justify-between !rounded-3xl p-4 text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-fiat/20 emissive-blue">
              <BadgeCheck className="size-5 text-fiat" />
            </div>
            <div>
              <p className="text-sm font-semibold">Синяя верификация</p>
              <p className="text-xs text-muted-foreground">
                {profile?.verification_requested ? "Заявка на рассмотрении" : "Для известных персон — подать заявку"}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-fiat">
            {profile?.verification_requested ? "pending" : "apply"}
          </span>
        </button>
      )}

      <div className="lrf mt-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="rFLOW" value={fmt(wallet?.rflow_balance ?? 0)} accent="fiat" />
          <Stat label="Active" value={fmt(wallet?.fflow_active ?? 0)} accent="eco" />
          <Stat label="Pending" value={fmt(wallet?.fflow_pending ?? 0)} accent="warning" />
        </div>
      </div>

      {!profile?.is_author && (
        <button
          onClick={() => applyAuthor.mutate()} disabled={applyAuthor.isPending}
          className="lrf lrf-tap mt-3 flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-eco/20 emissive-eco">
              <BadgeCheck className="size-5 text-eco" />
            </div>
            <div>
              <p className="text-sm font-semibold">Стать автором</p>
              <p className="text-xs text-muted-foreground">Публикуйте контент о финансах</p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-eco">demo</span>
        </button>
      )}

      <button
        onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
        className="mt-6 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-destructive hover:bg-destructive/10"
      >
        <LogOut className="size-4" />
        <span>Выйти</span>
      </button>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        FLOW · v0.4 · FLDS 3.0 Luminous Glass
      </p>

      <ShopDialog open={shopOpen} onOpenChange={setShopOpen} />
      <PremiumEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: "fiat" | "eco" | "warning" }) {
  const cls = accent === "fiat" ? "text-fiat" : accent === "eco" ? "text-eco" : "text-warning";
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-bold tabular ${cls}`}>{value}</p>
    </div>
  );
}
