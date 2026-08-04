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
let io: IntersectionObserver | null = null;
let mo: MutationObserver | null = null;

export function startGlassObserver() {
  if (typeof window === "undefined" || io) return () => {};

  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        (e.target as HTMLElement).classList.toggle("lrf-live", e.isIntersecting);
      }
    },
    // Warm panels slightly before they enter, so nothing "starts" visibly.
    { rootMargin: "160px 0px" },
  );

  const observeAll = (root: ParentNode) => {
    root.querySelectorAll?.(".lrf").forEach((el) => io!.observe(el));
  };
  observeAll(document);

  mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.classList.contains("lrf")) io!.observe(n);
        observeAll(n);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  const onVisibility = () => {
    document.documentElement.classList.toggle("glass-frozen", document.hidden);
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    io?.disconnect();
    mo?.disconnect();
    io = null;
    mo = null;
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
