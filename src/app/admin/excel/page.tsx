import Link from "next/link";
import ImportForm from "@/components/import-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Excel / Backup" };

const SHEETS = [
  ["Participants", "Participant ID · Team ID · Name · Reg No · Email · Phone · Branch · Year · RAM · OS · Docker · GitHub · Reg Status · Check-in"],
  ["Missions", "Team ID · M1–M4 status & timestamps · Verified By"],
  ["Ship It", "Team ID · Challenge Start · Attempt Count · Token Status · Deployment Time · Verification Status · Verified By"],
  ["Leaderboard", "Rank · Team ID · Team Name · Missions Completed · Deployment Time · Final Status · Award"],
  ["Certificates", "Participant · Registration Number · Team ID · Completion Status · Certificate ID · Issued · Award"],
];

export default function AdminExcelPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// organizer master record & verification workflow"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Excel / Backup Center</h1>
        <p className="text-sm text-muted mt-2">
          The website is the live system; the workbook is the official organizer-side master record. Export anytime — even mid-event.
          Import accepts the same Participants sheet format for bulk registration intake.
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        <Link href="/api/admin/export/xlsx" prefetch={false}
          className="block border border-term-green/40 bg-term-green/5 rounded-lg p-5 hover:bg-term-green/10 transition-colors group">
          <div className="font-mono text-lg">▤ .XLSX</div>
          <p className="text-sm text-muted mt-1.5">Full 5-sheet master workbook</p>
          <span className="font-mono text-[11px] text-term-cyan inline-block mt-3 group-hover:translate-x-0.5 transition-transform">DOWNLOAD →</span>
        </Link>
        <Link href="/api/admin/export/csv" prefetch={false}
          className="block border border-edge bg-panel rounded-lg p-5 hover:border-term-cyan/50 transition-colors group">
          <div className="font-mono text-lg">▥ .CSV</div>
          <p className="text-sm text-muted mt-1.5">Results export for quick diffs</p>
          <span className="font-mono text-[11px] text-term-cyan inline-block mt-3 group-hover:translate-x-0.5 transition-transform">DOWNLOAD →</span>
        </Link>
        <Link href="/api/admin/export/json" prefetch={false}
          className="block border border-edge bg-panel rounded-lg p-5 hover:border-term-cyan/50 transition-colors group">
          <div className="font-mono text-lg">▦ .JSON</div>
          <p className="text-sm text-muted mt-1.5">Complete event backup (reconstructable)</p>
          <span className="font-mono text-[11px] text-term-cyan inline-block mt-3 group-hover:translate-x-0.5 transition-transform">DOWNLOAD →</span>
        </Link>
      </div>

      <section>
<h2 className="font-mono text-xs uppercase tracking-widest text-muted mb-3">{"// WORKBOOK STRUCTURE"}</h2>
        <div className="border border-edge rounded-lg overflow-hidden">
          {SHEETS.map(([name, cols], i) => (
            <div key={name} className={`px-4 py-3 ${i !== 0 ? "border-t border-edge" : ""} grid md:grid-cols-[140px_1fr] gap-1`}>
              <div className="font-mono text-sm text-term-cyan">{name}</div>
              <div className="text-xs text-muted leading-relaxed">{cols}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-edge rounded-lg p-5">
<h2 className="font-mono text-xs uppercase tracking-widest text-muted mb-3">{"// IMPORT REGISTRATIONS (.xlsx)"}</h2>
        <ImportForm />
      </section>
      <section className="border border-term-amber/30 bg-term-amber/5 rounded-lg p-5 font-mono text-xs leading-relaxed">
        <b className="text-term-amber uppercase tracking-widest block mb-2">Event-day drill</b>
        1. Keep this page open in a pinned tab.<br />
        2. After each verification wave, hit .XLSX — the file always reflects current state.<br />
        3. If the venue network dies, the JSON backup taken at lunch is your offline fallback.
      </section>
    </div>
  );
}
