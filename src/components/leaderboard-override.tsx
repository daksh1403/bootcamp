"use client";

import { useState } from "react";
import { computeLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import type { FullLeaderboardTeam } from "@/lib/services/leaderboard-service";

export default function LeaderboardOverride({ input }: { input: FullLeaderboardTeam[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const rows: (LeaderboardEntry & { id?: number })[] = computeLeaderboard(input);

  async function setRank(teamId: number | undefined, teamCode: string, rankStr: string) {
    if (!teamId) return;
    setBusy(true);
    try {
      const rank = rankStr.trim() === "" ? null : Number(rankStr);
      await fetch("/api/admin/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, rank }),
        });
    } finally {
      setBusy(false);
      location.reload();
    }
  }

  return (
    <div className="border border-edge rounded-lg overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b border-edge font-mono text-[10px] uppercase tracking-wider text-muted text-left">
            <th className="px-3 py-2.5">RANK</th>
            <th className="px-3 py-2.5">TEAM</th>
            <th className="px-3 py-2.5 text-center">MISSIONS</th>
            <th className="px-3 py-2.5 text-center">DEPLOYED</th>
            <th className="px-3 py-2.5">STATUS</th>
            <th className="px-3 py-2.5">PIN OVERRIDE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const src = input.find((t) => t.code === r.teamCode);
            return (
              <tr key={r.teamCode} className={`border-b border-edge/40 ${r.award ? "bg-term-amber/[0.04]" : ""}`}>
                <td className="px-3 py-2 font-mono font-bold tabular-nums">{r.rank ?? "—"}</td>
                <td className="px-3 py-2 font-mono">
                  {r.teamCode}
                  {src?.challengeStarted && !src.deploymentTime && <span className="ml-2 text-[9px] uppercase text-term-cyan">challenge live</span>}
                </td>
                <td className="px-3 py-2 text-center tabular-nums">{r.missionsCompleted}/4</td>
                <td className="px-3 py-2 text-center font-mono text-xs tabular-nums">
                  {r.deploymentTime ? new Date(r.deploymentTime).toLocaleTimeString("en-IN") : "—"}
                </td>
                <td className={`px-3 py-2 font-mono text-[10px] ${r.finalStatus === "DEPLOYED" ? "text-term-green" : r.finalStatus === "IN PROGRESS" ? "text-term-amber" : "text-muted"}`}>
                  {r.finalStatus}
                </td>
                <td className="px-3 py-2">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void setRank(src?.id ?? rows[i]?.id, r.teamCode, drafts[r.teamCode] ?? String(r.rank ?? ""));
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      value={drafts[r.teamCode] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.teamCode]: e.target.value }))}
                      placeholder={String(r.rank ?? "")}
                      disabled={busy}
                      className="w-16 rounded px-2 py-1 font-mono text-xs"
                    />
                    <button type="submit" disabled={busy} className="font-mono text-[10px] border border-edge rounded px-2 py-1 hover:border-term-cyan/50">
                      PIN
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
