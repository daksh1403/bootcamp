import SiteNav from "@/components/site-nav";
import Confetti from "@/components/fx/confetti";
import { computeLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardCached } from "@/lib/services/leaderboard-service";
import { listAnnouncements } from "@/lib/services/event-ops";
import { LeaderboardTable, timeStr } from "@/components/leaderboard-table";
import { Panel } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Leaderboard" };

export default async function LeaderboardPage() {
  const rows = computeLeaderboard(await getLeaderboardCached(0));
  const announcements = (await listAnnouncements(true)).slice(0, 3);
  const settings = await getSettings();

  return (
    <>
      <SiteNav />
      {rows[0]?.finalStatus === "DEPLOYED" && <Confetti count={120} />}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {rows[0]?.finalStatus === "DEPLOYED" && (
          <div className="pop-in glow-green border border-term-green/40 bg-term-green/5 rounded-xl px-5 py-4 mb-6 flex flex-wrap items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="font-display font-bold text-lg leading-tight">
                {rows[0].teamCode} holds the lead
              </div>
              <div className="font-mono text-[11px] text-muted tracking-wider">
                FIRST VERIFIED DEPLOYMENT AT {timeStr(rows[0].deploymentTime)} — EVERYONE ELSE, CATCH UP.
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
          <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// watch -n 3 mission-standings"}</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Live Leaderboard
              {settings.eventMode && <span className="ml-3 font-mono text-xs text-term-green align-middle blink">● LIVE</span>}
            </h1>
          </div>
          <div className="font-mono text-[11px] text-muted leading-relaxed text-right hidden sm:block">
            RANKING: ① VERIFIED DEPLOYMENT TIME<br />② MISSIONS COMPLETED
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="mt-6 space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className={`border rounded-lg px-4 py-2.5 font-mono text-sm ${a.priority === "critical" ? "border-term-red/50 bg-term-red/10" : a.priority === "high" ? "border-term-amber/50 bg-term-amber/10" : "border-edge bg-panel"}`}>
                <span className={a.priority === "critical" ? "text-term-red" : a.priority === "high" ? "text-term-amber" : "text-term-cyan"}>▸ </span>
                <b>{a.title}</b>
                {a.body && <span className="text-muted"> — {a.body}</span>}
              </div>
            ))}
          </div>
        )}

        <Panel className="mt-6 !p-0 overflow-hidden" >
          <LeaderboardTable rows={rows} />
        </Panel>

        {rows[0]?.deploymentTime && (
          <p className="mt-4 font-mono text-xs text-muted text-center">
            FIRST BLOOD: {rows[0].teamCode} deployed at {timeStr(rows[0].deploymentTime)}
          </p>
        )}
      </main>
    </>
  );
}
