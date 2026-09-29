import { useEffect, useRef } from "react";
import { GFX_EVENT, readGraphics, type GraphicsSettings } from "@/lib/graphics";

type LightTone = "neutral" | "success" | "warning" | "error";

function toneFor(element: Element | null): LightTone {
  if (!element) return "neutral";
  if (element.closest("[data-light-tone='success'], [data-sonner-toast][data-type='success']")) return "success";
  if (element.closest("[data-light-tone='warning'], [data-sonner-toast][data-type='warning']")) return "warning";
  if (element.closest("[data-light-tone='error'], [data-sonner-toast][data-type='error']")) return "error";
  return "neutral";
}

export function LightField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const field = fieldRef.current;
    if (!field) return;

    let gfx: GraphicsSettings = readGraphics();
    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let activeSurface: HTMLElement | null = null;

    const illuminate = (target: Element | null, clientX: number, clientY: number) => {
      const surface = target?.closest<HTMLElement>(".lrf, .light-control, .mercury, .light-input, input, textarea");
      if (activeSurface && activeSurface !== surface) activeSurface.removeAttribute("data-lit");
      activeSurface = surface ?? null;
      if (!surface || gfx.lightLevel === 0 || gfx.reducedLight) return;
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty("--hit-x", `${clientX - rect.left}px`);
      surface.style.setProperty("--hit-y", `${clientY - rect.top}px`);
      surface.style.setProperty("--hit-nx", `${Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)))}`);
      surface.style.setProperty("--hit-ny", `${Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)))}`);
      surface.setAttribute("data-lit", "");
    };

    const paint = () => {
      frame = 0;
      root.style.setProperty("--light-x", `${x}px`);
      root.style.setProperty("--light-y", `${y}px`);
    };

    const point = (clientX: number, clientY: number) => {
      if (gfx.reducedLight || gfx.lightLevel === 0) return;
      x = clientX;
      y = clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const pulse = (clientX: number, clientY: number, tone: LightTone = "neutral", small = false) => {
      if (gfx.reducedLight || gfx.lightLevel === 0) return;
      const node = document.createElement("span");
      node.className = `light-pulse light-pulse-${tone}${small ? " light-pulse-small" : ""}`;
      node.style.left = `${clientX}px`;
      node.style.top = `${clientY}px`;
      field.appendChild(node);
      node.addEventListener("animationend", () => node.remove(), { once: true });
    };

    const onPointerMove = (event: PointerEvent) => {
      point(event.clientX, event.clientY);
      illuminate(event.target instanceof Element ? event.target : null, event.clientX, event.clientY);
    };
    const onPointerDown = (event: PointerEvent) => {
      point(event.clientX, event.clientY);
      const target = event.target instanceof Element ? event.target : null;
      illuminate(target, event.clientX, event.clientY);
      if (target?.closest("button, a, [role='button'], [data-light-source]")) {
        const source = target.closest<HTMLElement>(".lrf, .light-control, .mercury, [data-light-source]");
        if (source) {
          source.style.setProperty("--strike-x", `${event.clientX - source.getBoundingClientRect().left}px`);
          source.style.setProperty("--strike-y", `${event.clientY - source.getBoundingClientRect().top}px`);
          source.removeAttribute("data-struck");
          // Force a new strike only on the actual interacted surface, not every panel.
          void source.offsetWidth;
          source.setAttribute("data-struck", "");
          window.setTimeout(() => source.removeAttribute("data-struck"), 650);
        }
        pulse(event.clientX, event.clientY, toneFor(target));
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      point(rect.left + Math.min(rect.width * 0.72, rect.width - 12), rect.top + rect.height / 2);
      illuminate(target, rect.left + rect.width * 0.72, rect.top + rect.height / 2);
      target.closest(".lrf")?.classList.add("light-focus-within");
    };
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      target?.closest(".lrf")?.classList.remove("light-focus-within");
    };
    const onInput = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.matches("input, textarea")) return;
      const rect = target.getBoundingClientRect();
      pulse(rect.right - 18, rect.top + rect.height / 2, "neutral", true);
    };
    const onGraphics = (event: Event) => {
      gfx = (event as CustomEvent<GraphicsSettings>).detail;
      if (gfx.reducedLight || gfx.lightLevel === 0) activeSurface?.removeAttribute("data-lit");
    };
    const onPointerLeave = () => { activeSurface?.removeAttribute("data-lit"); activeSurface = null; };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("input", onInput, { passive: true });
    window.addEventListener(GFX_EVENT, onGraphics);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerleave", onPointerLeave);
      activeSurface?.removeAttribute("data-lit");
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("input", onInput);
      window.removeEventListener(GFX_EVENT, onGraphics);
    };
  }, []);

  return (
    <div ref={fieldRef} className="light-field" aria-hidden>
      <span className="light-field-ambient" />
      <span className="light-field-point" />
      <span className="light-field-beam" />
    </div>
  );
}
