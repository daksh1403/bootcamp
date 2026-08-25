import Link from "next/link";
import SiteNav from "@/components/site-nav";
import AuroraBackground from "@/components/fx/aurora-background";
import CountUp from "@/components/fx/count-up";
import Marquee from "@/components/fx/marquee";
import { EVENT, TIMELINE } from "@/lib/event-constants";
import { MISSIONS, MISSION_ORDER } from "@/lib/missions";
import { getEventStats } from "@/lib/services/stats";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const settings = await getSettings();
  if (settings.postEventMode) {
    // Post-event landing routes attention to results.
    return (
      <>
        <SiteNav />
        <main className="max-w-3xl mx-auto px-4 py-24 text-center rise">
          <div className="font-mono text-term-green mb-4">[ mission complete ]</div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">The DevOps Deployment Mission has landed.</h1>
          <p className="mt-4 text-muted">
            Winners, final leaderboard and certificates are now live.
          </p>
          <div className="mt-8 flex justify-center gap-3 flex-wrap">
            <Link href="/results" className="bg-term-green text-black font-semibold rounded px-6 py-3 hover:brightness-110 transition font-mono text-sm tracking-wider">
              VIEW RESULTS →
            </Link>
            <Link href="/leaderboard" className="border border-edge rounded px-6 py-3 font-mono text-sm tracking-wider hover:border-term-cyan/50 transition-colors">
              FINAL LEADERBOARD
            </Link>
          </div>
        </main>
      </>
    );
  }

  let stats: Awaited<ReturnType<typeof getEventStats>> | null = null;
  try {
    stats = await getEventStats();
  } catch {
    stats = null;
  }

  return (
    <>
      <SiteNav />
      <main>
        {/* HERO */}
        <section className="grid-bg border-b border-edge relative overflow-hidden">
          <AuroraBackground density={80} />
          <div className="max-w-6xl mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24 relative">
            <div className="font-mono text-[11px] md:text-xs text-muted mb-6 tracking-[0.18em] rise">
              <span className="text-term-green">$</span> codeygen init --mission devops-deployment
              <span className="blink text-term-cyan">▊</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.02] rise">
              <span className="text-gradient-animated">DOCKER × JENKINS</span>
              <br />
              BOOTCAMP
            </h1>
            <p className="mt-4 font-mono text-sm md:text-base tracking-[0.22em] text-term-amber rise">
              THE DEVOPS DEPLOYMENT MISSION
            </p>
            <p className="mt-6 max-w-xl text-lg md:text-xl text-[#b7c4d0] leading-relaxed rise">
              Production is down. Can you ship the fix?
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 rise">
              <Link
                href="/register"
                className="bg-term-green text-black font-semibold rounded px-6 py-3.5 font-mono text-sm tracking-[0.12em] hover:brightness-110 transition shadow-[0_0_30px_rgba(74,222,128,0.15)]"
              >
                REGISTER NOW →
              </Link>
              <Link
                href={settings.eventMode ? "/dashboard" : "/login"}
                className="border border-term-cyan/40 text-term-cyan rounded px-6 py-3.5 font-mono text-sm tracking-[0.12em] hover:bg-term-cyan/10 transition"
              >
                ENTER MISSION CONTROL
              </Link>
              <span className="font-mono text-[11px] text-muted tracking-wider ml-1">
                {stats ? (
                  <>
                    <span className="text-term-green font-semibold">
                      <CountUp value={stats.totalRegistered} />
                    </span>
                    /{EVENT.capacity} OPERATIVES REGISTERED
                  </>
                ) : (
                  ""
                )}
              </span>
            </div>

            {/* key facts strip */}
            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-px bg-edge border border-edge rounded-lg overflow-hidden">
              {[
                ["DATE", EVENT.dateShort],
                ["VENUE", "AB1-404B LAB"],
                ["RESOURCE", EVENT.resourcePerson],
                ["CREW", "CODE{Y}GEN VITC"],
              ].map(([k, v]) => (
                <div key={k} className="bg-panel px-4 py-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{k}</div>
                  <div className="mt-1.5 font-medium text-sm">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MOTTO */}
        <section className="border-b border-edge bg-panel/50 py-8 overflow-hidden">
          <Marquee
            items={["CODE", "CONTAINERIZE", "AUTOMATE", "DEPLOY"]}
            speed={18}
            className="font-display text-2xl md:text-4xl font-extrabold tracking-[0.12em]"
          />
          <p className="mt-5 text-center font-mono text-xs tracking-[0.25em] text-muted uppercase px-4">
            {EVENT.principle}
          </p>
        </section>

        {/* MISSIONS */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your deployment pipeline</h2>
            <span className="font-mono text-xs text-muted hidden sm:block">{"// four missions. one production launch."}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MISSION_ORDER.map((code, i) => {
              const m = MISSIONS[code];
              return (
                <div
                  key={code}
                  className="card-shine pop-in border border-edge bg-panel rounded-lg p-5 hover:border-term-cyan/40 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="absolute top-3 right-4 font-mono text-[10px] text-muted/60">{String(i + 1).padStart(2, "0")}/04</div>
                  <div className="font-mono text-xs text-term-cyan tracking-[0.2em]">{code}</div>
                  <h3 className="mt-2 text-lg font-bold tracking-wide group-hover:text-term-cyan transition-colors">{m.name}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{m.tagline}</p>
                  <div className="mt-4 font-mono text-[11px] text-muted/70">~{m.estMinutes} MIN</div>
                  {i < 3 && <div className="hidden lg:block absolute -right-[9px] top-1/2 text-edge text-lg z-10 select-none">▸</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* TIMELINE PREVIEW */}
        <section className="max-w-6xl mx-auto px-4 pb-16 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Mission day timeline</h2>
            <ol className="space-y-0 border-l border-edge ml-2">
              {TIMELINE.map((t) => (
                <li key={t.time} className="relative pl-6 pb-6 last:pb-0">
                  <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-term-cyan" />
                  <div className="font-mono text-xs text-term-cyan">{t.time}</div>
                  <div className="font-mono text-sm font-semibold tracking-wider mt-0.5">{t.title}</div>
                  <div className="text-sm text-muted mt-1">{t.desc}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-6">
            <div className="border border-edge bg-panel rounded-lg p-6">
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-4">Prerequisites</h3>
              <ul className="space-y-2.5 text-sm">
                {EVENT.prerequisites.map((p) => (
                  <li key={p} className="flex gap-2.5">
                    <span className="text-term-green font-mono">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-term-amber/30 bg-term-amber/5 rounded-lg p-6">
              <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-term-amber mb-3">Before you arrive</h3>
              <p className="text-sm text-[#b7c4d0] leading-relaxed">
                Complete the pre-event setup and run the technical health check so event day is spent deploying — not debugging installs.
              </p>
              <div className="mt-4 flex gap-3 flex-wrap">
                <Link href="/setup" className="font-mono text-xs tracking-wider border border-edge rounded px-3 py-2 hover:border-term-cyan/50 transition-colors">
                  SETUP GUIDE →
                </Link>
                <Link href="/health-check" className="font-mono text-xs tracking-wider border border-edge rounded px-3 py-2 hover:border-term-cyan/50 transition-colors">
                  RUN HEALTH CHECK →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FOOT */}
        <section className="border-t border-edge bg-panel/50">
          <div className="max-w-6xl mx-auto px-4 py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Don&apos;t watch the demo. Be the deployment.</h2>
            <p className="mt-3 text-muted max-w-lg mx-auto">
              {EVENT.capacity} seats. One lab. Four missions. Everyone ships.
            </p>
            <Link
              href="/register"
              className="inline-block mt-8 bg-term-green text-black font-semibold rounded px-8 py-4 font-mono text-sm tracking-[0.12em] hover:brightness-110 hover:scale-[1.03] transition glow-green"
            >
              SECURE YOUR SEAT →
            </Link>
          </div>
        </section>

        <footer className="border-t border-edge">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between gap-4 font-mono text-[11px] text-muted tracking-wider">
            <span>{EVENT.organizer}</span>
            <span>{EVENT.date} · {EVENT.venue}</span>
            <span>RESOURCE PERSON: {EVENT.resourcePerson.toUpperCase()}</span>
          </div>
        </footer>
      </main>
    </>
  );
}
