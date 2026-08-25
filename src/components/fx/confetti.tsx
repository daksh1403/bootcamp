"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#4ade80", "#22d3ee", "#fbbf24", "#f87171", "#a78bfa"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  life: number;
};

export default function Confetti({ count = 140, durationMs = 4200 }: { count?: number; durationMs?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const pieces: Piece[] = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: -30 - Math.random() * window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.8 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.22,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1,
    }));

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const tick = (t: number) => {
      const dt = Math.min(48, t - last);
      last = t;
      elapsed += dt;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fadeStart = durationMs * 0.7;
      const fade = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (durationMs - fadeStart)) : 1;
      for (const p of pieces) {
        p.x += p.vx + Math.sin((elapsed + p.y) / 300) * 0.4;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.55 + 0.45 * Math.sin(p.rot * 2)));
        ctx.restore();
      }
      if (elapsed < durationMs && fade > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count, durationMs]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[70]" />;
}
