"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { Countdown } from "@/components/client-bits";

interface Team {
  id: number;
  code: string;
  name: string | null;
  members: { name: string }[];
  token_hint: string | null;
  token_generated_at: number | null;
  challenge_started_at: number | null;
  deployment_time: number | null;
}

export default function ChallengeControl({ challengeDurationMin }: { challengeDurationMin: number }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [revealed, setRevealed] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/teams", { cache: "no-store" });
    const data = await res.json();
    setTeams(data.ok ? data.teams : []);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function genToken(teamId: number) {
    const res = await fetch("/api/admin/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_token", teamId }),
    });
    const data = await res.json();
    if (data.ok && data.token) {
      setRevealed((r) => ({ ...r, [teamId]: data.token }));
      load();
    }
  }

  return (
    <div className="space-y-5">
      <div className="border border-term-cyan/30 bg-term-cyan/5 rounded-lg p-4 text-sm leading-relaxed">
        <b className="font-mono">SHIP IT PROTOCOL:</b> ① Generate each team&apos;s unique token (plaintext shown ONCE — hand it to the team / embed in their app env).
        ② Fire the start gun per team or for everyone at once. ③ Teams submit tokens on their M4 page; correct tokens stamp deployment time.
        {` Auto-verification of correct tokens is controlled in Settings.`}
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          endpoint="/api/admin/challenge"
          body={{ action: "start_all" }}
          label="🚀 START CHALLENGE FOR ALL READY TEAMS"
          className="bg-term-green text-black !border-transparent font-semibold hover:brightness-110"
          confirm="Start the Ship It challenge timer for every team that has a token?"
        />
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {teams.map((t) => {
          const deadline = t.challenge_started_at ? t.challenge_started_at + challengeDurationMin * 60_000 : null;
          return (
            <div key={t.id} className={`border rounded-lg p-4 ${t.deployment_time ? "border-term-green/40 bg-term-green/5" : deadline ? "border-term-cyan/40" : "border-edge bg-panel"}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold">{t.code}</span>
                {deadline && !t.deployment_time && <Countdown to={deadline} className="text-lg text-term-cyan" />}
              </div>
              <div className="text-xs text-muted mt-1">{t.members.map((m) => m.name).join(", ") || "no members"}</div>
              <div className="font-mono text-[11px] mt-2 space-y-0.5">
                <div>TOKEN: {t.token_hint ? `…${t.token_hint}` : <span className="text-term-red">NOT ISSUED</span>}</div>
                <div>STARTED: {t.challenge_started_at ? new Date(t.challenge_started_at).toLocaleTimeString("en-IN") : "—"}</div>
                <div className={t.deployment_time ? "text-term-green" : ""}>
                  DEPLOYED: {t.deployment_time ? new Date(t.deployment_time).toLocaleTimeString("en-IN") + " ✓" : "—"}
                </div>
              </div>
              {revealed[t.id] && (
                <div className="mt-2 border border-term-amber/50 bg-term-amber/10 rounded px-2.5 py-2 font-mono text-sm tracking-widest select-all">
                  {revealed[t.id]}
                  <div className="text-[9px] tracking-normal mt-1 opacity-70">shown once — copy now</div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!t.token_hint && (
                  <button onClick={() => genToken(t.id)} className="font-mono text-[10px] tracking-wider rounded px-2 py-1.5 border border-term-cyan/40 text-term-cyan hover:bg-term-cyan/10">
                    GENERATE TOKEN
                  </button>
                )}
                {!t.challenge_started_at && t.token_hint && (
                  <ActionButton endpoint="/api/admin/challenge" body={{ action: "start_challenge", teamId: t.id }} label="START ⏱" className="border-edge hover:border-term-green/50" />
                )}
                {t.token_hint && !t.deployment_time && (
                  <ActionButton
                    endpoint="/api/admin/challenge"
                    body={{ action: "generate_token", teamId: t.id }}
                    label="REGEN"
                    className="border-edge hover:border-term-red/50"
                    confirm={`Regenerate ${t.code}'s token? The old one stops working.`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
