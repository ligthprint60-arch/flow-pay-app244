/// <reference lib="webworker" />
import {
  DIRTY_I32,
  HDR,
  INPUT,
  INPUT_I32_BASE,
  INPUT_SLOTS,
  INPUT_SLOT_I32,
  MAX_NODES,
  SOA,
  clearDirty,
  views,
  type ChronosViews,
} from "@/lib/chronos/protocol";

/**
 * ChronosGPU render thread.
 *
 * Owns an OffscreenCanvas and draws the whole glass layer of the app directly
 * from the SoA planes in the shared buffer. Two backends, same data:
 *
 *   • WebGPU  — instanced render pass, SDF rounded rects, storage-buffer state
 *   • WebGL2  — `desynchronized: true` context (bypasses the browser
 *               compositor) with double FBO buffering + hardware blit so the
 *               direct scanout path can never tear
 *
 * The frame loop is lock-free: it reads the atomic dirty bitmask, drains the
 * input ring with Atomics.load, and never calls Atomics.wait.
 */

type Ctx = {
  present(instances: Float32Array, count: number, w: number, h: number, px: number, py: number, t: number): void;
  resize(w: number, h: number): void;
};

let v: ChronosViews | null = null;
let canvas: OffscreenCanvas | null = null;
let ctx: Ctx | null = null;
let running = false;
let paused = false;
// Reused instance staging buffer — 8 floats per node, allocated once.
const STRIDE = 8;
let instances = new Float32Array(0);
let pointerX = -1e4;
let pointerY = -1e4;
let pressed = 0;
let dirtyAll = true;

/* ------------------------------------------------------------------ WebGL2 */

const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aRect;   // x, y, w, h  (css px)
layout(location=2) in vec4 aMat;    // radius, glow, alpha, flags
uniform vec2 uView;
out vec2 vLocal;
out vec2 vHalf;
out vec4 vMat;
out vec2 vPx;
void main() {
  vec2 half_ = aRect.zw * 0.5;
  vec2 center = aRect.xy + half_;
  vec2 pad = vec2(24.0);
  vec2 pos = center + aCorner * (half_ + pad);
  vLocal = aCorner * (half_ + pad);
  vHalf = half_;
  vMat = aMat;
  vPx = pos;
  vec2 clip = (pos / uView) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vHalf;
in vec4 vMat;
in vec2 vPx;
uniform vec2 uPointer;
uniform float uTime;
out vec4 frag;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  float r = min(vMat.x, min(vHalf.x, vHalf.y));
  float d = sdRound(vLocal, vHalf, r);

  // Body: thin luminous fill inside the surface.
  float inside = 1.0 - smoothstep(-1.5, 0.5, d);
  // Edge: fresnel-like rim with chromatic dispersion.
  float rim = exp(-abs(d) * 0.55) * step(-6.0, d);
  // Outer halo bleeding into the background.
  float halo = exp(max(d, 0.0) * -0.09);

  vec2 toP = vPx - uPointer;
  float spec = exp(-dot(toP, toP) / 40000.0);
  float sweep = 0.5 + 0.5 * sin((vLocal.x + vLocal.y) * 0.012 + uTime * 1.7);

  float glow = vMat.y;
  vec3 cool = vec3(0.42, 0.72, 1.0);
  vec3 warm = vec3(1.0, 0.86, 0.72);
  vec3 tint = mix(cool, warm, sweep * 0.55 + spec * 0.45);

  float a = inside * vMat.z + rim * 0.10 * glow + halo * 0.05 * glow + spec * 0.05 * glow;
  vec3 col = tint * (rim * 0.9 + halo * 0.35 + spec * 0.6 + inside * 0.25);
  frag = vec4(col * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

function createWebGL2(cv: OffscreenCanvas): Ctx | null {
  const gl = cv.getContext("webgl2", {
    desynchronized: true, // bypass the browser viz compositor → direct scanout
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const uView = gl.getUniformLocation(prog, "uView");
  const uPointer = gl.getUniformLocation(prog, "uPointer");
  const uTime = gl.getUniformLocation(prog, "uTime");

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const inst = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STRIDE * 4, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, STRIDE * 4, 16);
  gl.vertexAttribDivisor(2, 1);

  // Double FBO buffering: we never draw straight into the desynchronized
  // front buffer, we blit a finished frame into it in one hardware copy.
  let fboA = gl.createFramebuffer();
  let fboB = gl.createFramebuffer();
  let texA = gl.createTexture();
  let texB = gl.createTexture();
  let bw = 0;
  let bh = 0;

  const attach = (fbo: WebGLFramebuffer | null, tex: WebGLTexture | null, w: number, h: number) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const resize = (w: number, h: number) => {
    if (w === bw && h === bh) return;
    bw = w;
    bh = h;
    attach(fboA, texA, w, h);
    attach(fboB, texB, w, h);
  };

  let back = fboB;
  let front = fboA;

  return {
    resize,
    present(data, count, w, h, px, py, t) {
      resize(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, back);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count > 0) {
        gl.useProgram(prog);
        gl.bindVertexArray(vao);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * STRIDE), gl.DYNAMIC_DRAW);
        gl.uniform2f(uView, w, h);
        gl.uniform2f(uPointer, px, py);
        gl.uniform1f(uTime, t);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      }
      // Hardware blit of the completed back buffer to the screen buffer.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, back);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const tmp = front;
      front = back;
      back = tmp;
      const tt = texA;
      texA = texB;
      texB = tt;
      const tf = fboA;
      fboA = fboB;
      fboB = tf;
    },
  };
}

