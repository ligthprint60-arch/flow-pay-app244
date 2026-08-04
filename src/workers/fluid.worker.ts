/// <reference lib="webworker" />
// Fluid simulation worker. Owns an OffscreenCanvas transferred from the
// main thread and runs the Navier–Stokes approximation + rendering here,
// so the UI thread stays free during pointer input and route transitions.

type InitMsg = {
  type: "init";
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  eco: string;
  fiat: string;
};
type ResizeMsg = { type: "resize"; width: number; height: number };
type PointerMsg = { type: "pointer"; x: number; y: number; active: boolean };
type ThemeMsg = { type: "theme"; eco: string; fiat: string };
type StopMsg = { type: "stop" };
type RunMsg = { type: "pause" } | { type: "resume" };
type InMsg = InitMsg | ResizeMsg | PointerMsg | ThemeMsg | StopMsg | RunMsg;

const N = 64;
const SIZE = (N + 2) * (N + 2);
const IX = (i: number, j: number) => i + (N + 2) * j;

const u = new Float32Array(SIZE);
const v = new Float32Array(SIZE);
const u0 = new Float32Array(SIZE);
const v0 = new Float32Array(SIZE);
const dens = new Float32Array(SIZE);
const dens0 = new Float32Array(SIZE);

const dt = 0.12;
const visc = 0.00008;
const diff = 0.00005;

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let eco = "#10B981";
let fiat = "#2563EB";
const ptr = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, active: false };
let raf = 0;
let running = false;

function set_bnd(b: number, x: Float32Array) {
  for (let i = 1; i <= N; i++) {
    x[IX(0, i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)];
    x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)];
    x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
    x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)];
  }
}
function lin_solve(b: number, x: Float32Array, x0: Float32Array, a: number, c: number) {
  for (let k = 0; k < 8; k++) {
    for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
      x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) / c;
    }
    set_bnd(b, x);
  }
}
function diffuse(b: number, x: Float32Array, x0: Float32Array, dCoef: number) {
  const a = dt * dCoef * N * N;
  lin_solve(b, x, x0, a, 1 + 4 * a);
}
function advect(b: number, d: Float32Array, d0: Float32Array, uF: Float32Array, vF: Float32Array) {
  const dt0 = dt * N;
  for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
    let x = i - dt0 * uF[IX(i, j)];
    let y = j - dt0 * vF[IX(i, j)];
    if (x < 0.5) x = 0.5; if (x > N + 0.5) x = N + 0.5;
    const i0 = Math.floor(x), i1 = i0 + 1;
    if (y < 0.5) y = 0.5; if (y > N + 0.5) y = N + 0.5;
    const j0 = Math.floor(y), j1 = j0 + 1;
    const s1 = x - i0, s0 = 1 - s1, t1 = y - j0, t0 = 1 - t1;
    d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) + s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
  }
  set_bnd(b, d);
}
function project(uF: Float32Array, vF: Float32Array, p: Float32Array, div: Float32Array) {
  const h = 1.0 / N;
  for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
    div[IX(i, j)] = -0.5 * h * (uF[IX(i + 1, j)] - uF[IX(i - 1, j)] + vF[IX(i, j + 1)] - vF[IX(i, j - 1)]);
    p[IX(i, j)] = 0;
  }
  set_bnd(0, div); set_bnd(0, p);
  lin_solve(0, p, div, 1, 4);
  for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
    uF[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) / h;
    vF[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) / h;
  }
  set_bnd(1, uF); set_bnd(2, vF);
}
function step() {
  const tmpU = u0, tmpV = v0;
  diffuse(1, tmpU, u, visc); diffuse(2, tmpV, v, visc);
  project(tmpU, tmpV, u, v);
  advect(1, u, tmpU, tmpU, tmpV); advect(2, v, tmpV, tmpU, tmpV);
  project(u, v, tmpU, tmpV);
  diffuse(0, dens0, dens, diff);
  advect(0, dens, dens0, u, v);
  for (let k = 0; k < SIZE; k++) { dens[k] *= 0.992; u[k] *= 0.995; v[k] *= 0.995; }
}
function inject() {
  const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) * 0.0008;
  const ax = (Math.sin(t) * 0.5 + 0.5);
  const ay = (Math.cos(t * 0.7) * 0.5 + 0.5);
  const ix = Math.max(1, Math.min(N, Math.floor(ax * N)));
  const iy = Math.max(1, Math.min(N, Math.floor(ay * N)));
  dens[IX(ix, iy)] += 30;
  u[IX(ix, iy)] += Math.cos(t * 1.3) * 12;
  v[IX(ix, iy)] += Math.sin(t * 1.1) * 12;
  if (ptr.active) {
    const i = Math.max(1, Math.min(N, Math.floor(ptr.x * N)));
    const j = Math.max(1, Math.min(N, Math.floor(ptr.y * N)));
    dens[IX(i, j)] += 120;
    u[IX(i, j)] += (ptr.x - ptr.px) * 800;
    v[IX(i, j)] += (ptr.y - ptr.py) * 800;
    ptr.px = ptr.x; ptr.py = ptr.y;
  }
}
function alphaHex(a: number) {
  const val = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  return val;
}

/* The canvas is upscaled and softened, so it is rasterised at a low internal
   resolution — identical look, a fraction of the fill cost. */
const BACKING_W = 320;
function sizeBacking() {
  if (!canvas) return;
  const ratio = height > 0 && width > 0 ? height / width : 1.8;
  canvas.width = BACKING_W;
  canvas.height = Math.max(1, Math.round(BACKING_W * ratio));
}

