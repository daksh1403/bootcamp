import SiteNav from "@/components/site-nav";
import { EVENT } from "@/lib/event-constants";
import { Panel } from "@/components/ui";

export const metadata = { title: "Event Info" };

export default function EventInfoPage() {
  const rows: [string, React.ReactNode][] = [
    ["EVENT", <span key="ev" className="font-semibold">Docker × Jenkins Bootcamp</span>],
    ["THEME", "The DevOps Deployment Mission"],
    ["DATE", EVENT.date],
    ["VENUE", EVENT.venue],
    ["ORGANIZER", EVENT.organizer],
    ["RESOURCE PERSON", <span key="rp" className="font-semibold text-term-cyan">{EVENT.resourcePerson}</span>],
    ["CAPACITY", `${EVENT.capacity} participants`],
  ];

  return (
    <>
      <SiteNav />
      <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// cat /etc/mission/event.conf"}</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Event Information</h1>

        <div className="mt-8 border border-edge rounded-lg overflow-hidden bg-panel">
          {rows.map(([k, v], i) => (
            <div key={k} className={`grid grid-cols-3 sm:grid-cols-5 gap-2 px-5 py-3.5 ${i !== 0 ? "border-t border-edge" : ""}`}>
              <div className="col-span-1 font-mono text-[11px] uppercase tracking-wider text-muted pt-0.5">{k}</div>
              <div className="col-span-2 sm:col-span-4 text-sm">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <Panel title="AUDIENCE">
            <p className="text-sm leading-relaxed text-[#b7c4d0]">{EVENT.audience}</p>
          </Panel>
          <Panel title="PREREQUISITES">
            <ul className="space-y-2 text-sm">
              {EVENT.prerequisites.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span className="text-term-green font-mono shrink-0">✓</span> {p}
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <Panel title="OPERATING CREW">
            <ul className="space-y-3">
              {EVENT.crew.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="font-mono text-[11px] text-muted uppercase tracking-wider text-right">{c.role}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="WHAT YOU WILL ACTUALLY DO">
            <ol className="space-y-2.5 text-sm">
              {[
                "Run and build real Docker containers",
                "Write and improve a Dockerfile",
                "Automate build → test → image → deploy with Jenkins",
                "Ship a fresh application end-to-end, solo",
                "Verify your deployment with a secret token",
              ].map((s, i) => (
                <li key={s} className="flex gap-2.5">
                  <span className="font-mono text-term-cyan text-xs pt-0.5">{String(i + 1).padStart(2, "0")}</span> {s}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </main>
    </>
  );
}
