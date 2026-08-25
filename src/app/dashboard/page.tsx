import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getParticipantByUserId } from "@/lib/services/participants";
import { getTeamByParticipantId } from "@/lib/services/teams";
import { getAllProgress, type MissionProgressRow } from "@/lib/services/missions-service";
import { listAnnouncements } from "@/lib/services/event-ops";
import { MISSIONS, MISSION_ORDER } from "@/lib/missions";
import { DigitalMissionCard, AnnouncementFeed } from "@/components/mission-card";
import { Panel, StatCard, TerminalBox, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mission Control" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { welcome } = await searchParams;

  const participant = await getParticipantByUserId(user.id);
  if (!participant) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold">No participant record linked to this account.</h1>
        <p className="mt-3 text-muted text-sm">If you registered before the platform launch, ask the crew to link your account.</p>
      </main>
    );
  }
  const team = await getTeamByParticipantId(participant.id);
  const progress: MissionProgressRow[] = team ? await getAllProgress(team.id) : [];
  const announcements = (await listAnnouncements(true)).slice(0, 5);

  const verified = progress.filter((p) => p.status === "verified").length;
  const current = progress.find((p) => p.status !== "verified" && p.status !== "locked");
  const currentDef = current ? MISSIONS[current.mission_code] : null;
  const allDone = verified === 4;

  // "What do I need to do next?" — the single most important element.
  let nextAction: React.ReactNode;
  if (participant.status === "pending") {
    nextAction = (
      <>
        <span className="text-term-amber font-mono text-xs uppercase tracking-widest block mb-2">AWAITING APPROVAL</span>
        <h2 className="text-lg font-bold">Your registration is under review.</h2>
        <p className="text-sm text-muted mt-1.5">
          The crew approves registrations continuously until event morning. Meanwhile: complete the
          <Link href="/setup" className="text-term-cyan hover:underline"> pre-event setup </Link> and run the
          <Link href="/health-check" className="text-term-cyan hover:underline"> health check</Link>.
        </p>
      </>
    );
  } else if (participant.status === "rejected") {
    nextAction = (
      <>
        <span className="text-term-red font-mono text-xs uppercase tracking-widest block mb-2">REGISTRATION REJECTED</span>
        <p className="text-sm text-muted">Contact the organizing crew at the venue desk for clarification.</p>
      </>
    );
  } else if (!team) {
    nextAction = (
      <>
        <span className="text-term-amber font-mono text-xs uppercase tracking-widest block mb-2">NO TEAM ASSIGNED</span>
        <h2 className="text-lg font-bold">See a crew member to get teamed up.</h2>
        <p className="text-sm text-muted mt-1.5">Teams are assigned at check-in — pairs preferred, solo is fine.</p>
      </>
    );
  } else if (participant.status !== "checked_in") {
    nextAction = (
      <>
        <span className="text-term-amber font-mono text-xs uppercase tracking-widest block mb-2">NOT CHECKED IN</span>
        <h2 className="text-lg font-bold">Get checked in at the lab door.</h2>
        <p className="text-sm text-muted mt-1.5">Show your Participant ID <span className="font-mono text-term-cyan">{participant.code}</span> at the registration desk between 08:45–09:30.</p>
      </>
    );
  } else if (allDone) {
    nextAction = (
      <>
        <span className="text-term-green font-mono text-xs uppercase tracking-widest block mb-2">MISSION ACCOMPLISHED</span>
        <h2 className="text-lg font-bold text-term-green">You shipped all four missions.</h2>
        <p className="text-sm text-muted mt-1.5">Watch the leaderboard, collect your certificate at 16:00, and help neighboring teams debug.</p>
      </>
    );
  } else if (current) {
    const m = current;
    nextAction = (
      <>
        <span className="text-term-cyan font-mono text-xs uppercase tracking-widest block mb-2">CURRENT OBJECTIVE → {m.mission_code} {MISSIONS[m.mission_code].name}</span>
        <p className="text-sm text-[#b7c4d0]">{currentDef?.summary}</p>
        {currentDef && (
          <div className="mt-4 flex flex-wrap gap-3">
            {m.status === "failed" ? (
              <span className="font-mono text-xs text-term-red border border-term-red/40 rounded px-3 py-2">
                RETRY NEEDED{m.verifier_note ? `: ${m.verifier_note}` : ""}
</span>
            ) : null}
            <Link
              href={`/dashboard/${m.mission_code.toLowerCase()}`}
              className="bg-term-green text-black font-semibold rounded px-5 py-2.5 font-mono text-xs tracking-[0.12em] hover:brightness-110 transition"
            >
              OPEN MISSION BRIEFING →
            </Link>
          </div>
        )}
      </>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {welcome && participant.status === "pending" && (
        <div className="mb-6 border border-term-green/40 bg-term-green/10 rounded-lg px-5 py-4 rise">
          <div className="font-mono text-sm"><span className="text-term-green">✓ Registration received.</span> Your Participant ID is <b>{participant.code}</b>.</div>
          <p className="text-xs text-muted mt-1">Save it — you&apos;ll use it at check-in. Approval usually takes a few hours.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="space-y-6 min-w-0">
          {/* identity header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">OPERATIVE</div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{participant.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">
              <span className={`border rounded px-2.5 py-1 ${participant.status === "checked_in" ? "border-term-green/40 text-term-green" : "border-edge text-muted"}`}>
                {participant.status.replace("_", " ").toUpperCase()}
              </span>
              <span className="border border-edge text-muted rounded px-2.5 py-1">{participant.ram} RAM</span>
              <span className="border border-edge text-muted rounded px-2.5 py-1">{participant.os}</span>
            </div>
          </div>

          {/* NEXT ACTION */}
          <Panel className="border-l-4 !border-l-term-cyan" title="▸ WHAT DO I DO NOW?">
            {nextAction}
          </Panel>

          {team && (
            <DigitalMissionCard
              progress={progress}
              participantCode={participant.code}
              teamCode={team.code}
              teamName={team.name ?? ""}
            />
          )}

          {/* mission grid */}
          {team && (
            <section>
              <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted mb-3">{"// YOUR DEVOPS DEPLOYMENT MISSION"}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {MISSION_ORDER.map((code) => {
                  const p = progress.find((x) => x.mission_code === code)!;
                  const def = MISSIONS[code];
                  const locked = p.status === "locked";
                  const inner = (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs tracking-[0.2em] text-muted">{code}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="font-bold tracking-wide group-hover:text-term-cyan transition-colors">{def.name}</div>
                      <p className="text-xs text-muted mt-1.5 leading-relaxed line-clamp-2">{def.tagline}</p>
                      {p.status === "verified" && (
                        <div className="mt-3 font-mono text-[11px] text-term-green">
                          ✓ {new Date(p.verified_at!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                      {p.status === "submitted" && (
                        <div className="mt-3 font-mono text-[11px] text-term-amber blink">UNDER VERIFICATION…</div>
                      )}
                    </>
                  );
                  const cls = `block border rounded-lg p-4 transition-colors group ${
                    locked
                      ? "border-edge/60 opacity-50 cursor-not-allowed"
                      : "border-edge bg-panel hover:border-term-cyan/50 cursor-pointer"
                  }`;
                  return locked ? (
                    <div key={code} className={cls}>{inner}</div>
                  ) : (
                    <Link key={code} href={`/dashboard/${code.toLowerCase()}`} className={cls}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* pipeline diagram */}
          {team && (
            <TerminalBox>
{`MISSION PIPELINE

M1 CONTAINERIZE   [${progress[0]?.status.toUpperCase().padEnd(10)}] ─┐
M2 BUILD          [${progress[1]?.status.toUpperCase().padEnd(10)}] ├─▶ M3 AUTOMATE [${progress[2]?.status.toUpperCase().padEnd(10)}]
                                                      │
                              M4 SHIP IT ◀────────────┘
                              [${progress[3]?.status.toUpperCase()}]

$ ship --production`}
            </TerminalBox>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="VERIFIED" value={`${verified}/4`} accent />
            <StatCard label="TEAM" value={team?.code ?? "—"} />
          </div>

          <Panel title="TRANSMISSIONS" right={<Link href="/announcements" className="font-mono text-[10px] text-term-cyan hover:underline">ALL →</Link>}>
            <AnnouncementFeed items={announcements} />
          </Panel>

          <Panel title="QUICK LINKS">
            <ul className="space-y-2 font-mono text-xs">
              {[
                ["/leaderboard", "LIVE LEADERBOARD"],
                ["/event/live", "PROJECTOR FEED"],
                ["/quiz", "DEVOPS TRIVIA"],
                ["/health-check", "SYSTEM HEALTH CHECK"],
                ["/timeline", "DAY TIMELINE"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="flex items-center justify-between border border-edge rounded px-3 py-2 hover:border-term-cyan/50 transition-colors">
                    {label} <span className="text-muted">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="font-mono text-[10px] text-muted leading-relaxed px-1">
            STUCK? Every mission page carries progressive hints + common-error fixes.
            Still blocked after Hint 3 — raise your hand; that&apos;s what mentors are for.
          </div>
        </div>
      </div>
    </main>
  );
}
