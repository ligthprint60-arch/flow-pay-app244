import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Pin, PinOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SECTIONS, MAX_PINNED, usePinnedSections } from "@/lib/sections";

export function SectionsWindow({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { pinned, toggle } = usePinnedSections();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick max-w-[420px] border-0 p-0">
        <div className="sheet-scroll max-h-[70svh] overflow-y-auto p-5">
          <DialogHeader className="mb-4 text-left">
            <DialogTitle className="text-base">Разделы</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Закрепите до {MAX_PINNED} разделов в нижней панели
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2.5">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon;
              const isPinned = pinned.includes(s.id);
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 380, damping: 30 }}
                  className="lrf relative p-3"
                >
                  <Link
                    to={s.to}
                    onClick={() => onOpenChange(false)}
                    className="lrf-tap flex flex-col gap-2"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-eco/30 to-fiat/20">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="text-sm font-semibold leading-none">{s.label}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">{s.desc}</span>
                  </Link>
                  <button
                    onClick={() => toggle(s.id)}
                    aria-label={isPinned ? "Открепить" : "Закрепить"}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-foreground/10 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
