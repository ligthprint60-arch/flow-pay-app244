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

    const onPointerMove = (event: PointerEvent) => point(event.clientX, event.clientY);
    const onPointerDown = (event: PointerEvent) => {
      point(event.clientX, event.clientY);
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button, a, [role='button'], [data-light-source]")) {
        pulse(event.clientX, event.clientY, toneFor(target));
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      point(rect.left + Math.min(rect.width * 0.72, rect.width - 12), rect.top + rect.height / 2);
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
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("input", onInput, { passive: true });
    window.addEventListener(GFX_EVENT, onGraphics);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
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
