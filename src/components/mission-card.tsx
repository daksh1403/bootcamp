import { StatusBadge, EmptyState } from "@/components/ui";
import { Countdown } from "@/components/client-bits";
import { MISSIONS, MISSION_ORDER, STATUS_LABELS } from "@/lib/missions";
import type { MissionProgressRow } from "@/lib/services/missions-service";

function statusIcon(status: MissionProgressRow["status"]): string {
  switch (status) {
    case "verified": return "✓";
    case "submitted": return "●";
    case "failed": return "✗";
    case "locked": return "🔒";
    case "in_progress": return "▸";
    default: return "○";
  }
}

const ICON_COLOR: Record<string, string> = {
  verified: "text-term-green",
  submitted: "text-term-amber",
  failed: "text-term-red",
  locked: "text-muted/60",
  in_progress: "text-term-cyan",
  available: "text-term-cyan",
};

export function DigitalMissionCard({
  progress,
  participantCode,
  teamCode,
  teamName,
}: {
  progress: MissionProgressRow[];
  participantCode: string;
  teamCode: string | null;
  teamName: string;
}) {
  const verified = progress.filter((p) => p.status === "verified").length;
  const pct = Math.round((verified / 4) * 100);
  const current = progress.find((p) => p.status !== "verified" && p.status !== "locked");
  const allDone = verified === 4;

  return (
    <div className="border border-edge rounded-xl bg-gradient-to-br from-panel to-[#0d141c] overflow-hidden relative">
      {/* header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-edge bg-panel/80">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">DEVOPS DEPLOYMENT MISSION</div>
          <div className="font-mono text-sm mt-1 tracking-wide">
            <span className="text-muted">ID </span>
            <span className="text-term-cyan">{participantCode}</span>
            {teamCode && (
              <>
                <span className="text-muted"> · TEAM </span>
                <span className="text-term-cyan">{teamCode}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-2xl font-bold tabular-nums ${allDone ? "text-term-green" : ""}`}>{pct}%</div>
          <div className="font-mono text-[10px] text-muted tracking-widest uppercase">
            {allDone ? "FULLY DEPLOYED" : `${verified}/4 VERIFIED`}
          </div>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-1.5 bg-black/40">
        <div
          className={`h-full transition-all duration-700 ${allDone ? "bg-term-green" : "bg-term-cyan"}`}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>

      {/* missions */}
      <div className="divide-y divide-edge/60">
        {MISSION_ORDER.map((code) => {
          const p = progress.find((x) => x.mission_code === code);
          if (!p) return null;
          const isCurrent = current?.mission_code === code;
          return (
            <div key={code} className={`flex items-center gap-4 px-5 py-3.5 ${isCurrent ? "bg-term-cyan/[0.06]" : ""}`}>
              <span className={`font-mono text-lg w-8 ${ICON_COLOR[p.status] ?? "text-muted"}`}>
                {statusIcon(p.status)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm tracking-wider">
                  {code} <span className={isCurrent ? "text-term-cyan font-semibold" : ""}>{MISSIONS[code].name}</span>
                  {teamName && code === MISSION_ORDER[0] && (
                    <span className="ml-2 text-[11px] text-muted normal-case">{teamName}</span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted mt-0.5">
                  {p.verified_at
                    ? `VERIFIED ${new Date(p.verified_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                    : isCurrent
                      ? "◀ CURRENT OBJECTIVE"
                      : STATUS_LABELS[p.status]}
                </div>
              </div>
              <StatusBadge status={p.status === "submitted" ? "submitted" : p.status} />
            </div>
          );
        })}
      </div>

      {/* deployment status footer */}
      <div className="px-5 py-3 border-t border-edge bg-panel/80 font-mono text-[11px] flex items-center justify-between">
        <span className="text-muted tracking-widest uppercase">DEPLOYMENT STATUS</span>
        <span className={allDone ? "text-term-green" : "text-term-amber"}>
          {allDone ? "● SHIPPED TO PRODUCTION" : "● PENDING DEPLOYMENT"}
        </span>
      </div>
    </div>
  );
}

export function AnnouncementFeed({ items }: { items: { id: number; title: string; body: string; priority: string; countdown_to: number | null; created_at: number }[] }) {
  if (items.length === 0) {
    return <EmptyState message="No active transmissions." />;
  }
  const priorityStyles: Record<string, string> = {
    critical: "border-term-red/50 bg-term-red/10",
    high: "border-term-amber/50 bg-term-amber/10",
    normal: "border-edge bg-panel",
    low: "border-edge bg-panel opacity-75",
  };
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className={`border rounded-lg px-4 py-3 rise ${priorityStyles[a.priority]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-sm font-semibold">{a.title}</div>
              <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{a.body}</p>
            </div>
            <span className="font-mono text-[10px] text-muted shrink-0 pt-0.5">
              {new Date(a.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          {a.countdown_to && a.countdown_to > Date.now() && (
            <div className="mt-2 font-mono text-sm text-term-cyan">
              ⏱ T-{<Countdown to={a.countdown_to} />}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
