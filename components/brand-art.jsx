"use client";

import { useEffect, useRef } from "react";

export default function BrandArt() {
  const ref = useRef(null);

  useEffect(() => {
    const art = ref.current;
    const surface = art.parentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    function paint() {
      frame = 0;
      const progress = Math.min(1, Math.max(0, -surface.getBoundingClientRect().top / surface.offsetHeight));
      art.style.setProperty("--drift", progress * 52 + "px");
      art.style.setProperty("--turn", progress * 24 + "deg");
    }
    function scroll() {
      if (!frame) frame = requestAnimationFrame(paint);
    }
    function track(event) {
      if (!pointer.matches) return;
      const rect = surface.getBoundingClientRect();
      art.style.setProperty("--pointer", ((event.clientX - rect.left) / rect.width - .5) * 22 + "px");
    }
    function center() { art.style.removeProperty("--pointer"); }
    function stop() {
      window.removeEventListener("scroll", scroll);
      surface.removeEventListener("pointermove", track);
      surface.removeEventListener("pointerleave", center);
      cancelAnimationFrame(frame);
      frame = 0;
      art.removeAttribute("style");
    }
    function sync() {
      stop();
      if (!motion.matches) return;
      paint();
      window.addEventListener("scroll", scroll, { passive: true });
      surface.addEventListener("pointermove", track);
      surface.addEventListener("pointerleave", center);
    }
    sync();
    motion.addEventListener("change", sync);
    return () => { stop(); motion.removeEventListener("change", sync); };
  }, []);

  return <div ref={ref} className="brand-art" aria-hidden="true"><i /><i /><i /></div>;
}
