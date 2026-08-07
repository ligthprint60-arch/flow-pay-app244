import { HDR, MAX_NODES, SOA, SOA_PLANES, markDirty, type ChronosViews } from "./protocol";

/**
 * Fixed-pool allocator over the SoA state region.
 *
 * Allocation and release are O(1) (free-list head pop / push), no JS object is
 * created per UI node, and every field write goes straight into the shared
 * binary planes the GPU thread reads. Writers mark an atomic dirty bit so the
 * renderer only touches changed ranges.
 */
export class SoaPool {
  private v: ChronosViews;
  private free: number[] = [];
  private next = 0;

  constructor(v: ChronosViews) {
    this.v = v;
  }

  alloc(): number {
    const id = this.free.length ? this.free.pop()! : this.next++;
    if (id >= MAX_NODES) return -1;
    const soa = this.v.soa;
    for (let p = 0; p < SOA_PLANES; p++) soa[p * MAX_NODES + id] = 0;
    if (id + 1 > this.v.i32[HDR.NODE_COUNT]) this.v.i32[HDR.NODE_COUNT] = id + 1;
    markDirty(this.v.i32, id);
    return id;
  }

  release(id: number) {
    if (id < 0) return;
    this.v.soa[SOA.A * MAX_NODES + id] = 0;
    this.v.soa[SOA.FLAGS * MAX_NODES + id] = 0;
    markDirty(this.v.i32, id);
    this.free.push(id);
  }

  /** Bulk write of one node's geometry + material. Pure memory stores. */
  write(
    id: number,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    r: number,
    g: number,
    b: number,
    a: number,
    glow: number,
    flags: number,
  ) {
    if (id < 0) return;
    const s = this.v.soa;
    s[SOA.X * MAX_NODES + id] = x;
    s[SOA.Y * MAX_NODES + id] = y;
    s[SOA.W * MAX_NODES + id] = w;
    s[SOA.H * MAX_NODES + id] = h;
    s[SOA.RADIUS * MAX_NODES + id] = radius;
    s[SOA.R * MAX_NODES + id] = r;
    s[SOA.G * MAX_NODES + id] = g;
    s[SOA.B * MAX_NODES + id] = b;
    s[SOA.A * MAX_NODES + id] = a;
    s[SOA.GLOW * MAX_NODES + id] = glow;
    s[SOA.FLAGS * MAX_NODES + id] = flags;
    markDirty(this.v.i32, id);
  }

  /** Speculative local feedback — applied by the main thread with no round-trip. */
  setGlow(id: number, glow: number) {
    if (id < 0) return;
    this.v.soa[SOA.GLOW * MAX_NODES + id] = glow;
    markDirty(this.v.i32, id);
  }
}
