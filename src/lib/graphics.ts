import { useCallback, useEffect, useState } from "react";

export type GraphicsSettings = {
  preset: "low" | "balanced" | "ultra" | "custom";
  blur: number;          // px of backdrop blur
  saturation: number;    // % of backdrop saturation
  fluid: boolean;        // WebGL fluid background
  fluidOpacity: number;  // 0..100
  glassAnim: boolean;    // specular / edge animations
  caustics: boolean;     // body grain + caustics layer
  motion: boolean;       // framer-motion / css transitions
  shadows: boolean;      // deep inner shadows and glows
  fps: number;           // background fps cap
  lightLevel: 0 | 1 | 2; // static, dynamic, photonic
  reducedLight: boolean; // suppress pulses, trails and intense bloom
};

const KEY = "flow.gfx.v1";
const EVT = "flow-gfx-change";

export const PRESETS: Record<"low" | "balanced" | "ultra", Omit<GraphicsSettings, "preset">> = {
  low:      { blur: 8,  saturation: 115, fluid: false, fluidOpacity: 16, glassAnim: false, caustics: false, motion: false, shadows: false, fps: 24, lightLevel: 0, reducedLight: true },
  balanced: { blur: 20, saturation: 145, fluid: true,  fluidOpacity: 30, glassAnim: true,  caustics: false, motion: true,  shadows: true,  fps: 30, lightLevel: 1, reducedLight: false },
  ultra:    { blur: 30, saturation: 165, fluid: true,  fluidOpacity: 48, glassAnim: true,  caustics: true,  motion: true,  shadows: true,  fps: 60, lightLevel: 2, reducedLight: false },
};

export const DEFAULT_GFX: GraphicsSettings = { preset: "balanced", ...PRESETS.balanced };

export function readGraphics(): GraphicsSettings {
  if (typeof window === "undefined") return DEFAULT_GFX;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_GFX;
    return { ...DEFAULT_GFX, ...(JSON.parse(raw) as Partial<GraphicsSettings>) };
  } catch {
    return DEFAULT_GFX;
  }
}

/** Applies the settings to CSS custom properties and document-level flags. */
export function applyGraphics(g: GraphicsSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--glass-blur", `${g.blur}px`);
  root.style.setProperty("--glass-sat", `${g.saturation}%`);
  root.style.setProperty("--fluid-opacity", String(g.fluidOpacity / 100));
  root.classList.toggle("gfx-no-fluid", !g.fluid);
  root.classList.toggle("gfx-no-glass-anim", !g.glassAnim);
  root.classList.toggle("gfx-no-caustics", !g.caustics);
  root.classList.toggle("gfx-no-motion", !g.motion);
  root.classList.toggle("gfx-no-shadows", !g.shadows);
  root.classList.toggle("light-static", g.lightLevel === 0);
  root.classList.toggle("light-dynamic", g.lightLevel === 1);
  root.classList.toggle("light-photonic", g.lightLevel === 2);
  root.classList.toggle("reduced-light", g.reducedLight);
  window.dispatchEvent(new CustomEvent(EVT, { detail: g }));
}

export function writeGraphics(g: GraphicsSettings) {
  try { window.localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* ignore */ }
  applyGraphics(g);
}

export function useGraphics() {
  const [gfx, setGfx] = useState<GraphicsSettings>(DEFAULT_GFX);

  useEffect(() => {
    const initial = readGraphics();
    setGfx(initial);
    applyGraphics(initial);
    const onChange = (e: Event) => setGfx((e as CustomEvent<GraphicsSettings>).detail);
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const update = useCallback((patch: Partial<GraphicsSettings>) => {
    setGfx((prev) => {
      const next: GraphicsSettings = { ...prev, ...patch };
      if (!("preset" in patch)) next.preset = "custom";
      writeGraphics(next);
      return next;
    });
  }, []);

  const setPreset = useCallback((p: GraphicsSettings["preset"]) => {
    if (p === "custom") { update({ preset: "custom" }); return; }
    const next: GraphicsSettings = { preset: p, ...PRESETS[p] };
    setGfx(next);
    writeGraphics(next);
  }, [update]);

  const reset = useCallback(() => { setGfx(DEFAULT_GFX); writeGraphics(DEFAULT_GFX); }, []);

  return { gfx, update, setPreset, reset };
}

export const GFX_EVENT = EVT;
