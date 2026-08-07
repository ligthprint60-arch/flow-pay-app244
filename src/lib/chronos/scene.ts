import { HDR, MAX_NODES, SOA, views, type ChronosViews } from "./protocol";
import { SoaPool } from "./soa";

/**
 * Scene mirror.
 *
 * Every surface of the app that opts into ChronosGPU (`.lrf`, `[data-chronos]`)
 * is projected into the SoA planes: geometry, corner radius, tint and glow. The
 * GPU thread renders those primitives instanced, so the browser layout engine
 * is never asked to blur or composite them — it only keeps the text layer.
 *
 * The scan is amortised: geometry is re-measured at most every other frame and
 * only for elements currently intersecting the viewport.
 */

type Tracked = { el: HTMLElement; id: number };

export class ChronosScene {
  private v: ChronosViews;
  private pool: SoaPool;
  private tracked = new Map<HTMLElement, Tracked>();
  private visible = new Set<HTMLElement>();
  private io: IntersectionObserver | null = null;
  private mo: MutationObserver | null = null;
  private raf = 0;
  private tick = 0;
  private running = false;

  constructor(buffer: ArrayBufferLike) {
    this.v = views(buffer);
    this.pool = new SoaPool(this.v);
  }

  start() {
    if (this.running || typeof document === "undefined") return;
    this.running = true;

    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) this.visible.add(el);
          else {
            this.visible.delete(el);
            const t = this.tracked.get(el);
            if (t) this.v.soa[SOA.A * MAX_NODES + t.id] = 0;
          }
        }
      },
      { rootMargin: "20% 0px" },
    );

    this.scan();
    this.mo = new MutationObserver(() => this.scan());
    this.mo.observe(document.body, { childList: true, subtree: true });

    const loop = () => {
      if (!this.running) return;
      if ((this.tick++ & 1) === 0) this.sync();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.io?.disconnect();
    this.mo?.disconnect();
    for (const t of this.tracked.values()) this.pool.release(t.id);
    this.tracked.clear();
    this.visible.clear();
  }

  /** Discover new surfaces, retire detached ones. O(new nodes). */
  private scan() {
    const found = document.querySelectorAll<HTMLElement>(".lrf, [data-chronos]");
    for (const el of found) {
      if (this.tracked.has(el)) continue;
      const id = this.pool.alloc();
      if (id < 0) break;
      this.tracked.set(el, { el, id });
      this.io?.observe(el);
    }
    for (const [el, t] of this.tracked) {
      if (el.isConnected) continue;
      this.io?.unobserve(el);
      this.pool.release(t.id);
      this.tracked.delete(el);
      this.visible.delete(el);
    }
  }

  /** Project measured geometry into the shared planes. No allocations. */
  private sync() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.v.i32[HDR.DPR] = Math.round(dpr * 1000);
    this.v.i32[HDR.VIEW_W] = window.innerWidth;
    this.v.i32[HDR.VIEW_H] = window.innerHeight;
    for (const el of this.visible) {
      const t = this.tracked.get(el);
      if (!t) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        this.v.soa[SOA.A * MAX_NODES + t.id] = 0;
        continue;
      }
      const cs = getComputedStyle(el);
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      const hovered = el.matches(":hover") ? 1 : 0;
      const active = el.matches(":active") ? 1 : 0;
      this.pool.write(
        t.id,
        r.left,
        r.top,
        r.width,
        r.height,
        radius,
        1,
        1,
        1,
        0.06 + hovered * 0.05,
        0.35 + hovered * 0.45 + active * 0.2,
        1,
      );
    }
  }
}
