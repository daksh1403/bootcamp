"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; r: number };

export default function AuroraBackground({
  density = 70,
  className = "",
}: {
  density?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let pts: Particle[] = [];
    let raf = 0;
    let t = Math.random() * 100;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, w * DPR);
      canvas.height = Math.max(1, h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.max(18, Math.min(density, Math.floor((w * h) / 16000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const blobs = [
      { fx: 0.22, fy: 0.25, sx: 0.9, sy: 0.7, c: "34,211,238" },
      { fx: 0.78, fy: 0.32, sx: 0.8, sy: 0.6, c: "74,222,128" },
      { fx: 0.5, fy: 0.85, sx: 0.5, sy: 0.75, c: "251,191,36" },
    ];

    function render() {
      t += 0.004;
      ctx!.clearRect(0, 0, w, h);
      for (const b of blobs) {
        const x = w * b.fx + Math.sin(t * b.sx) * w * 0.06;
        const y = h * b.fy + Math.cos(t * b.sy) * h * 0.08;
        const g = ctx!.createRadialGradient(x, y, 0, x, y, Math.max(w * 0.42, 240));
        g.addColorStop(0, `rgba(${b.c},0.10)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      ctx!.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx!.strokeStyle = `rgba(139,152,165,${(1 - d / 110) * 0.16})`;
            ctx!.beginPath();
            ctx!.moveTo(pts[i].x, pts[i].y);
            ctx!.lineTo(pts[j].x, pts[j].y);
            ctx!.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx!.fillStyle = "rgba(139,232,255,0.45)";
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    const loop = () => {
      render();
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      render();
    } else {
      raf = requestAnimationFrame(loop);
      const vis = () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(loop);
      };
      document.addEventListener("visibilitychange", vis);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        document.removeEventListener("visibilitychange", vis);
      };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
