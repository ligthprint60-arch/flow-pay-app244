import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useGraphics, type GraphicsSettings as Gfx } from "@/lib/graphics";
import { useI18n } from "@/lib/i18n";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GraphicsSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  const { gfx, update, setPreset, reset } = useGraphics();

  const presets: Gfx["preset"][] = ["low", "balanced", "ultra", "custom"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lrf lrf-thick !rounded-[28px] border-0 bg-transparent p-0 sm:max-w-md">
        <div className="relative z-10 p-5">
          <DialogTitle className="text-base font-semibold">{t("gfx.title")}</DialogTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("gfx.subtitle")}</p>

          <div className="sheet-scroll mt-4 space-y-3" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <div className="lrf !rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("gfx.preset")}</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {presets.map((p) => (
                  <Button
                    key={p}
                    variant="ghost"
                    onClick={() => setPreset(p)}
                    aria-pressed={gfx.preset === p}
                    className={`rounded-xl px-2 py-2 text-[10.5px] font-semibold transition-colors ${
                      gfx.preset === p ? "bg-eco/25 text-eco" : "bg-surface text-muted-foreground"
                    }`}
                  >
                    {t(`gfx.preset.${p}`)}
                  </Button>
                ))}
              </div>
            </div>

            <SliderRow label={t("gfx.blur")} value={gfx.blur} min={0} max={48} step={2} suffix="px"
              onChange={(v) => update({ blur: v })} />
            <SliderRow label={t("gfx.saturation")} value={gfx.saturation} min={100} max={260} step={5} suffix="%"
              onChange={(v) => update({ saturation: v })} />
            <SliderRow label={t("gfx.fluidOpacity")} value={gfx.fluidOpacity} min={0} max={100} step={5} suffix="%"
              onChange={(v) => update({ fluidOpacity: v })} />
            <SliderRow label={t("gfx.fps")} value={gfx.fps} min={15} max={60} step={5} suffix="fps"
              onChange={(v) => update({ fps: v })} />
            <SliderRow label={t("gfx.chromaticAberration")} value={gfx.chromaticAberration} min={0} max={100} step={1} suffix="%"
              onChange={(v) => update({ chromaticAberration: v })} />
            <SliderRow label={t("gfx.liquidRefraction")} value={gfx.liquidRefraction} min={0} max={100} step={1} suffix="%"
              onChange={(v) => update({ liquidRefraction: v })} />
            <SliderRow label={t("gfx.realisticLighting")} value={gfx.realisticLighting} min={0} max={100} step={1} suffix="%"
              onChange={(v) => update({ realisticLighting: v })} />

            <div className="lrf !rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("gfx.lightLevel")}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {(["static", "dynamic", "photonic"] as const).map((name, i) => (
                  <Button key={name} variant="ghost" onClick={() => update({ lightLevel: i as 0 | 1 | 2 })}
                    aria-pressed={gfx.lightLevel === i}
                    className={`rounded-xl px-2 py-2 text-[10.5px] font-semibold ${gfx.lightLevel === i ? "bg-eco/25 text-eco" : "bg-surface text-muted-foreground"}`}>
                    {t(`gfx.light.${name}`)}
                  </Button>
                ))}
              </div>
            </div>
            <ToggleRow label={t("gfx.reducedLight")} value={gfx.reducedLight} onChange={(v) => update({ reducedLight: v })} />
            <ToggleRow label={t("gfx.fluid")} value={gfx.fluid} onChange={(v) => update({ fluid: v })} />
            <ToggleRow label={t("gfx.glassAnim")} value={gfx.glassAnim} onChange={(v) => update({ glassAnim: v })} />
            <ToggleRow label={t("gfx.caustics")} value={gfx.caustics} onChange={(v) => update({ caustics: v })} />
            <ToggleRow label={t("gfx.motion")} value={gfx.motion} onChange={(v) => update({ motion: v })} />
            <ToggleRow label={t("gfx.shadows")} value={gfx.shadows} onChange={(v) => update({ shadows: v })} />

            <Button variant="ghost" onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-surface px-3 py-2 text-[11px] font-semibold">
              <RotateCcw className="size-3.5" /> {t("common.reset")}
            </Button>
            <p className="px-1 pb-1 text-[10.5px] leading-relaxed text-muted-foreground">{t("gfx.hint")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SliderRow({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="lrf !rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-semibold">{label}</p>
        <span className="tabular font-mono text-[11px] text-eco">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label} className="gfx-range mt-2 w-full"
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="lrf flex items-center justify-between !rounded-2xl p-3">
      <p className="text-[12.5px] font-semibold">{label}</p>
      <Button variant="ghost"
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full p-0 transition-colors ${value ? "bg-eco/60" : "bg-surface-2"}`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className={`absolute top-0.5 size-5 rounded-full bg-foreground shadow ${value ? "left-[22px]" : "left-0.5"}`}
        />
      </Button>
    </div>
  );
}
