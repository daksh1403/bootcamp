import SiteNav from "@/components/site-nav";
import { TIMELINE } from "@/lib/event-constants";

export const metadata = { title: "Timeline" };

export default function TimelinePage() {
  return (
    <>
      <SiteNav />
      <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// systemctl status mission-day"}</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Mission Day Timeline</h1>
        <p className="mt-3 text-muted text-sm">Monday, 31 August 2026 · AB1-404B Lab, VIT Chennai</p>

        <div className="mt-10 relative">
          <div className="absolute left-[7px] sm:left-[92px] top-2 bottom-2 w-px bg-edge" aria-hidden />
          <ol className="space-y-8">
            {TIMELINE.map((t, i) => (
              <li key={t.time} className="relative grid sm:grid-cols-[80px_1fr] gap-3 sm:gap-6 pl-7 sm:pl-0">
                <div className="font-mono text-xs text-term-cyan pt-1 tabular-nums">{t.time}</div>
                <div className="relative">
                  <span
                    className={`absolute -left-[30px] sm:-left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                      i === 0 ? "bg-term-green border-term-green pulse-dot" : "bg-background border-term-cyan"
                    }`}
                    aria-hidden
                  />
                  <div className={`border rounded-lg px-5 py-4 transition-colors ${i === 0 ? "border-edge bg-panel" : "border-edge bg-panel hover:border-term-cyan/40"}`}>
                    <div className="font-mono text-sm font-semibold tracking-[0.14em]">{t.title}</div>
                    <p className="text-sm text-muted mt-1.5 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 font-mono text-xs text-muted border border-edge rounded-lg p-4 leading-relaxed">
          <span className="text-term-amber">$</span> note: timings may flex ±10 min to keep every team shipping.
          Live updates appear on your dashboard and the projector feed at <span className="text-term-cyan">/event/live</span>.
        </div>
      </main>
    </>
  );
}
