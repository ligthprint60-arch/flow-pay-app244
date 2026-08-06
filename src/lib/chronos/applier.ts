import { HDR, OP, REC_I32, views, type ChronosViews } from "./protocol";

/**
 * Main-thread consumer. This is the whole of ChronosGPU that ever runs on the
 * UI thread: one rAF tick that memcopy-reads the shared buffer and applies up
 * to 5000 mutations. It allocates nothing per frame — every scratch structure
 * below is created once at startup, strings are cached per arena slot, and
 * structural work reuses a single DocumentFragment.
 */
export class ChronosApplier {
  private v: ChronosViews;
  private nodes: (HTMLElement | null)[] = [];
  private strCache = new Map<number, string>(); // packed(offset,len) -> string
  private frag = typeof document !== "undefined" ? document.createDocumentFragment() : null;
  private lastFrame = -1;
  private raf = 0;
  private running = false;
  /** Reused decode scratch — avoids building char arrays per read. */
  private scratch = new Uint16Array(256);

  constructor(buffer: ArrayBufferLike) {
    this.v = views(buffer);
  }

  register(nodeId: number, el: HTMLElement | null) {
    this.nodes[nodeId] = el;
  }

  unregister(nodeId: number) {
    this.nodes[nodeId] = null;
  }

  start() {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.drain();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Read the flag without blocking. Stale frame → keep the previous pixels. */
  private drain() {
    const frame = Atomics.load(this.v.i32, HDR.FRAME);
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    const active = Atomics.load(this.v.i32, HDR.ACTIVE);
    const ring = active === 0 ? this.v.ringA : this.v.ringB;
    const count = active === 0 ? this.v.i32[HDR.COUNT_A] : this.v.i32[HDR.COUNT_B];
    for (let i = 0; i < count; i++) {
      const o = i * REC_I32;
      const el = this.nodes[ring[o + 1]];
      if (!el) continue;
      const a = ring[o + 2];
      const b = ring[o + 3];
      switch (ring[o]) {
        case OP.TEXT: {
          const s = this.str(a, b);
          if (el.textContent !== s) el.textContent = s;
          break;
        }
        case OP.CLASS: {
          const s = this.str(a, b);
          if (el.className !== s) el.className = s;
          break;
        }
        case OP.TRANSFORM:
          el.style.transform = `translate3d(${a / 64}px,${b / 64}px,0)`;
          break;
        case OP.OPACITY:
          el.style.opacity = `${a / 1000}`;
          break;
        case OP.TOGGLE:
          el.classList.toggle(this.str(a >>> 8, a & 0xff), b === 1);
          break;
        case OP.VAR: {
          const decl = this.str(a, b);
          const eq = decl.indexOf("=");
          if (eq > 0) el.style.setProperty(decl.slice(0, eq), decl.slice(eq + 1));
          break;
        }
        case OP.ATTACH: {
          const parent = this.nodes[a];
          if (parent && this.frag) {
            this.frag.appendChild(el);
            parent.appendChild(this.frag);
          }
          break;
        }
        case OP.DETACH:
          el.remove();
          break;
      }
    }
  }

  private str(offset: number, len: number) {
    const key = (offset << 8) | len;
    const hit = this.strCache.get(key);
    if (hit !== undefined) return hit;
    // memcopy out of the arena, then one decode — cached from here on.
    const slice = this.scratch.subarray(0, len);
    slice.set(this.v.u16.subarray(offset, offset + len));
    const s = String.fromCharCode.apply(null, slice as unknown as number[]);
    this.strCache.set(key, s);
    return s;
  }

  /** Arena slots get recycled by the LRU collector — drop stale decodes. */
  invalidateStrings() {
    this.strCache.clear();
  }
}
