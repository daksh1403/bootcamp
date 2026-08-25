"use client";

import { useEffect, useState } from "react";

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
      className="font-mono text-[11px] uppercase tracking-wider border border-edge rounded px-2 py-1 hover:border-term-cyan/50 hover:text-term-cyan transition-colors"
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}

function useTick(intervalMs = 1000): number {
  const [ts, setTs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return ts;
}

export function Countdown({ to, className = "" }: { to: number; className?: string }) {
  const nowTs = useTick(1000);
  const diff = Math.max(0, Math.floor((to - nowTs) / 1000));
  const expired = to <= nowTs;
  const h = String(Math.floor(diff / 3600)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
  const s = String(diff % 60).padStart(2, "0");
  return (
    <span className={`font-mono tabular-nums ${expired ? "text-term-red blink" : ""} ${className}`} suppressHydrationWarning>
      {h}:{m}:{s}
    </span>
  );
}
