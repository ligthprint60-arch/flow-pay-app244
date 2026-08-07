import { HDR, INPUT, INPUT_I32_BASE, INPUT_SLOTS, INPUT_SLOT_I32 } from "./protocol";

/**
 * Zero-latency input system.
 *
 * Pointer events are encoded straight into the shared ring buffer as raw
 * numbers — no JS event object is retained, nothing is allocated per event, and
 * every listener is passive so OS scrolling is never blocked. The write pointer
 * is bumped with a single Atomics.add; the render thread drains it lock-free.
 */
export function startChronosInput(buffer: ArrayBufferLike) {
  if (typeof window === "undefined") return () => {};
  const i32 = new Int32Array(buffer);
  const f32 = new Float32Array(buffer);

  const push = (type: number, x: number, y: number, pointerId: number) => {
    const w = Atomics.add(i32, HDR.IN_WRITE, 1);
    const slot = INPUT_I32_BASE + (w % INPUT_SLOTS) * INPUT_SLOT_I32;
    i32[slot] = type;
    f32[slot + 1] = x;
    f32[slot + 2] = y;
    i32[slot + 3] = pointerId | 0;
  };

  const onMove = (e: PointerEvent) => push(INPUT.MOVE, e.clientX, e.clientY, e.pointerId);
  const onDown = (e: PointerEvent) => push(INPUT.DOWN, e.clientX, e.clientY, e.pointerId);
  const onUp = (e: PointerEvent) => push(INPUT.UP, e.clientX, e.clientY, e.pointerId);
  const onWheel = (e: WheelEvent) => push(INPUT.WHEEL, e.deltaX, e.deltaY, 0);
  const onResize = () => {
    i32[HDR.VIEW_W] = window.innerWidth;
    i32[HDR.VIEW_H] = window.innerHeight;
    i32[HDR.DPR] = Math.round(window.devicePixelRatio * 1000);
    push(INPUT.RESIZE, window.innerWidth, window.innerHeight, 0);
  };

  onResize();
  const opts = { passive: true } as const;
  window.addEventListener("pointermove", onMove, opts);
  window.addEventListener("pointerdown", onDown, opts);
  window.addEventListener("pointerup", onUp, opts);
  window.addEventListener("wheel", onWheel, opts);
  window.addEventListener("resize", onResize, opts);
  window.addEventListener("scroll", onResize, opts);

  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onResize);
  };
}
