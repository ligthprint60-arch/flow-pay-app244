/**
 * ChronosGPU — binary UI delivery protocol.
 *
 * Single SharedArrayBuffer allocation, never resized, split into fixed sectors:
 *
 *   [ HEADER 64 B ]
 *   [ INPUT RING     ]  zero-allocation pointer events (4 × i32 per event)
 *   [ DIRTY BITMASK  ]  Atomics.or / Atomics.and delta tracking, O(k) scan
 *   [ MUT RING A/B   ]  DOM mutation records (double buffered, lock-free)
 *   [ STRING ARENA   ]  UTF-16 code units, interned + LRU compacted
 *   [ SoA UI STATE   ]  Structure-of-Arrays node state consumed by the GPU
 *
 * Header (Int32):
 *   0  MAGIC
 *   1  ACTIVE      index of the ring that is READY to be consumed (0 | 1)
 *   2  FRAME       monotonically increasing frame id written by the producer
 *   3  COUNT_A     number of mutation records in ring A
 *   4  COUNT_B     number of mutation records in ring B
 *   5  ARENA_HEAD  bump pointer of the string arena (in uint16 units)
 *   6  DROPPED     records the producer had to drop (ring overflow) — telemetry
 *   7  SHARED      1 when backed by SharedArrayBuffer
 *   8  IN_WRITE    input ring write pointer (Atomics.add by the main thread)
 *   9  IN_READ     input ring read pointer (Atomics.store by the consumer)
 *  10  NODE_COUNT  high-water mark of allocated SoA nodes
 *  11  DPR         devicePixelRatio × 1000
 *  12  VIEW_W      viewport width in CSS px
 *  13  VIEW_H      viewport height in CSS px
 *  14  GPU_FRAME   frames presented by the GPU thread — telemetry
 *  15  GPU_MODE    0 none, 1 webgl2-desynchronized, 2 webgpu
 *
 * A mutation record is 4 × Int32 = 16 bytes: [op, nodeId, argA, argB].
 * Strings are never transferred: the producer writes UTF-16 code units into
 * the arena and passes (offset, length) — the consumer memcopy-decodes them
 * once and caches the result per arena slot.
 */

export const MAGIC = 0x43485230; // "CHR0"

export const HDR = {
  MAGIC: 0,
  ACTIVE: 1,
  FRAME: 2,
  COUNT_A: 3,
  COUNT_B: 4,
  ARENA_HEAD: 5,
  DROPPED: 6,
  SHARED: 7,
  IN_WRITE: 8,
  IN_READ: 9,
  NODE_COUNT: 10,
  DPR: 11,
  VIEW_W: 12,
  VIEW_H: 13,
  GPU_FRAME: 14,
  GPU_MODE: 15,
} as const;

export const HEADER_I32 = 16; // 64 bytes, cache-line friendly
export const REC_I32 = 4; // op, nodeId, argA, argB
export const MAX_OPS = 5000; // one full batch per frame
export const ARENA_U16 = 1 << 18; // 256K code units ≈ 512 KB

/** Input ring: 1024 slots × 4 int32 = 16 KB, wraps, never allocates. */
export const INPUT_SLOTS = 1024;
export const INPUT_SLOT_I32 = 4; // type, x (f32), y (f32), pointerId
export const INPUT_RING_I32 = INPUT_SLOTS * INPUT_SLOT_I32;

export const INPUT = {
  MOVE: 1,
  DOWN: 2,
  UP: 3,
  WHEEL: 4,
  RESIZE: 5,
} as const;

/** SoA UI state. */
export const MAX_NODES = 8192;
/** Per-node fields, all f32, laid out as parallel planes (Structure of Arrays). */
export const SOA = {
  X: 0,
  Y: 1,
  W: 2,
  H: 3,
  RADIUS: 4,
  R: 5,
  G: 6,
  B: 7,
  A: 8,
  GLOW: 9,
  TILT: 10,
  FLAGS: 11,
} as const;
export const SOA_PLANES = 12;
export const SOA_I32 = SOA_PLANES * MAX_NODES;

/** Dirty bitmask: one bit per node, mutated with Atomics.or / Atomics.and. */
export const DIRTY_I32 = MAX_NODES / 32;

export const OP = {
  NOOP: 0,
  TEXT: 1, // argA = arena offset, argB = length
  CLASS: 2, // argA = arena offset, argB = length (full className)
  TRANSFORM: 3, // argA = x * 64 (fixed point), argB = y * 64
  OPACITY: 4, // argA = opacity * 1000
  TOGGLE: 5, // argA = arena offset/len packed token, argB = 1 add / 0 remove
  ATTACH: 6, // argA = parent nodeId — structural, batched via DocumentFragment
  DETACH: 7,
  VAR: 8, // argA = arena offset/len of "name=value" css custom property
} as const;

export type Op = (typeof OP)[keyof typeof OP];

export const RING_I32 = MAX_OPS * REC_I32;
export const INPUT_I32_BASE = HEADER_I32;
export const DIRTY_I32_BASE = INPUT_I32_BASE + INPUT_RING_I32;
export const RING_A_I32 = DIRTY_I32_BASE + DIRTY_I32;
export const RING_B_I32 = RING_A_I32 + RING_I32;
export const ARENA_I32 = RING_B_I32 + RING_I32;
export const SOA_I32_BASE = ARENA_I32 + ARENA_U16 / 2;
export const TOTAL_BYTES = (SOA_I32_BASE + SOA_I32) * 4;

/** Pack an (offset,len) pair into a single int32 for single-arg ops. */
export const pack = (offset: number, len: number) => (offset << 8) | (len & 0xff);
export const unpackOffset = (v: number) => v >>> 8;
export const unpackLen = (v: number) => v & 0xff;

export function createChronosBuffer(): { buffer: ArrayBufferLike; shared: boolean } {
  const canShare =
    typeof SharedArrayBuffer !== "undefined" &&
    (typeof globalThis.crossOriginIsolated === "undefined" || globalThis.crossOriginIsolated === true);
  const buffer = canShare ? new SharedArrayBuffer(TOTAL_BYTES) : new ArrayBuffer(TOTAL_BYTES);
  const i32 = new Int32Array(buffer);
  i32[HDR.MAGIC] = MAGIC;
  i32[HDR.SHARED] = canShare ? 1 : 0;
  return { buffer, shared: canShare };
}

export interface ChronosViews {
  i32: Int32Array;
  f32: Float32Array;
  u16: Uint16Array;
  ringA: Int32Array;
  ringB: Int32Array;
  /** SoA planes: soa[SOA.X * MAX_NODES + nodeIndex]. */
  soa: Float32Array;
}

export function views(buffer: ArrayBufferLike): ChronosViews {
  const i32 = new Int32Array(buffer);
  return {
    i32,
    f32: new Float32Array(buffer),
    u16: new Uint16Array(buffer, ARENA_I32 * 4, ARENA_U16),
    ringA: new Int32Array(buffer, RING_A_I32 * 4, RING_I32),
    ringB: new Int32Array(buffer, RING_B_I32 * 4, RING_I32),
    soa: new Float32Array(buffer, SOA_I32_BASE * 4, SOA_I32),
  };
}

/** O(1) atomic delta marking — the render thread only reads changed ranges. */
export function markDirty(i32: Int32Array, node: number) {
  Atomics.or(i32, DIRTY_I32_BASE + (node >>> 5), 1 << (node & 31));
}

export function clearDirty(i32: Int32Array, word: number) {
  return Atomics.exchange(i32, DIRTY_I32_BASE + word, 0);
}
