import { ChronosApplier } from "./applier";
import { ChronosWriter } from "./writer";
import { createChronosBuffer } from "./protocol";

/**
 * Client runtime: wires the producer (worker when the page is cross-origin
 * isolated, main thread otherwise) to the single rAF applier.
 *
 * Any component binds a DOM node with `bind()` and pushes values with
 * `setText` / `setClass` / `setVar`; the value travels through the binary
 * buffer instead of React state, so high-frequency updates never re-render.
 */

let applier: ChronosApplier | null = null;
let worker: Worker | null = null;
let local: ChronosWriter | null = null;
let nextId = 1;
let started = false;
let sharedMode = false;

function ensure() {
  if (started || typeof window === "undefined") return;
  started = true;

  const { buffer, shared } = createChronosBuffer();
  sharedMode = shared;
  applier = new ChronosApplier(buffer);
  applier.start();

  if (shared) {
    worker = new Worker(new URL("../../workers/chronos.worker.ts", import.meta.url), { type: "module" });
    worker.postMessage({ type: "init", buffer });
    const onVisibility = () => worker?.postMessage({ type: document.hidden ? "pause" : "resume" });
    document.addEventListener("visibilitychange", onVisibility);
  } else {
    // No SharedArrayBuffer (COOP/COEP not enabled): identical protocol, the
    // producer just lives on this thread. Apply path stays allocation-free.
    local = new ChronosWriter(buffer);
  }
}

export function startChronos() {
  ensure();
  return () => {
    applier?.stop();
    worker?.postMessage({ type: "stop" });
    worker?.terminate();
    worker = null;
    applier = null;
    local = null;
    started = false;
  };
}

export function chronosIsShared() {
  return sharedMode;
}

export function allocNodeId() {
  ensure();
  return nextId++;
}

export function bind(id: number, el: HTMLElement | null) {
  ensure();
  applier?.register(id, el);
}

export function unbind(id: number) {
  applier?.unregister(id);
  worker?.postMessage({ type: "drop", id });
}

function push(id: number, kind: "text" | "class" | "var", value: string) {
  ensure();
  if (worker) {
    worker.postMessage({ type: "set", id, kind, value });
    return;
  }
  if (!local) return;
  if (kind === "text") local.text(id, value);
  else if (kind === "class") local.className(id, value);
  else local.cssVar(id, value);
  local.commit();
}

export const setText = (id: number, value: string) => push(id, "text", value);
export const setClass = (id: number, value: string) => push(id, "class", value);
export const setVar = (id: number, name: string, value: string) => push(id, "var", `${name}=${value}`);

/** Run untrusted/legacy widget code inside the worker sandbox. */
export function runSandboxed(code: string, payload?: unknown): Promise<unknown> {
  ensure();
  if (!worker) return Promise.reject(new Error("chronos: sandbox requires cross-origin isolation"));
  const id = allocNodeId();
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker?.removeEventListener("message", onMsg);
      if (e.data.type === "widget:result") resolve(e.data.out);
      else reject(new Error(e.data.error));
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ type: "widget", id, code, payload });
  });
}
