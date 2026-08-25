"use client";

import { useEffect, useRef, useState } from "react";

export default function CountUp({
  value,
  duration = 1100,
  suffix = "",
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [n, setN] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const delta = value - from;
    if (delta <= 0) {
      setN(value);
      prev.current = value;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + delta * e));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prev.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {n.toLocaleString()}
      {suffix}
    </>
  );
}
