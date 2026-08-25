import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { computeLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardCached } from "@/lib/services/leaderboard-service";
import { listCertificates, awardLabel } from "@/lib/services/event-ops";
import { LeaderboardTable } from "@/components/leaderboard-table";
import SiteNav from "@/components/site-nav";
import Confetti from "@/components/fx/confetti";
import { Panel, StatCard, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results" };

export default async function ResultsPage() {
  const user = await currentUser();
  const rows = computeLeaderboard(await getLeaderboardCached(0));
  const certs = await listCertificates();
  const winners = rows.filter((r) => r.award);
  const deployed = rows.filter((r) => r.finalStatus === "DEPLOYED").length;

  return (
    <>
      <SiteNav />
      {winners.length > 0 && <Confetti count={160} />}
      <main className="max-w-5xl mx-auto px-4 py-12">
      <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// cat /var/log/mission/results"}</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Mission Debrief</h1>
        <p className="mt-2 text-muted text-sm">Docker × Jenkins Bootcamp · 31 August 2026 · AB1-404B Lab</p>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="TEAMS" value={rows.length} />
          <StatCard label="DEPLOYED" value={`${deployed}`} accent />
          <StatCard label="CERTIFICATES" value={certs.length} />
          <StatCard label="AWARDS" value={winners.length} />
        </div>

        {/* AWARDS */}
        <section className="mt-10">
<h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted mb-4">{"// HALL OF FAME"}</h2>
          {winners.length === 0 ? (
            <EmptyState message="Awards pending final verification." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {winners.map((w) => (
                <div key={w.teamCode} className="border border-term-amber/40 bg-term-amber/5 rounded-lg p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-term-amber">{awardLabel(w.award!)}</div>
                  <div className="mt-2 text-xl font-bold">{w.members[0] ? `${w.teamCode}` : w.teamCode}</div>
                  <div className="font-mono text-sm mt-1">
                    Rank #{w.rank} · {w.missionsCompleted}/4 missions
                    {w.deploymentTime && ` · deployed ${new Date(w.deploymentTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FINAL LEADERBOARD */}
        <section className="mt-10">
<h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted mb-4">{"// FINAL STANDINGS"}</h2>
          <Panel className="!p-0 overflow-hidden">
            <LeaderboardTable rows={rows} />
          </Panel>
        </section>

        {/* PERSONAL */}
        {user?.role === "participant" && (
          <section className="mt-10 text-center">
            <Link href="/dashboard" className="inline-block bg-term-green text-black font-semibold rounded px-6 py-3 font-mono text-sm tracking-wider hover:brightness-110 transition">
              VIEW YOUR COMPLETION STATUS →
            </Link>
          </section>
        )}
      </main>
    </>
  );
}
