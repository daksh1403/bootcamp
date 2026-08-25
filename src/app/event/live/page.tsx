"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import AuroraBackground from "@/components/fx/aurora-background";
import CountUp from "@/components/fx/count-up";

interface Announcement {
  id: number;
  title: string;
  priority: string;
}

export default function ProjectorLive() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [nowTs, setNowTs] = useState(Date.now());
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const [lbRes, anRes] = await Promise.all([
          fetch("/api/leaderboard", { cache: "no-store" }),
          fetch("/api/announcements", { cache: "no-store" }),
        ]);
        const lb = await lbRes.json();
        const an = await anRes.json();
        if (!alive) return;
        setRows(lb.rows ?? []);
        setAnnouncements((an.announcements ?? []).slice(0, 2));
        setConnected(true);
      } catch {
        if (alive) setConnected(false);
      }
      setNowTs(Date.now());
    }
    void poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const deployedCount = rows.filter((r) => r.finalStatus === "DEPLOYED").length;
  const leader = rows[0];
  const latestDeployment = rows.filter((r) => r.deploymentTime).sort((a, b) => (b.deploymentTime ?? 0) - (a.deploymentTime ?? 0))[0];

  return (
    <div className="relative min-h-screen p-6 md:p-10 flex flex-col gap-6 overflow-hidden">
      <AuroraBackground density={50} className="opacity-60" />
      {/* header */}
      <header className="relative flex items-center justify-between border-b border-edge pb-4">
        <div>
          <div className="font-mono text-sm md:text-lg tracking-[0.25em] text-muted">
            CODE<span className="text-term-green">{"{Y}"}</span>GEN · VIT CHENNAI
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mt-1">
            <span className="text-gradient-animated">DOCKER × JENKINS BOOTCAMP</span>
            <span className="ml-4 font-mono text-sm md:text-base text-term-green align-middle blink">● LIVE</span>
          </h1>
        </div>
        <div className="text-right font-mono">
          <div className="text-3xl md:text-5xl font-bold tabular-nums text-term-cyan glow-cyan rounded-lg px-2 inline-block">
            <CountUp value={deployedCount} duration={800} />
          </div>
          <div className="text-xs md:text-sm text-muted tracking-widest uppercase">deployed</div>
          <div className="text-[10px] mt-1 text-muted/60 tabular-nums">{new Date(nowTs).toLocaleTimeString("en-IN")}{!connected && <span className="text-term-red ml-2">reconnecting…</span>}</div>
        </div>
      </header>

      {/* announcements ticker */}
      {announcements.length > 0 && (
        <div className="space-y-2 relative">
          {announcements.map((a) => (
            <div key={a.id} className={`border rounded px-5 py-3 font-mono text-lg md:text-xl pop-in ${a.priority === "critical" ? "border-term-red bg-term-red/15" : a.priority === "high" ? "border-term-amber bg-term-amber/10" : "border-edge bg-panel"}`}>
              <span className={a.priority === "critical" ? "text-term-red" : a.priority === "high" ? "text-term-amber" : "text-term-cyan"}>▸ </span>
              {a.title}
            </div>
          ))}
        </div>
      )}

      {/* leaderboard — big type for back-of-lab readability */}
      <main className="flex-1 relative">
        {rows.length === 0 ? (
          <div className="h-full grid place-items-center font-mono text-2xl text-muted">
            AWAITING FIRST MISSION COMPLETION…
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="font-mono text-xs md:text-sm text-muted uppercase tracking-[0.2em] border-b border-edge">
                <th className="text-left py-3 pr-2 w-20">RANK</th>
                <th className="text-left py-3 pr-2">TEAM</th>
                <th className="text-center py-3 pr-2 w-32">MISSIONS</th>
                <th className="text-center py-3 pr-2 w-40 md:w-56">DEPLOYED AT</th>
                <th className="text-right py-3 w-36">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 14).map((r) => (
                <tr key={r.teamCode} className={`border-b border-edge/40 ${r.rank === 1 ? "podium-gold bg-term-green/10" : r.rank === 2 ? "podium-silver" : r.rank === 3 ? "podium-bronze" : ""}`}>
                  <td className="py-3 md:py-4 pr-2 font-mono font-extrabold text-xl md:text-2xl tabular-nums">
                    {(r.rank !== null && r.rank <= 3 && ["🥇", "🥈", "🥉"][r.rank - 1]) || r.rank}
                  </td>
                  <td className="py-3 md:py-4 pr-2 font-mono font-bold text-xl md:text-3xl">
                    {r.teamCode}
                    {r.award && <span className="ml-3 align-middle font-mono text-[10px] uppercase border border-term-amber/50 text-term-amber rounded px-2 py-0.5">{r.award.replace(/_/g, " ")}</span>}
                  </td>
                  <td className="py-3 md:py-4 pr-2 text-center">
                    <span className="inline-flex gap-1.5">
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={`w-4 h-4 md:w-5 md:h-5 rounded-sm inline-block ${i <= r.missionsCompleted ? "bg-term-green" : "bg-white/10"}`} />
                      ))}
                    </span>
                  </td>
                  <td className="py-3 md:py-4 pr-2 text-center font-mono tabular-nums text-term-cyan text-lg md:text-2xl">
                    {r.deploymentTime ? new Date(r.deploymentTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                  </td>
                  <td className="py-3 md:py-4 text-right">
                    <span className={`font-mono text-sm md:text-base px-3 py-1 rounded ${
                      r.finalStatus === "DEPLOYED" ? "bg-term-green/15 text-term-green" : r.finalStatus === "IN PROGRESS" ? "bg-term-amber/10 text-term-amber" : "bg-white/5 text-muted"
                    }`}>
                      {r.finalStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {/* footer strip */}
      <footer className="relative flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 font-mono text-sm md:text-base">
        <div className="tracking-[0.2em]">
          <span className="text-term-green">CODE</span>. <span className="text-term-cyan">CONTAINERIZE</span>. <span className="text-term-amber">AUTOMATE</span>. <span className="text-term-red">DEPLOY.</span>
        </div>
        {latestDeployment?.deploymentTime && (
          <div className="text-muted">
            LATEST DEPLOYMENT: <span className="text-term-green">{latestDeployment.teamCode}</span> @ {new Date(latestDeployment.deploymentTime).toLocaleTimeString("en-IN")}
          </div>
        )}
        {leader?.deploymentTime && (
          <div className="text-muted">
            FASTEST: <span className="text-term-green">{leader.teamCode}</span>
          </div>
        )}
        <Link href="/" className="text-muted hover:text-term-cyan transition-colors text-xs">mission-control.codeygen ↗</Link>
      </footer>
    </div>
  );
}
