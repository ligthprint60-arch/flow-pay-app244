import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile, ACCENTS, SKINS } from "@/lib/theme";
import { CUSTOM_EMOJIS } from "@/lib/emoji";
import { Check, Palette, Layers, Smile, Crown, Lock } from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/format";

type Tab = "accents" | "skins" | "emojis" | "premium";

export function ShopDialog({ open, onOpenChange, initial = "accents" as Tab }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const isPremium = !!profile?.premium_until && new Date(profile.premium_until) > new Date();

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const buyCustom = useMutation({
    mutationFn: async (args: { type: "accent" | "skin"; id: string; cost: number }) => {
      const { error } = await supabase.rpc("app_purchase_customization", {
        item_type: args.type, item_id: args.id, cost: args.cost,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Применено"); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const buyEmoji = useMutation({
    mutationFn: async (args: { id: string; cost: number }) => {
      const { error } = await supabase.rpc("app_purchase_emoji", {
        emoji_id: args.id, cost: args.cost, currency: "fflow",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("Эмодзи разблокирован"); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const subscribe = useMutation({
    mutationFn: async (args: { currency: "fflow" | "rflow"; months: number }) => {
      const { error } = await supabase.rpc("app_subscribe_premium", args);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("FLOW Premium активирован"); inv(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownedAccents: string[] = profile?.owned_accents ?? ["emerald"];
  const ownedSkins: string[] = profile?.owned_skins ?? ["default"];
  const ownedEmojis: string[] = profile?.owned_emojis ?? [];

  const tabs: { id: Tab; icon: typeof Palette; label: string }[] = [
    { id: "accents", icon: Palette, label: "Цвета" },
    { id: "skins", icon: Layers, label: "Скины" },
    { id: "emojis", icon: Smile, label: "Эмодзи" },
    { id: "premium", icon: Crown, label: "Premium" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick !rounded-[28px] border-0 bg-transparent p-0 sm:max-w-md">
        <div className="relative z-10 p-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            FLOW Shop
            {isPremium && (
              <span className="rounded-full bg-gradient-to-r from-eco/40 to-fiat/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest emissive-eco">
                Premium
              </span>
            )}
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Баланс · <span className="text-eco tabular">{fmt(wallet?.fflow_active ?? 0)} fFLOW</span>
            {" · "}
            <span className="text-fiat tabular">{fmt(wallet?.rflow_balance ?? 0)} rFLOW</span>
          </p>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-2xl bg-white/[0.05] p-1">
            {tabs.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="relative flex-1 rounded-xl px-2 py-2 text-[11px] font-medium"
                >
                  {active && (
                    <motion.span
                      layoutId="shop-tab"
                      className="absolute inset-0 rounded-xl bg-gradient-to-br from-eco/40 to-fiat/30 emissive-eco"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-1.5">
                    <Icon className="size-3.5" />
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sheet-scroll mt-4 -mx-1 px-1" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {tab === "accents" && (
                  <div className="grid grid-cols-3 gap-2">
                    {ACCENTS.map((a) => {
                      const owned = ownedAccents.includes(a.id);
                      const active = profile?.accent_theme === a.id;
                      const disabled = buyCustom.isPending || (!owned && (wallet?.fflow_active ?? 0) < a.price);
                      return (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          key={a.id}
                          onClick={() => buyCustom.mutate({ type: "accent", id: a.id, cost: owned ? 0 : a.price })}
                          disabled={disabled}
                          className={`lrf !rounded-2xl p-3 text-left disabled:opacity-40 ${active ? "emissive-eco" : ""}`}
                        >
                          <div
                            className="h-10 w-full rounded-xl"
                            style={{ background: `linear-gradient(135deg, ${a.eco}, ${a.fiat})`, boxShadow: `0 8px 24px -6px ${a.ecoGlow}` }}
                          />
                          <div className="mt-2 flex items-center justify-between">
                            <span className="truncate text-[11px] font-medium">{a.name.split(" ")[0]}</span>
                            {active ? <Check className="size-3.5 text-eco" /> :
                              owned ? <span className="font-mono text-[9px] text-muted-foreground">owned</span> :
                              <span className="font-mono text-[10px] tabular text-eco">{a.price}f</span>}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {tab === "skins" && (
                  <div className="grid grid-cols-2 gap-2">
                    {SKINS.map((s) => {
                      const owned = ownedSkins.includes(s.id);
                      const active = profile?.card_skin === s.id;
                      const disabled = buyCustom.isPending || (!owned && (wallet?.fflow_active ?? 0) < s.price);
                      return (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          key={s.id}
                          onClick={() => buyCustom.mutate({ type: "skin", id: s.id, cost: owned ? 0 : s.price })}
                          disabled={disabled}
                          className={`lrf ${s.className} !rounded-2xl p-3 text-left disabled:opacity-40 ${active ? "emissive-eco" : ""}`}
                        >
                          <div className="h-14 w-full rounded-xl" />
                          <div className="mt-2 flex items-center justify-between">
                            <span className="truncate text-[11px] font-medium">{s.name}</span>
                            {active ? <Check className="size-3.5 text-eco" /> :
                              owned ? <span className="font-mono text-[9px] text-muted-foreground">owned</span> :
                              <span className="font-mono text-[10px] tabular text-eco">{s.price}f</span>}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {tab === "emojis" && (
                  <div className="grid grid-cols-3 gap-2">
                    {CUSTOM_EMOJIS.map((e) => {
                      const owned = ownedEmojis.includes(e.id);
                      const lockedPremium = e.premium && !isPremium;
                      const disabled = buyEmoji.isPending || lockedPremium || (!owned && (wallet?.fflow_active ?? 0) < e.price);
                      return (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          key={e.id}
                          onClick={() => !owned && buyEmoji.mutate({ id: e.id, cost: e.price })}
                          disabled={disabled || owned}
                          className={`lrf !rounded-2xl p-3 text-center disabled:opacity-40 ${owned ? "emissive-eco" : ""}`}
                        >
                          <div className="text-3xl">{e.char}</div>
                          <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                            <span className="font-mono">:{e.id}:</span>
                          </div>
                          <div className="mt-0.5 text-[10px]">
                            {owned ? <span className="text-eco">owned</span> :
                              lockedPremium ? <span className="inline-flex items-center gap-1 text-fiat"><Lock className="size-3" />premium</span> :
                              <span className="font-mono tabular text-eco">{e.price}f</span>}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {tab === "premium" && (
                  <div className="space-y-3">
                    <div className="lrf overflow-hidden !rounded-2xl p-4 emissive-eco">
                      <div className="flex items-center gap-2">
                        <Crown className="size-4 text-eco" />
                        <h3 className="text-sm font-semibold">FLOW Premium</h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ссылки на соцсети · аудио в профиле · песочница HTML · премиум-эмодзи
                      </p>
                      {isPremium && (
                        <p className="mt-2 font-mono text-[10px] text-eco">
                          активен до {new Date(profile!.premium_until!).toLocaleDateString("ru-RU")}
                        </p>
                      )}
                    </div>

                    {[
                      { months: 1, label: "1 месяц" },
                      { months: 3, label: "3 месяца" },
                      { months: 12, label: "1 год" },
                    ].map((p) => (
                      <div key={p.months} className="lrf flex items-center justify-between !rounded-2xl p-3">
                        <div>
                          <p className="text-sm font-semibold">{p.label}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {fmt(p.months * 1200)} fFLOW · {fmt(p.months * 49000)} rFLOW
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            disabled={subscribe.isPending || (wallet?.fflow_active ?? 0) < p.months * 1200}
                            onClick={() => subscribe.mutate({ currency: "fflow", months: p.months })}
                            className="rounded-full bg-eco/20 px-3 py-1.5 text-[11px] font-semibold text-eco emissive-eco disabled:opacity-40"
                          >fFLOW</motion.button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            disabled={subscribe.isPending || (wallet?.rflow_balance ?? 0) < p.months * 49000}
                            onClick={() => subscribe.mutate({ currency: "rflow", months: p.months })}
                            className="rounded-full bg-fiat/20 px-3 py-1.5 text-[11px] font-semibold text-fiat emissive-blue disabled:opacity-40"
                          >rFLOW</motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
