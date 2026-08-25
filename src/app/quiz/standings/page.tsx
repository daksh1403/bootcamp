"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Row {
  code: string;
  score: number;
  total: number;
  duration_s: number | null;
}

export default function QuizStandings() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const r = await fetch("/api/quiz/standings", { cache: "no-store" });
        const d = await r.json();
        if (alive && d.ok) setRows(d.rows);
      } catch {
        /* presenter screen tolerates transient network loss */
      }
    }
    void poll();
    const id = setInterval(poll, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen p-8 md:p-12">
      <header className="border-b border-edge pb-4 mb-8 flex items-center justify-between">
        <div>
          <div className="font-mono text-sm tracking-[0.25em] text-muted">DEPLOYMENT WINDOW CLOSED · LUNCH WINDOW</div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-1">DEVOPS TRIVIA STANDINGS</h1>
        </div>
        <Link href="/" className="font-mono text-xs text-muted hover:text-term-cyan transition-colors">mission-control ↗</Link>
      </header>

      {rows.length === 0 ? (
        <div className="grid place-items-center h-[60vh] font-mono text-xl md:text-2xl text-muted">
          WAITING FOR FIRST SCORE…
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="font-mono text-xs md:text-sm text-muted uppercase tracking-[0.2em] border-b border-edge">
              <th className="text-left py-3 w-24">#</th>
              <th className="text-left py-3">OPERATIVE</th>
              <th className="text-center py-3">SCORE</th>
              <th className="text-right py-3">TIME</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.code} className={`border-b border-edge/40 ${i === 0 ? "bg-term-green/10" : ""}`}>
                <td className="py-4 font-mono font-extrabold text-2xl">{(i < 3 && ["🥇", "🥈", "🥉"][i]) || i + 1}</td>
                <td className="py-4 font-mono font-bold text-xl md:text-2xl">{r.code}</td>
                <td className="py-4 text-center font-mono text-term-green text-xl md:text-2xl tabular-nums">{r.score}/{r.total}</td>
                <td className="py-4 text-right font-mono text-muted tabular-nums">{r.duration_s ?? "—"}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-10 font-mono text-[11px] text-muted text-center tracking-widest uppercase">
        Trivia standings are separate from the official deployment leaderboard
      </p>
    </div>
  );
}
