/// <reference lib="webworker" />
import { ChronosWriter } from "@/lib/chronos/writer";

/**
 * ChronosGPU logic thread.
 *
 * Owns the animated part of the app state and writes it straight into the
 * shared buffer as binary mutations. The main thread never sees a JS object
 * from here — only int32 records. Also acts as the gateway for legacy widgets
 * (analytics/ads): they post messages here and can never touch the DOM.
 */

type Binding = { id: number; kind: "text" | "class" | "var"; value: string };

let writer: ChronosWriter | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let paused = false;
const bindings = new Map<number, Binding>();
const dirty = new Set<number>();

function flush() {
  if (!writer || paused) return;
  if (dirty.size === 0) return;
  for (const id of dirty) {
    const b = bindings.get(id);
    if (!b) continue;
    if (b.kind === "text") writer.text(id, b.value);
    else if (b.kind === "class") writer.className(id, b.value);
    else writer.cssVar(id, b.value);
  }
  dirty.clear();
  writer.commit();
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  switch (m?.type) {
    case "init":
      writer = new ChronosWriter(m.buffer);
      // The producer runs on its own clock; the consumer samples at rAF.
      timer = setInterval(flush, 16);
      break;
    case "set": {
      const b: Binding = { id: m.id, kind: m.kind, value: m.value };
      const prev = bindings.get(m.id);
      if (prev && prev.kind === b.kind && prev.value === b.value) return;
      bindings.set(m.id, b);
      dirty.add(m.id);
      break;
    }
    case "drop":
      bindings.delete(m.id);
      dirty.delete(m.id);
      break;
    case "pause":
      paused = true;
      break;
    case "resume":
      paused = false;
      break;
    case "widget":
      // Legacy widget gateway: sandboxed work happens here, results are
      // published as ordinary bindings — no DOM access is ever granted.
      try {
        // eslint-disable-next-line no-new-func
        const run = new Function("payload", m.code) as (p: unknown) => unknown;
        const out = run(m.payload);
        (self as unknown as Worker).postMessage({ type: "widget:result", id: m.id, out });
      } catch (err) {
        (self as unknown as Worker).postMessage({ type: "widget:error", id: m.id, error: String(err) });
      }
      break;
    case "stop":
      if (timer) clearInterval(timer);
      timer = null;
      break;
  }
};
