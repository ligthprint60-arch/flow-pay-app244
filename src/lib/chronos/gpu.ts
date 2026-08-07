import { HDR, views } from "./protocol";
import { ChronosScene } from "./scene";
import { startChronosInput } from "./input";

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
  const canvas = document.getElementById("chronos-canvas") as HTMLCanvasElement | null;
  if (!canvas || !canvas.transferControlToOffscreen) return;

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
  gpuWorker.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type === "gpu:ready") canvas.style.opacity = "1";
    if (e.data?.type === "gpu:unavailable") canvas.style.display = "none";
  });

  const onVisibility = () => gpuWorker?.postMessage({ type: document.hidden ? "pause" : "resume" });
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
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
