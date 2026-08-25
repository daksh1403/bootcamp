import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getParticipantByUserId } from "@/lib/services/participants";
import { getTeamByParticipantId } from "@/lib/services/teams";
import { getAllProgress } from "@/lib/services/missions-service";
import { MISSIONS, MISSION_ORDER, type MissionCode, STATUS_LABELS } from "@/lib/missions";
import { StatusBadge, Panel, TerminalBox } from "@/components/ui";
import { HintStack, MissionSubmissionForm, TokenSubmissionForm, CmdBlock } from "@/components/mission-forms";
import { Countdown } from "@/components/client-bits";
import { getSettings } from "@/lib/settings";

export async function renderMissionPage(code: MissionCode) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const participant = await getParticipantByUserId(user.id);
  const team = participant ? await getTeamByParticipantId(participant.id) : undefined;
  if (!participant || !team) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Mission access requires a team.</h1>
        <Link href="/dashboard" className="inline-block mt-4 font-mono text-xs text-term-cyan hover:underline">← BACK TO MISSION CONTROL</Link>
      </main>
    );
  }
  const progress = await getAllProgress(team.id);
  const p = progress.find((x) => x.mission_code === code)!;
  const def = MISSIONS[code];

  if (p.status === "locked") {
    const prevIdx = MISSION_ORDER.indexOf(code) - 1;
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="font-mono text-5xl mb-4 opacity-40">🔒</div>
        <h1 className="text-2xl font-bold">{code} {def.name} IS LOCKED</h1>
        <p className="mt-3 text-muted text-sm">
          Complete and get {MISSION_ORDER[prevIdx]} verified first. Current status:{" "}
          <StatusBadge status={progress[prevIdx].status} />
        </p>
        <Link href={`/dashboard/${MISSION_ORDER[prevIdx].toLowerCase()}`} className="inline-block mt-6 bg-term-green text-black font-semibold rounded px-5 py-2.5 font-mono text-xs tracking-wider hover:brightness-110 transition">
          GO TO {MISSION_ORDER[prevIdx]} →
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* mission header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// MISSION BRIEFING · "}{def.phase}</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-extrabold tracking-tight">
            <span className="text-term-cyan mr-3">{code}</span>
            {def.name}
          </h1>
          <p className="font-mono text-sm text-muted mt-2">{def.tagline}</p>
        </div>
        <div className="text-right space-y-2">
          <StatusBadge status={p.status} label={STATUS_LABELS[p.status]} />
          <div className="font-mono text-[11px] text-muted">EST ~{def.estMinutes} MIN</div>
          {team.challenge_started_at && code === "M4" && (
            <div className="font-mono text-lg text-term-cyan">
              <Countdown to={team.challenge_started_at + (await getSettings()).challengeDurationMin * 60_000} />
            </div>
          )}
        </div>
      </div>

      {p.status === "failed" && (
        <div className="mt-6 border border-term-red/40 bg-term-red/10 rounded-lg px-5 py-4">
          <b className="font-mono text-term-red text-sm">✗ VERIFICATION FAILED / RETRY REQUESTED</b>
          {p.verifier_note && <p className="text-sm mt-1.5">Mentor note: “{p.verifier_note}”</p>}
          <p className="text-xs text-muted mt-2">Fix the issue and resubmit below.</p>
        </div>
      )}
      {p.status === "verified" && (
        <div className="mt-6 border border-term-green/40 bg-term-green/10 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="font-mono text-term-green text-sm">✓ {code} VERIFIED</b>
            <span className="text-muted text-sm ml-3">
              at {new Date(p.verified_at!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} by {p.verified_by}
            </span>
          </div>
          {code !== "M4" ? (
            <Link href={`/dashboard/${MISSION_ORDER[MISSION_ORDER.indexOf(code) + 1].toLowerCase()}`} className="bg-term-green text-black font-semibold rounded px-4 py-2 font-mono text-xs tracking-wider hover:brightness-110 transition">
              PROCEED TO {MISSION_ORDER[MISSION_ORDER.indexOf(code) + 1]} →
            </Link>
          ) : (
            <Link href="/leaderboard" className="bg-term-green text-black font-semibold rounded px-4 py-2 font-mono text-xs tracking-wider hover:brightness-110 transition">
              VIEW LEADERBOARD →
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Panel title="OBJECTIVE">
            <p className="text-sm leading-relaxed text-[#b7c4d0]">{def.summary}</p>
          </Panel>

          {p.status !== "submitted" || p.submitted_payload == null ? null : (
            <Panel title="YOUR SUBMISSION (PENDING REVIEW)">
              <TerminalBox>{JSON.stringify(JSON.parse(p.submitted_payload ?? "{}"), null, 2)}</TerminalBox>
              <p className="font-mono text-[11px] text-term-amber mt-3 blink">UNDER VERIFICATION — hang tight.</p>
            </Panel>
          )}

          <Panel title="WALKTHROUGH">
            <ol className="space-y-6">
              {def.steps.map((s, i) => (
                <li key={s.title}>
                  <div className="flex gap-3">
                    <span className="font-mono text-term-cyan text-xs pt-1 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{s.title}</div>
                      <p className="text-sm text-muted mt-1 leading-relaxed">{s.detail}</p>
                      {s.commands?.filter(Boolean).map((cmd) => (
                        <CmdBlock key={cmd} cmd={cmd} />
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="EXPECTED OUTCOME">
            <TerminalBox>{`# success criteria
${def.expectedOutcome}`}</TerminalBox>
          </Panel>

          <Panel title="SELF-RESCUE — COMMON ERRORS">
            <ul className="space-y-3">
              {def.commonErrors.map((e) => (
                <li key={e.error} className="border border-edge rounded px-3.5 py-2.5">
                  <div className="font-mono text-[12px] text-term-red break-words">✗ {e.error}</div>
                  <div className="text-[13px] text-muted mt-1 leading-relaxed">→ {e.fix}</div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="RESOURCES">
            <ul className="space-y-2 text-sm">
              {def.resources.filter(r => r.url !== "#").map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-term-cyan hover:underline font-mono text-[13px]">
                    ↗ {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* RIGHT RAIL */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <Panel title={code === "M4" ? "DEPLOYMENT VERIFICATION" : "SUBMIT FOR VERIFICATION"}>
            {p.status === "verified" ? (
              <p className="text-sm text-term-green font-mono">✓ Already verified — nothing to do here.</p>
            ) : p.status === "submitted" ? (
              <p className="text-sm text-term-amber font-mono blink">● UNDER VERIFICATION — a mentor is on it.</p>
            ) : code === "M4" ? (
              <>
                {!team.challenge_started_at ? (
                  <p className="text-sm text-muted">
                    The challenge hasn&apos;t started yet. The repo link and timer unlock when organizers fire the start gun.
                  </p>
                ) : !team.deployment_time ? (
                  <TokenSubmissionForm />
                ) : p.status === "failed" ? (
                  <p className="text-sm text-term-amber">Token was accepted but organizers rejected the verification — see their note above, fix, then ask a mentor to reset your token attempt.</p>
                ) : (
                  <TokenSubmissionForm />
                )}
              </>
            ) : (
              <>
                <MissionSubmissionForm code={code} fields={def.submissionFields} />
                <div className="mt-4 pt-4 border-t border-edge">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">Verification requirement</div>
                  <p className="text-xs text-muted leading-relaxed">{def.verificationRequirement}</p>
                </div>
              </>
            )}
          </Panel>

          {p.status !== "verified" && (
            <Panel title="HINT VAULT" right={<span className="font-mono text-[10px] text-muted">USE SPARINGLY</span>}>
              <HintStack hints={def.hints} />
            </Panel>
          )}

          <Panel title="PREREQUISITES">
            <ul className="space-y-2 text-sm">
              {def.prerequisites.map((pr) => (
                <li key={pr} className="flex gap-2"><span className="font-mono text-term-cyan shrink-0">▸</span><span className="text-muted">{pr}</span></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </main>
  );
}
