import { listCertificates } from "@/lib/services/event-ops";
import { ActionButton } from "@/components/action-button";
import { StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificates" };

const STATUS_BADGE: Record<string, string> = {
  excellence: "failed", // red-ish styling reuse for EXCELLENCE
  completed: "verified",
  attended: "approved",
};

export default async function AdminCertificatesPage() {
  const certs = await listCertificates();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
        <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// proof of work — DEPLOYED WITH DOCKER × JENKINS"}</div>
          <h1 className="text-2xl font-bold tracking-tight">Certificates</h1>
          <p className="text-sm text-muted mt-1">
            Generation is idempotent: checked-in → ATTENDED · all 4 missions verified → COMPLETED. Excellence upgrades are manual.
          </p>
        </div>
        <ActionButton
          endpoint="/api/admin/certificates"
          body={{ action: "generate" }}
          label="⚡ GENERATE / REFRESH RECORDS"
          className="bg-term-green text-black !border-transparent font-semibold hover:brightness-110"
        />
      </header>

      {certs.length === 0 ? (
        <EmptyState message="No certificate records yet — generate them after check-ins begin." />
      ) : (
        <div className="border border-edge rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-edge font-mono text-[10px] uppercase tracking-wider text-muted text-left">
                <th className="px-3 py-2.5">CERT ID</th>
                <th className="px-3 py-2.5">PARTICIPANT</th>
                <th className="px-3 py-2.5 hidden md:table-cell">REG NO</th>
                <th className="px-3 py-2.5">TEAM</th>
                <th className="px-3 py-2.5">COMPLETION</th>
                <th className="px-3 py-2.5">ISSUED</th>
                <th className="px-3 py-2.5 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-edge/40 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-xs text-term-cyan">{c.cert_code}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs hidden md:table-cell">{c.reg_no}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.team_code ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={STATUS_BADGE[c.completion_status] ?? "locked"} label={c.completion_status.toUpperCase()} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{c.issued ? "✓ YES" : "NO"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <ActionButton endpoint="/api/admin/certificates" body={{ action: "issue", certId: c.id, issued: !c.issued }} label={c.issued ? "UN-ISSUE" : "MARK ISSUED"} className="border-edge hover:border-term-green/50" />
                      {c.completion_status !== "excellence" && (
                        <ActionButton
                          endpoint="/api/admin/certificates"
                          body={{ action: "excellence", participantId: c.participant_id }}
                          label="★ EXCELLENCE"
                          className="border-term-amber/40 text-term-amber hover:bg-term-amber/10"
                        />
                      )}
                    </div>
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
