import { getEventStats } from "@/lib/services/stats";
import { getLeaderboardCached } from "@/lib/services/leaderboard-service";
import { computeLeaderboard } from "@/lib/leaderboard";
import { listAnnouncements } from "@/lib/services/event-ops";
import { StatCard, Panel, Bar, StatusBadge } from "@/components/ui";
import { LeaderboardTable } from "@/components/leaderboard-table";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Control Center" };

export default async function AdminHome() {
  const stats = await getEventStats();
  const rows = computeLeaderboard(await getLeaderboardCached(0));
  const announcements = await listAnnouncements(true);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
        <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// mission ops — single source of truth"}</div>
          <h1 className="text-2xl font-bold tracking-tight">Event Control Center</h1>
        </div>
        <Link href="/event/live" target="_blank" className="font-mono text-[11px] border border-edge rounded px-3 py-2 hover:border-term-cyan/50 transition-colors">
          OPEN PROJECTOR FEED ↗
        </Link>
      </header>

      {/* headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="REGISTERED" value={stats.totalRegistered} accent />
        <StatCard label="CHECKED IN" value={stats.checkedIn} />
        <StatCard label="TEAMS" value={stats.teams} />
        <StatCard label="PENDING VERIFY" value={stats.pendingVerifications} />
        <StatCard label="DEPLOYED" value={stats.shipItDeployed} accent />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* NEEDS ATTENTION */}
        <Panel title="⚠ NEEDS ATTENTION">
          {stats.needsAttention.length === 0 ? (
            <p className="text-sm text-muted font-mono">ALL CLEAR — nothing needs you right now.</p>
          ) : (
            <ul className="space-y-2">
              {stats.needsAttention.map((a, i) => (
                <li key={i} className={`border rounded px-3 py-2 text-sm ${a.level === "critical" ? "border-term-red/50 bg-term-red/10" : a.level === "warn" ? "border-term-amber/50 bg-term-amber/10" : "border-edge bg-white/[0.02]"}`}>
                  {a.message}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t border-edge grid grid-cols-2 gap-2">
            <Link href="/admin/verifications" className="font-mono text-[11px] border border-edge rounded px-3 py-2 text-center hover:border-term-cyan/50 transition-colors">REVIEW QUEUE →</Link>
            <Link href="/admin/checkin" className="font-mono text-[11px] border border-edge rounded px-3 py-2 text-center hover:border-term-cyan/50 transition-colors">CHECK-IN DESK →</Link>
          </div>
        </Panel>

        {/* MISSION PROGRESS */}
        <Panel title="LIVE EVENT STATUS">
          <div className="space-y-3.5">
            <Bar count={stats.checkedIn} total={Math.max(stats.totalRegistered, 1)} label="CHECKED IN" />
            <Bar count={stats.m1Done} total={Math.max(stats.teams, 1)} label="M1 CONTAINERIZE" />
            <Bar count={stats.m2Done} total={Math.max(stats.teams, 1)} label="M2 BUILD" />
            <Bar count={stats.m3Done} total={Math.max(stats.teams, 1)} label="M3 AUTOMATE" />
            <Bar count={stats.m4Done} total={Math.max(stats.teams, 1)} label="M4 SHIP IT" />
          </div>
        </Panel>

        {/* REGISTRATION BREAKDOWN */}
        <Panel title="REGISTRATIONS">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="PENDING" value={stats.pending} />
            <StatCard label="APPROVED" value={stats.approved} />
            <StatCard label="REJECTED" value={stats.rejected} />
            <StatCard label="IN LAB" value={stats.checkedIn} />
          </div>
          <p className="mt-4 font-mono text-[11px] text-muted">
            Docker-not-installed flags: see participants page filter · Active teams (activity last 30m): {stats.activeParticipants}
          </p>
        </Panel>

        {/* CURRENT LEADER */}
        <Panel title="WHO IS WINNING?" right={<Link href="/admin/leaderboard" className="font-mono text-[10px] text-term-cyan hover:underline">CONTROL →</Link>}>
          {rows.length === 0 || rows.every((r) => r.missionsCompleted === 0) ? (
            <p className="text-sm text-muted font-mono">No missions verified yet.</p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">🥇</span>
                <div>
                  <div className="font-mono font-bold text-lg">{rows[0].teamCode}</div>
                  <div className="font-mono text-xs text-muted">{rows[0].missionsCompleted}/4 · {rows[0].finalStatus}</div>
                </div>
              </div>
              <div className="border-t border-edge pt-3">
                <LeaderboardTable rows={rows.slice(0, 5)} compact />
              </div>
            </>
          )}
        </Panel>

        {/* ACTIVE ANNOUNCEMENTS */}
        <Panel title="ACTIVE TRANSMISSIONS" right={<Link href="/admin/announcements" className="font-mono text-[10px] text-term-cyan hover:underline">PUBLISH →</Link>}>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted font-mono">Nothing broadcast yet.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm border border-edge rounded px-3 py-2">
                  <b>{a.title}</b>
                  <StatusBadge status={a.priority === "critical" ? "failed" : a.priority === "high" ? "submitted" : "approved"} label={a.priority.toUpperCase()} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
