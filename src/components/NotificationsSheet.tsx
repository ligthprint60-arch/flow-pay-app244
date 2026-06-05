import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, BellRing, Megaphone } from "lucide-react";
import { useIsAdmin } from "@/lib/admin";
import { useState } from "react";
import { toast } from "sonner";

type Notif = { id: string; title: string; body: string; kind: string; created_at: string };

export function NotificationsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();

  const { data: items } = useQuery({
    queryKey: ["notifications"],
    enabled: open,
    queryFn: async (): Promise<Notif[]> => {
      const { data } = await supabase.from("notifications" as never)
        .select("*").order("created_at", { ascending: false }).limit(50);
      return (data as Notif[] | null) ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      supabase.rpc("app_mark_notifications_read" as never).then(() => {
        qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      });
    }
  }, [open, qc]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick !rounded-[28px] border-0 bg-transparent p-0 sm:max-w-md">
        <div className="relative z-10 p-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <BellRing className="size-4 text-eco" /> Уведомления
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">Объявления команды FLOW</p>

          {isAdmin && <AdminBroadcastForm />}

          <div className="sheet-scroll mt-4 space-y-2" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {(items ?? []).map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="lrf !rounded-2xl p-3"
              >
                <div className="flex items-center gap-2">
                  <Megaphone className="size-3.5 text-fiat" />
                  <p className="text-sm font-semibold">{n.title}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("ru-RU")}
                </p>
              </motion.div>
            ))}
            {items && items.length === 0 && (
              <div className="acrylic flex flex-col items-center gap-2 p-6 text-center">
                <Bell className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Пока нет уведомлений.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminBroadcastForm() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("app_admin_broadcast" as never, {
        p_title: title, p_body: body, p_kind: "info",
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Отправлено всем пользователям");
      setTitle(""); setBody("");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="lrf mt-4 !rounded-2xl p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fiat">Admin · Broadcast</p>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок"
        className="mt-2 w-full rounded-xl bg-white/[0.05] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
      />
      <textarea
        value={body} onChange={(e) => setBody(e.target.value)} rows={3}
        placeholder="Текст уведомления для всех пользователей"
        className="mt-2 w-full rounded-xl bg-white/[0.05] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60"
      />
      <button
        onClick={() => m.mutate()}
        disabled={!title.trim() || !body.trim() || m.isPending}
        className="mercury mt-2 flex h-9 w-full items-center justify-center rounded-xl text-xs font-semibold disabled:opacity-40"
      >
        {m.isPending ? "Отправляю…" : "Отправить всем"}
      </button>
    </div>
  );
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async (): Promise<number> => {
      const { data } = await supabase.rpc("app_unread_notifications_count" as never);
      return (data as number) ?? 0;
    },
    refetchInterval: 60_000,
  });
}