/* ------------------------------------------------------------------ WebGPU */

const WGSL = `
struct Params { view: vec4<f32>, pointer: vec4<f32> };
struct Inst { rect: vec4<f32>, mat: vec4<f32> };
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> insts: array<Inst>;

struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) half_: vec2<f32>,
  @location(2) mat: vec4<f32>,
  @location(3) px: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var corners = array<vec2<f32>, 4>(vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0), vec2(1.0,1.0));
  let c = corners[vi];
  let it = insts[ii];
  let h = it.rect.zw * 0.5;
  let center = it.rect.xy + h;
  let pos = center + c * (h + vec2(24.0));
  var o: VOut;
  o.local = c * (h + vec2(24.0));
  o.half_ = h;
  o.mat = it.mat;
  o.px = pos;
  let clip = (pos / params.view.xy) * 2.0 - vec2(1.0);
  o.pos = vec4(clip.x, -clip.y, 0.0, 1.0);
  return o;
}

fn sdRound(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
  let q = abs(p) - b + vec2(r);
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs(i: VOut) -> @location(0) vec4<f32> {
  let r = min(i.mat.x, min(i.half_.x, i.half_.y));
  let d = sdRound(i.local, i.half_, r);
  let inside = 1.0 - smoothstep(-1.5, 0.5, d);
  let rim = exp(-abs(d) * 0.55) * step(-6.0, d);
  let halo = exp(max(d, 0.0) * -0.09);
  let toP = i.px - params.pointer.xy;
  let spec = exp(-dot(toP, toP) / 40000.0);
  let sweep = 0.5 + 0.5 * sin((i.local.x + i.local.y) * 0.012 + params.pointer.z * 1.7);
  let tint = mix(vec3(0.42, 0.72, 1.0), vec3(1.0, 0.86, 0.72), sweep * 0.55 + spec * 0.45);
  let glow = i.mat.y;
  let a = inside * i.mat.z + rim * 0.10 * glow + halo * 0.05 * glow + spec * 0.05 * glow;
  let col = tint * (rim * 0.9 + halo * 0.35 + spec * 0.6 + inside * 0.25);
  return vec4(col * a, a);
}`;

// GPUBufferUsage is a runtime global; declare the flags we use so the worker
// typechecks in environments without @webgpu/types.
const BUF_UNIFORM = 0x0040;
const BUF_STORAGE = 0x0080;
const BUF_COPY_DST = 0x0008;

async function createWebGPU(cv: OffscreenCanvas): Promise<Ctx | null> {
  const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) return null;
  const device = await adapter.requestDevice().catch(() => null);
  if (!device) return null;
  const context = cv.getContext("webgpu") as unknown as GPUCanvasContext | null;
  if (!context) return null;
  const format = gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });

  const module = device.createShaderModule({ code: WGSL });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-strip" },
  });

  const params = device.createBuffer({ size: 32, usage: BUF_UNIFORM | BUF_COPY_DST });
  let storage: GPUBuffer | null = null;
  let bind: GPUBindGroup | null = null;
  let cap = 0;
  const scratch = new Float32Array(8);

  return {
    resize(w, h) {
      cv.width = w;
      cv.height = h;
    },
    present(data, count, w, h, px, py, t) {
      if (count === 0) return;
      if (count > cap) {
        cap = Math.max(count * 2, 256);
        storage = device.createBuffer({
          size: cap * STRIDE * 4,
          usage: BUF_STORAGE | BUF_COPY_DST,
        });
        bind = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: params } },
            { binding: 1, resource: { buffer: storage } },
          ],
        });
      }
      scratch[0] = w;
      scratch[1] = h;
      scratch[4] = px;
      scratch[5] = py;
      scratch[6] = t;
      device.queue.writeBuffer(params, 0, scratch);
      device.queue.writeBuffer(storage!, 0, data, 0, count * STRIDE);
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind!);
      pass.draw(4, count);
      pass.end();
      device.queue.submit([enc.finish()]);
    },
  };
}

