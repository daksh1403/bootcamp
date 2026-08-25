import type { LeaderboardEntry } from "@/lib/leaderboard";
import { EmptyState } from "@/components/ui";

export function timeStr(t: number | null): string {
  return t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardTable({ rows, compact = false }: { rows: LeaderboardEntry[]; compact?: boolean }) {
  if (rows.length === 0) return <EmptyState message="No teams on the board yet — the race starts at M1." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-edge font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <th className="text-left px-3 py-3">RANK</th>
            <th className="text-left px-3 py-3">TEAM</th>
            {!compact && <th className="text-left px-3 py-3 hidden md:table-cell">OPERATIVES</th>}
            <th className="text-center px-3 py-3">MISSIONS</th>
            <th className="text-center px-3 py-3">DEPLOYMENT TIME</th>
            <th className="text-right px-3 py-3">STATUS</th>
          </tr>
        </thead>
        <tbody className={compact ? "text-base md:text-lg" : ""}>
          {rows.map((r) => (
            <tr
              key={r.teamCode}
              className={`border-b border-edge/50 transition-colors ${
                r.rank === 1
                  ? "bg-term-green/[0.07]"
                  : r.finalStatus === "DEPLOYED"
                    ? "hover:bg-white/[0.02]"
                    : "opacity-80 hover:opacity-100"
              } ${r.rank === 1 ? "podium-gold" : r.rank === 2 ? "podium-silver" : r.rank === 3 ? "podium-bronze" : ""}`}
            >
              <td className="px-3 py-2.5 font-mono font-bold tabular-nums">
                {(r.rank !== null && r.rank <= 3 && MEDALS[r.rank - 1]) || (
                  <span className={r.rank === 1 ? "text-term-green" : "text-muted"}>{r.rank ?? "—"}</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span className="font-mono">{r.teamCode}</span>
                {r.teamName && !compact && <span className="text-muted ml-2 hidden sm:inline">{r.teamName}</span>}
                {r.award && <span className="ml-2 font-mono text-[9px] uppercase tracking-wider border border-term-amber/40 text-term-amber rounded px-1.5 py-0.5">{r.award.replace(/_/g, " ")}</span>}
              </td>
              {!compact && (
                <td className="px-3 py-2.5 text-muted text-xs hidden md:table-cell max-w-[180px] truncate">{r.members.join(", ")}</td>
              )}
              <td className="px-3 py-2.5 text-center tabular-nums">
                <span className="font-mono">{r.missionsCompleted}/4</span>
                <div className="hidden sm:inline-flex gap-[3px] ml-2 align-middle">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={`w-2 h-2 rounded-sm inline-block ${i <= r.missionsCompleted ? "bg-term-green" : "bg-white/10"}`} />
                  ))}
                </div>
              </td>
              <td className="px-3 py-2.5 text-center font-mono tabular-nums text-term-cyan">
                {timeStr(r.deploymentTime)}
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className={`font-mono text-[10px] tracking-wider px-2 py-1 rounded ${
                  r.finalStatus === "DEPLOYED"
                    ? "bg-term-green/10 text-term-green"
                    : r.finalStatus === "IN PROGRESS"
                      ? "bg-term-amber/10 text-term-amber"
                      : "bg-white/5 text-muted"
                }`}>
                  {r.finalStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
