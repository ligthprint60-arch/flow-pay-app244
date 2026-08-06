import { ARENA_U16, HDR, type ChronosViews } from "./protocol";

/**
 * Micro-allocator for the string arena with an LRU reclaim pass.
 *
 * The arena is a bump allocator: writing a string is a memcopy of UTF-16 code
 * units, no JS object is created. Identical strings (the common case — class
 * lists, labels, formatted amounts) are interned, so repeated frames reuse the
 * same slot and write nothing at all.
 *
 * When the bump pointer approaches the end, the least-recently-used interned
 * slots are dropped and the arena is compacted from the live set. This is what
 * keeps a long-lived SAB from leaking.
 */
export class ArenaAllocator {
  private v: ChronosViews;
  private intern = new Map<string, number>(); // value -> packed (offset<<8|len)
  private used = new Map<string, number>(); // value -> last frame touched
  private frame = 0;

  constructor(v: ChronosViews) {
    this.v = v;
  }

  setFrame(f: number) {
    this.frame = f;
  }

  /** Returns [offset, length] of the string inside the arena. */
  write(s: string): [number, number] {
    const str = s.length > 255 ? s.slice(0, 255) : s;
    const hit = this.intern.get(str);
    if (hit !== undefined) {
      this.used.set(str, this.frame);
      return [hit >>> 8, hit & 0xff];
    }
    const len = str.length;
    let head = this.v.i32[HDR.ARENA_HEAD];
    if (head + len >= ARENA_U16) head = this.collect(len);
    for (let i = 0; i < len; i++) this.v.u16[head + i] = str.charCodeAt(i);
    this.v.i32[HDR.ARENA_HEAD] = head + len;
    this.intern.set(str, (head << 8) | len);
    this.used.set(str, this.frame);
    return [head, len];
  }

  /** LRU compaction: keep the most recently used half, rewrite it from zero. */
  private collect(need: number): number {
    const live = [...this.used.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2048);
    this.intern.clear();
    this.used.clear();
    let head = 0;
    for (const [str, f] of live) {
      if (head + str.length + need >= ARENA_U16) break;
      for (let i = 0; i < str.length; i++) this.v.u16[head + i] = str.charCodeAt(i);
      this.intern.set(str, (head << 8) | str.length);
      this.used.set(str, f);
      head += str.length;
    }
    this.v.i32[HDR.ARENA_HEAD] = head;
    return head;
  }
}
