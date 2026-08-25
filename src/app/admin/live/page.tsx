/* eslint-disable @typescript-eslint/no-explicit-any -- better-sqlite3 rows are dynamically typed; shapes enforced at usage sites */
import { getDb, now } from "@/lib/db";
import { getEventStats } from "@/lib/services/stats";
import { Bar, StatusBadge } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Event Status" };

const STATUS_ORDER = ["verified", "submitted", "failed", "available", "in_progress", "locked"];

export default async function AdminLivePage({ searchParams }: { searchParams: Promise<{ mission?: string; status?: string }> }) {
  const { mission = "all", status: statusFilter = "all" } = await searchParams;
  const db = getDb();
  const stats = await getEventStats();

  let sql = `SELECT mp.*, t.code AS team_code FROM mission_progress mp JOIN teams t ON t.id = mp.team_id WHERE 1=1`;
  const params: string[] = [];
  if (mission !== "all") {
    sql += ` AND mp.mission_code = ?`;
    params.push(mission);
  }
  if (statusFilter !== "all") {
    sql += ` AND mp.status = ?`;
    params.push(statusFilter);
  }
  sql += ` ORDER BY t.code, mp.mission_code`;
  const rows = (await db.prepare(sql).all(...params)) as Record<string, any>[];

  // stuck teams: checked-in teams whose current mission hasn't moved in 25 min
  const stuck = ((await db.prepare(
    `SELECT t.code AS team_code, mp.mission_code, mp.status, mp.updated_at
     FROM teams t JOIN mission_progress mp ON mp.team_id = t.id
     WHERE mp.status NOT IN ('verified','locked') AND mp.updated_at < ?
     ORDER BY mp.updated_at ASC LIMIT 12`
  ).all(now() - 25 * 60_000)) as Record<string, any>[]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
        <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// room telemetry — refreshed on load"}</div>
          <h1 className="text-2xl font-bold tracking-tight">Live Event Status</h1>
        </div>
        <Link href="/admin/live" className="font-mono text-[11px] border border-edge rounded px-3 py-2 hover:border-term-cyan/50 transition-colors">
          ⟳ REFRESH
        </Link>
      </header>

      {/* bars */}
      <div className="border border-edge bg-panel rounded-lg p-5 font-mono space-y-4">
        <Bar count={stats.checkedIn} total={Math.max(stats.totalRegistered, 1)} label="CHECKED IN" />
        <Bar count={stats.m1Done} total={Math.max(stats.teams, 1)} label="M1 CONTAINERIZE" />
        <Bar count={stats.m2Done} total={Math.max(stats.teams, 1)} label="M2 BUILD" />
        <Bar count={stats.m3Done} total={Math.max(stats.teams, 1)} label="M3 AUTOMATE" />
        <Bar count={stats.m4Done} total={Math.max(stats.teams, 1)} label="M4 SHIP IT" />
      </div>

      {/* stuck panel */}
      <section>
<h2 className="font-mono text-xs uppercase tracking-widest text-term-amber mb-2">{"// IDLE 25+ MIN — GO HELP THEM"}</h2>
        {stuck.length === 0 ? (
          <p className="text-sm text-muted font-mono">No teams idle. The room is shipping.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stuck.map((s) => (
              <li key={s.team_code + s.mission_code} className="border border-term-amber/40 bg-term-amber/5 rounded px-3 py-2 font-mono text-xs flex justify-between">
                <span>{s.team_code} · {s.mission_code}</span>
                <span className="text-muted">{Math.round((now() - s.updated_at) / 60000)}m idle</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* filterable table */}
      <section className="space-y-3">
        <form className="flex flex-wrap gap-2 items-center font-mono text-[11px]">
          <span className="text-muted uppercase tracking-widest">FILTER:</span>
          {["all", "M1", "M2", "M3", "M4"].map((m) => (
            <button
              key={m}
              name="mission"
              value={m}
              className={`rounded px-2.5 py-1.5 border ${mission === m ? "border-term-cyan text-term-cyan" : "border-edge text-muted"}`}
            >
              {m.toUpperCase()}
            </button>
          ))}
          <span className="w-4" />
          {["all", ...STATUS_ORDER].map((s) => (
            <button
              key={s}
              name="status"
              value={s}
              className={`rounded px-2.5 py-1.5 border ${statusFilter === s ? "border-term-cyan text-term-cyan" : "border-edge text-muted"}`}
            >
              {s.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </form>

        <div className="border border-edge rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-edge font-mono text-[10px] uppercase tracking-wider text-muted text-left">
                <th className="px-3 py-2.5">TEAM</th>
                <th className="px-3 py-2.5">MISSION</th>
                <th className="px-3 py-2.5">STATUS</th>
                <th className="px-3 py-2.5">ATTEMPTS</th>
                <th className="px-3 py-2.5">LAST ACTIVITY</th>
                <th className="px-3 py-2.5 hidden md:table-cell">VERIFIED BY</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-edge/40 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono">{r.team_code}</td>
                  <td className="px-3 py-2 font-mono">{r.mission_code}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 tabular-nums">{r.attempt_count}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">{new Date(r.updated_at).toLocaleTimeString("en-IN")}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted hidden md:table-cell">{r.verified_by ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center font-mono text-xs text-muted">no rows for this filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
