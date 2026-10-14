/**
 * Glass activity scheduler.
 *
 * Every `.lrf` panel paints a backdrop-filter plus two infinitely animated
 * pseudo-layers (specular streak + dispersion edge). With a dozen panels on a
 * page that is a dozen continuously invalidated blur layers — the single
 * biggest source of jank on mobile.
 *
 * Visuals stay identical: the animations are simply paused (CSS default) and
 * resumed only for panels intersecting the viewport, and stopped entirely
 * while the tab is hidden. Off-screen glass looks the same the moment it
 * scrolls back in.
 */
import { allocNodeId, bind, setToggle, unbind } from "@/lib/chronos/runtime";

let io: IntersectionObserver | null = null;
const visible = new Set<HTMLElement>();
const LENS_BUDGET = 3;
let lensFrame = 0;

/** TMUI Spatial Glass: at most three full optical lenses render at once
 *  (navigation first, then the largest visible panels). Others keep the same
 *  frosted body but skip dispersion and dynamic specular passes. */
function assignLenses() {
  lensFrame = 0;
  const ranked = [...visible].filter((el) => el.isConnected && !el.parentElement?.closest(".lrf"));
  ranked.sort((a, b) => {
    const na = a.closest("nav") ? 1 : 0, nb = b.closest("nav") ? 1 : 0;
    if (na !== nb) return nb - na;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return rb.width * rb.height - ra.width * ra.height;
  });
  const lenses = new Set(ranked.slice(0, LENS_BUDGET));
  document.querySelectorAll<HTMLElement>(".lrf").forEach((el) => el.classList.toggle("lrf-lens", lenses.has(el)));
}
const scheduleLenses = () => { if (!lensFrame) lensFrame = requestAnimationFrame(assignLenses); };
let mo: MutationObserver | null = null;
const ids = new WeakMap<Element, number>();

/** Every panel gets a Chronos node id so the class flip rides the rAF batch. */
function nodeIdFor(el: Element) {
  let id = ids.get(el);
  if (id === undefined) {
    id = allocNodeId();
    ids.set(el, id);
    bind(id, el as HTMLElement);
  }
  return id;
}

export function startGlassObserver() {
  if (typeof window === "undefined" || io) return () => {};

  io = new IntersectionObserver(
    (entries) => {
      // No direct DOM writes here: mutations are queued into the shared
      // buffer and applied in one batched frame by the Chronos consumer.
      for (const e of entries) {
        setToggle(nodeIdFor(e.target), "lrf-live", e.isIntersecting);
        if (e.isIntersecting) visible.add(e.target as HTMLElement); else visible.delete(e.target as HTMLElement);
      }
      scheduleLenses();
    },
    // Warm panels slightly before they enter, so nothing "starts" visibly.
    { rootMargin: "160px 0px" },
  );

  const observeAll = (root: ParentNode) => {
    root.querySelectorAll?.(".lrf").forEach((el) => {
      nodeIdFor(el);
      io!.observe(el);
    });
  };
  observeAll(document);

  mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.classList.contains("lrf")) {
          nodeIdFor(n);
          io!.observe(n);
        }
        observeAll(n);
      });
      r.removedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        const id = ids.get(n);
        if (id !== undefined) unbind(id);
        visible.delete(n);
        scheduleLenses();
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  const onVisibility = () => {
    document.documentElement.classList.toggle("glass-frozen", document.hidden);
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    if (lensFrame) cancelAnimationFrame(lensFrame);
    visible.clear();
    io?.disconnect();
    mo?.disconnect();
    io = null;
    mo = null;
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
