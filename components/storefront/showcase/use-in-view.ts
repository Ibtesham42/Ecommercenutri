"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True only while the element is on-screen AND the tab is visible. Used to gate
 * the WebGL render loop (frameloop) so the hero never burns GPU cycles
 * off-screen or in a backgrounded tab.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    io.observe(el);
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return { ref, active: inView && visible };
}
