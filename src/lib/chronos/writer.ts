import { ArenaAllocator } from "./allocator";
import {
  HDR,
  MAX_OPS,
  OP,
  REC_I32,
  createChronosBuffer,
  views,
  type ChronosViews,
} from "./protocol";

/**
 * Producer side of ChronosGPU. Runs wherever the business logic lives — a Web
 * Worker when SharedArrayBuffer is available, otherwise on the main thread
 * (same binary protocol, same zero-allocation apply path, just no isolation).
 *
 * Double buffered: the producer always fills the *inactive* ring and then
 * publishes it with a single Atomics.store. The consumer never blocks and
 * never waits — it reads the flag with Atomics.load and, if a frame is not
 * ready, simply re-displays the previous one.
 */
export class ChronosWriter {
  readonly buffer: ArrayBufferLike;
  readonly shared: boolean;
  private v: ChronosViews;
  private arena: ArenaAllocator;
  private writing = 1; // ring currently being filled
  private count = 0;

  constructor(buffer?: ArrayBufferLike) {
    if (buffer) {
      this.buffer = buffer;
      this.shared = typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
    } else {
      const b = createChronosBuffer();
      this.buffer = b.buffer;
      this.shared = b.shared;
    }
    this.v = views(this.buffer);
    this.arena = new ArenaAllocator(this.v);
  }

  private ring() {
    return this.writing === 0 ? this.v.ringA : this.v.ringB;
  }

  private push(op: number, nodeId: number, a: number, b: number) {
    if (this.count >= MAX_OPS) {
      this.v.i32[HDR.DROPPED]++;
      return;
    }
    const r = this.ring();
    const o = this.count * REC_I32;
    r[o] = op;
    r[o + 1] = nodeId;
    r[o + 2] = a;
    r[o + 3] = b;
    this.count++;
  }

  text(nodeId: number, value: string) {
    const [off, len] = this.arena.write(value);
    this.push(OP.TEXT, nodeId, off, len);
  }

  className(nodeId: number, value: string) {
    const [off, len] = this.arena.write(value);
    this.push(OP.CLASS, nodeId, off, len);
  }

  transform(nodeId: number, x: number, y: number) {
    this.push(OP.TRANSFORM, nodeId, (x * 64) | 0, (y * 64) | 0);
  }

  opacity(nodeId: number, value: number) {
    this.push(OP.OPACITY, nodeId, (value * 1000) | 0, 0);
  }

  toggle(nodeId: number, token: string, on: boolean) {
    const [off, len] = this.arena.write(token);
    this.push(OP.TOGGLE, nodeId, (off << 8) | len, on ? 1 : 0);
  }

  cssVar(nodeId: number, decl: string) {
    const [off, len] = this.arena.write(decl);
    this.push(OP.VAR, nodeId, off, len);
  }

  /** Publish the filled ring. Single store, no locks, no wait. */
  commit() {
    const frame = this.v.i32[HDR.FRAME] + 1;
    this.arena.setFrame(frame);
    if (this.writing === 0) this.v.i32[HDR.COUNT_A] = this.count;
    else this.v.i32[HDR.COUNT_B] = this.count;
    Atomics.store(this.v.i32, HDR.FRAME, frame);
    Atomics.store(this.v.i32, HDR.ACTIVE, this.writing);
    this.writing = this.writing === 0 ? 1 : 0;
    this.count = 0;
  }

  get pending() {
    return this.count;
  }
}