/* ---------------- Rendering ----------------
   Preferred path: WebGL. The 64×64 field is uploaded once per frame as a
   tiny texture and expanded by the GPU with linear filtering + a 9-tap
   gaussian in the fragment shader. That replaces ~4000 canvas fillRect
   calls AND the expensive full-screen CSS blur with a single quad draw,
   which is where most of the per-frame cost used to go. The 2D canvas
   path below stays as a fallback and looks the same. */
const FIELD = N + 2;
let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
let tex: WebGLTexture | null = null;
let uColorEco: WebGLUniformLocation | null = null;
let uColorFiat: WebGLUniformLocation | null = null;
let uTexel: WebGLUniformLocation | null = null;
const field = new Uint8Array(FIELD * FIELD * 4);

const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D field;
uniform vec3 cEco;
uniform vec3 cFiat;
uniform vec2 texel;
vec2 sample2(vec2 c){ vec4 t = texture2D(field, c); return vec2(t.r, t.g); }
void main(){
  // 9-tap gaussian: reproduces the soft blurred plume look on the GPU.
  vec2 acc = vec2(0.0);
  acc += sample2(uv) * 0.25;
  acc += sample2(uv + vec2( texel.x, 0.0)) * 0.125;
  acc += sample2(uv + vec2(-texel.x, 0.0)) * 0.125;
  acc += sample2(uv + vec2(0.0,  texel.y)) * 0.125;
  acc += sample2(uv + vec2(0.0, -texel.y)) * 0.125;
  acc += sample2(uv + texel) * 0.0625;
  acc += sample2(uv - texel) * 0.0625;
  acc += sample2(uv + vec2( texel.x, -texel.y)) * 0.0625;
  acc += sample2(uv + vec2(-texel.x,  texel.y)) * 0.0625;
  float d = acc.x;
  float vel = acc.y;
  vec3 col = mix(cEco, cFiat, smoothstep(0.35, 0.75, vel));
  float a = min(0.4, d * 1.15);
  gl_FragColor = vec4(col * a, a);
}`;

function hex3(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const n = s.length === 3
    ? parseInt(s.split("").map((c) => c + c).join(""), 16)
    : parseInt(s.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function initGL(): boolean {
  if (!canvas) return false;
  const ctx3d = (canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true })
    || canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true })) as
    WebGLRenderingContext | WebGL2RenderingContext | null;
  if (!ctx3d) return false;
  gl = ctx3d;

  const compile = (type: number, src: string) => {
    const sh = gl!.createShader(type)!;
    gl!.shaderSource(sh, src);
    gl!.compileShader(sh);
    if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) return null;
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { gl = null; return false; }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  uColorEco = gl.getUniformLocation(prog, "cEco");
  uColorFiat = gl.getUniformLocation(prog, "cFiat");
  uTexel = gl.getUniformLocation(prog, "texel");
  gl.uniform2f(uTexel, 1 / FIELD, 1 / FIELD);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function drawGL() {
  if (!gl || !canvas) return;
  for (let j = 0; j < FIELD; j++) {
    for (let i = 0; i < FIELD; i++) {
      const k = IX(i, j);
      const o = (j * FIELD + i) * 4;
      const d = dens[k] / 220;
      const vel = Math.hypot(u[k], v[k]) * 0.15;
      field[o] = Math.min(255, d * 255);
      field[o + 1] = Math.min(255, vel * 255);
      field[o + 2] = 0;
      field[o + 3] = 255;
    }
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FIELD, FIELD, 0, gl.RGBA, gl.UNSIGNED_BYTE, field);
  gl.uniform3fv(uColorEco, hex3(eco));
  gl.uniform3fv(uColorFiat, hex3(fiat));
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function draw() {
  if (gl) { drawGL(); return; }
  if (!ctx || !canvas) return;
  const w = canvas.width, h = canvas.height;
  const cellW = w / N, cellH = h / N;
  ctx.clearRect(0, 0, w, h);
  for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
    const d = dens[IX(i, j)];
    if (d < 0.4) continue;
    const a = Math.min(0.4, d / 220);
    const vel = Math.min(1, Math.hypot(u[IX(i, j)], v[IX(i, j)]) * 0.15);
    ctx.fillStyle = vel > 0.5 ? `${fiat}${alphaHex(a)}` : `${eco}${alphaHex(a)}`;
    ctx.fillRect((i - 1) * cellW, (j - 1) * cellH, cellW + 1, cellH + 1);
  }
}

/* Frame budget: the fluid is a slow ambient effect, 30fps is visually
   identical here and halves the work stolen from scrolling/compositing. */
const FRAME_MS = 33;
let lastFrame = 0;
function loop() {
  if (!running) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastFrame >= FRAME_MS) {
    lastFrame = now;
    inject(); step(); draw();
  }
  raf = (self as unknown as { requestAnimationFrame: (cb: () => void) => number }).requestAnimationFrame(loop);
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init": {
      canvas = msg.canvas;
      width = msg.width; height = msg.height;
      ctx = canvas.getContext("2d", { alpha: true });
      sizeBacking();
      eco = msg.eco || eco; fiat = msg.fiat || fiat;
      if (!running) { running = true; loop(); }
      break;
    }
    case "resize": {
      width = msg.width; height = msg.height;
      sizeBacking();
      break;
    }
    case "pause": {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      break;
    }
    case "resume": {
      if (!running) { running = true; loop(); }
      break;
    }
    case "pointer": {
      ptr.active = msg.active;
      ptr.x = msg.x; ptr.y = msg.y;
      break;
    }
    case "theme": {
      eco = msg.eco || eco; fiat = msg.fiat || fiat;
      break;
    }
    case "stop": {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      break;
    }
  }
};
