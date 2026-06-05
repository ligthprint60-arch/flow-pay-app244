import { useEffect, useRef } from "react";

/**
 * Lightweight fluid-motion background inspired by the incompressible
 * Navier–Stokes equation:
 *   ∂u/∂t = −(u·∇)u − ∇p/ρ + ν∇²u + f
 *
 * We approximate it with a coarse velocity field on a 2D grid:
 *  - external force (pointer/touch) injects momentum
 *  - viscous diffusion smooths the field (∇²u)
 *  - advection moves dye and the field itself ((u·∇)u)
 *  - the velocity is then projected to be approximately divergence-free
 * Then the dye field is rendered as a glowing tinted layer.
 */
export function FluidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const ptr = useRef({ x: 0.5, y: 0.5, px: 0.5, py: 0.5, active: false });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // simulation grid
    const N = 64;
    const size = (N + 2) * (N + 2);
    const u = new Float32Array(size);
    const v = new Float32Array(size);
    const u0 = new Float32Array(size);
    const v0 = new Float32Array(size);
    const dens = new Float32Array(size);
    const dens0 = new Float32Array(size);
    const IX = (i: number, j: number) => i + (N + 2) * j;

    const dt = 0.12;
    const visc = 0.00008;
    const diff = 0.00005;

    function set_bnd(b: number, x: Float32Array) {
      for (let i = 1; i <= N; i++) {
        x[IX(0, i)]     = b === 1 ? -x[IX(1, i)]     : x[IX(1, i)];
        x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)]     : x[IX(N, i)];
        x[IX(i, 0)]     = b === 2 ? -x[IX(i, 1)]     : x[IX(i, 1)];
        x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)]     : x[IX(i, N)];
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
      // velocity step
      // diffuse u,v
      [u0, v0].forEach(() => 0);
      const tmpU = u0, tmpV = v0;
      // swap manually
      diffuse(1, tmpU, u, visc); diffuse(2, tmpV, v, visc);
      project(tmpU, tmpV, u, v);
      advect(1, u, tmpU, tmpU, tmpV); advect(2, v, tmpV, tmpU, tmpV);
      project(u, v, tmpU, tmpV);

      // density step
      diffuse(0, dens0, dens, diff);
      advect(0, dens, dens0, u, v);

      // gentle decay
      for (let k = 0; k < size; k++) { dens[k] *= 0.992; u[k] *= 0.995; v[k] *= 0.995; }
    }

    function inject() {
      const p = ptr.current;
      // ambient drift seeds (top-left blue, bottom-right green)
      const t = performance.now() * 0.0008;
      const ax = (Math.sin(t) * 0.5 + 0.5);
      const ay = (Math.cos(t * 0.7) * 0.5 + 0.5);
      const ix = Math.max(1, Math.min(N, Math.floor(ax * N)));
      const iy = Math.max(1, Math.min(N, Math.floor(ay * N)));
      dens[IX(ix, iy)] += 30;
      u[IX(ix, iy)] += Math.cos(t * 1.3) * 12;
      v[IX(ix, iy)] += Math.sin(t * 1.1) * 12;

      if (p.active) {
        const i = Math.max(1, Math.min(N, Math.floor(p.x * N)));
        const j = Math.max(1, Math.min(N, Math.floor(p.y * N)));
        dens[IX(i, j)] += 120;
        u[IX(i, j)] += (p.x - p.px) * 800;
        v[IX(i, j)] += (p.y - p.py) * 800;
        p.px = p.x; p.py = p.y;
      }
    }

    function resize() {
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w; canvas.height = h;
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    function draw() {
      if (!canvas) return;
      const w = canvas.width, h = canvas.height;
      const cellW = w / N, cellH = h / N;
      ctx!.clearRect(0, 0, w, h);
      const accentEco = getComputedStyle(document.documentElement).getPropertyValue("--eco").trim() || "#10B981";
      const accentFiat = getComputedStyle(document.documentElement).getPropertyValue("--fiat").trim() || "#2563EB";
      for (let i = 1; i <= N; i++) for (let j = 1; j <= N; j++) {
        const d = dens[IX(i, j)];
        if (d < 0.4) continue;
        const a = Math.min(0.4, d / 220);
        // blend two tints based on velocity magnitude
        const vel = Math.min(1, Math.hypot(u[IX(i,j)], v[IX(i,j)]) * 0.15);
        ctx!.fillStyle = vel > 0.5 ? `${accentFiat}${alphaHex(a)}` : `${accentEco}${alphaHex(a)}`;
        ctx!.fillRect((i - 1) * cellW, (j - 1) * cellH, cellW + 1, cellH + 1);
      }
    }
    function alphaHex(a: number) {
      const v = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
      return v;
    }

    let raf = 0;
    function loop() { inject(); step(); draw(); raf = requestAnimationFrame(loop); }
    loop();

    const onMove = (e: PointerEvent) => {
      ptr.current.active = true;
      ptr.current.x = e.clientX / window.innerWidth;
      ptr.current.y = e.clientY / window.innerHeight;
    };
    const onUp = () => { ptr.current.active = false; };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: 0.55,
        filter: "blur(28px) saturate(150%)",
      }}
    />
  );
}
