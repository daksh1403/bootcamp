/* eslint-disable @typescript-eslint/no-explicit-any -- better-sqlite3 rows are dynamically typed; shapes enforced at usage sites */
import { getDb } from "@/lib/db";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log" };

const ACTION_COLORS: Record<string, string> = {
  mission_verified: "text-term-green",
  token_verified: "text-term-green",
  participant_approved: "text-term-cyan",
  check_in: "text-term-cyan",
  award_assigned: "text-term-amber",
  certificate_assigned: "text-term-amber",
  settings_changed: "text-term-amber",
  progress_reset: "text-term-red",
  mission_rejected: "text-term-red",
  admin_login: "text-muted",
};

export default async function AdminAuditPage() {
  const logs = (await getDb()
    .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300`)
    .all()) as Record<string, any>[];

  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// who did what, when — immutable trail"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
      </header>

      {logs.length === 0 ? (
        <EmptyState message="No auditable actions recorded yet." />
      ) : (
        <div className="border border-edge rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-edge font-mono text-[10px] uppercase tracking-wider text-muted text-left">
                <th className="px-3 py-2.5">TIME</th>
                <th className="px-3 py-2.5">ACTOR</th>
                <th className="px-3 py-2.5">ACTION</th>
                <th className="px-3 py-2.5">TARGET</th>
                <th className="px-3 py-2.5 hidden lg:table-cell">CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-edge/40 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums whitespace-nowrap">{new Date(l.created_at).toLocaleString("en-IN", { hour12: false })}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted">{l.actor_label}</td>
                  <td className={`px-3 py-2 font-mono text-[11px] ${ACTION_COLORS[l.action] ?? ""}`}>{l.action}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{l.target_id ?? l.target_type ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted max-w-[280px] truncate hidden lg:table-cell" title={`${l.old_value ?? ""} → ${l.new_value ?? ""}`}>
                    {l.old_value ? `${l.old_value} → ` : ""}{l.new_value ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