/* -------------------------------------------------------------- frame loop */

function drainInput() {
  if (!v) return;
  const i32 = v.i32;
  const f32 = v.f32;
  let read = Atomics.load(i32, HDR.IN_READ);
  const write = Atomics.load(i32, HDR.IN_WRITE);
  while (read < write) {
    const slot = INPUT_I32_BASE + (read % INPUT_SLOTS) * INPUT_SLOT_I32;
    const type = i32[slot];
    if (type === INPUT.MOVE || type === INPUT.DOWN || type === INPUT.UP) {
      pointerX = f32[slot + 1];
      pointerY = f32[slot + 2];
      if (type === INPUT.DOWN) pressed = 1;
      if (type === INPUT.UP) pressed = 0;
    } else if (type === INPUT.RESIZE) {
      dirtyAll = true;
    }
    read++;
  }
  Atomics.store(i32, HDR.IN_READ, read);
}

/** Collect instances from the SoA planes. O(k) over the dirty set, O(n) on resize. */
function collect(): number {
  if (!v) return 0;
  const n = v.i32[HDR.NODE_COUNT];
  if (instances.length < n * STRIDE) instances = new Float32Array(Math.max(n, 256) * STRIDE);
  // Consume the dirty bitmask so producers can flag new deltas immediately.
  for (let w = 0; w < DIRTY_I32; w++) if (clearDirty(v.i32, w) !== 0) dirtyAll = true;
  const s = v.soa;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = s[SOA.A * MAX_NODES + i];
    if (a <= 0) continue;
    const o = count * STRIDE;
    instances[o] = s[SOA.X * MAX_NODES + i];
    instances[o + 1] = s[SOA.Y * MAX_NODES + i];
    instances[o + 2] = s[SOA.W * MAX_NODES + i];
    instances[o + 3] = s[SOA.H * MAX_NODES + i];
    instances[o + 4] = s[SOA.RADIUS * MAX_NODES + i];
    instances[o + 5] = s[SOA.GLOW * MAX_NODES + i] + pressed * 0.15;
    instances[o + 6] = a;
    instances[o + 7] = s[SOA.FLAGS * MAX_NODES + i];
    count++;
  }
  return count;
}

function frame(t: number) {
  if (!running) return;
  requestAnimationFrame(frame);
  if (paused || !v || !ctx || !canvas) return;
  drainInput();
  const dpr = Math.min((v.i32[HDR.DPR] || 1000) / 1000, 2);
  const w = Math.max(1, Math.round((v.i32[HDR.VIEW_W] || 1) * dpr));
  const h = Math.max(1, Math.round((v.i32[HDR.VIEW_H] || 1) * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    ctx.resize(w, h);
  }
  const count = collect();
  // SoA geometry is in CSS px; scale into device px in one pass.
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    instances[o] *= dpr;
    instances[o + 1] *= dpr;
    instances[o + 2] *= dpr;
    instances[o + 3] *= dpr;
    instances[o + 4] *= dpr;
  }
  ctx.present(instances, count, w, h, pointerX * dpr, pointerY * dpr, t / 1000);
  v.i32[HDR.GPU_FRAME]++;
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  switch (m?.type) {
    case "init": {
      v = views(m.buffer);
      canvas = m.canvas as OffscreenCanvas;
      try {
        ctx = await createWebGPU(canvas);
        if (ctx) v.i32[HDR.GPU_MODE] = 2;
      } catch {
        ctx = null;
      }
      if (!ctx) {
        try {
          ctx = createWebGL2(canvas);
          if (ctx) v.i32[HDR.GPU_MODE] = 1;
        } catch {
          ctx = null;
        }
      }
      if (!ctx) {
        v.i32[HDR.GPU_MODE] = 0;
        (self as unknown as Worker).postMessage({ type: "gpu:unavailable" });
        return;
      }
      running = true;
      requestAnimationFrame(frame);
      (self as unknown as Worker).postMessage({ type: "gpu:ready", mode: v.i32[HDR.GPU_MODE] });
      break;
    }
    case "pause":
      paused = true;
      break;
    case "resume":
      paused = false;
      break;
    case "stop":
      running = false;
      break;
  }
};
