/**
 * ChronosGPU — binary UI delivery protocol.
 *
 * Layout of the shared buffer (single allocation, never resized):
 *
 *   [ HEADER 64 B ][ MUT RING A ][ MUT RING B ][ STRING ARENA ]
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
} as const;

export const HEADER_I32 = 16; // 64 bytes, cache-line friendly
export const REC_I32 = 4; // op, nodeId, argA, argB
export const MAX_OPS = 5000; // one full batch per frame
export const ARENA_U16 = 1 << 18; // 256K code units ≈ 512 KB

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
export const RING_A_I32 = HEADER_I32;
export const RING_B_I32 = RING_A_I32 + RING_I32;
export const ARENA_I32 = RING_B_I32 + RING_I32;
export const TOTAL_BYTES = (ARENA_I32 + ARENA_U16 / 2) * 4;

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
  u16: Uint16Array;
  ringA: Int32Array;
  ringB: Int32Array;
}

export function views(buffer: ArrayBufferLike): ChronosViews {
  const i32 = new Int32Array(buffer);
  return {
    i32,
    u16: new Uint16Array(buffer, ARENA_I32 * 4, ARENA_U16),
    ringA: new Int32Array(buffer, RING_A_I32 * 4, RING_I32),
    ringB: new Int32Array(buffer, RING_B_I32 * 4, RING_I32),
  };
}
