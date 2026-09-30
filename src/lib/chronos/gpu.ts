import { HDR, views } from "./protocol";
import { ChronosScene } from "./scene";
import { startChronosInput } from "./input";
import { GFX_EVENT, readGraphics, type GraphicsSettings } from "@/lib/graphics";

/**
 * GPU layer bootstrap (main thread side).
 *
 * The main thread does three things and nothing else: create the canvas,
 * transfer control of it to the render worker, and stream raw input into the
 * shared ring buffer. All layout, compositing and painting of the glass layer
 * happens on the render thread.
 */

let gpuWorker: Worker | null = null;
let scene: ChronosScene | null = null;
let stopInput: (() => void) | null = null;

export function startChronosGPU(buffer: ArrayBufferLike) {
  if (typeof window === "undefined" || gpuWorker) return;
  let canvas = document.getElementById("chronos-canvas") as HTMLCanvasElement | null;
  if (!canvas || !canvas.transferControlToOffscreen) return;
  // A canvas can be transferred only once; replace it with a fresh clone on restart.
  if (canvas.dataset.transferred) {
    const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
    delete fresh.dataset.transferred;
    canvas.replaceWith(fresh);
    canvas = fresh;
  }
  canvas.dataset.transferred = "1";

  const v = views(buffer);
  v.i32[HDR.VIEW_W] = window.innerWidth;
  v.i32[HDR.VIEW_H] = window.innerHeight;
  v.i32[HDR.DPR] = Math.round(Math.min(window.devicePixelRatio || 1, 2) * 1000);

  stopInput = startChronosInput(buffer);
  scene = new ChronosScene(buffer);
  scene.start();

  const offscreen = canvas.transferControlToOffscreen();
  gpuWorker = new Worker(new URL("../../workers/chronos-gpu.worker.ts", import.meta.url), { type: "module" });
  gpuWorker.postMessage({ type: "init", buffer, canvas: offscreen }, [offscreen]);
  const updateOptics = (g: GraphicsSettings) => gpuWorker?.postMessage({ type: "optics", dispersion: g.chromaticAberration / 100, refraction: g.liquidRefraction / 100, lighting: g.realisticLighting / 100, reduced: g.reducedLight });
  updateOptics(readGraphics());
  const onGraphics = (event: Event) => updateOptics((event as CustomEvent<GraphicsSettings>).detail);
  window.addEventListener(GFX_EVENT, onGraphics);
  gpuWorker.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type === "gpu:ready") canvas.style.opacity = "1";
    if (e.data?.type === "gpu:unavailable") canvas.style.display = "none";
  });

  const onVisibility = () => gpuWorker?.postMessage({ type: document.hidden ? "pause" : "resume" });
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener(GFX_EVENT, onGraphics);
    stopChronosGPU();
  };
}

export function stopChronosGPU() {
  gpuWorker?.postMessage({ type: "stop" });
  gpuWorker?.terminate();
  gpuWorker = null;
  scene?.stop();
  scene = null;
  stopInput?.();
  stopInput = null;
}
