"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";

interface Team {
  id: number;
  code: string;
  name: string | null;
  members: { id: number; code: string; name: string; status: string }[];
  token_hint: string | null;
  challenge_started_at: number | null;
  deployment_time: number | null;
}

interface Loose {
  id: number;
  name: string;
  reg_no: string;
  code: string;
  status: string;
  team_code: string | null;
}

export default function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loose, setLoose] = useState<Loose[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, pRes] = await Promise.all([
      fetch("/api/admin/teams", { cache: "no-store" }),
      fetch("/api/admin/participants?status=all&noTeam=1", { cache: "no-store" }),
    ]);
    const t = await tRes.json();
    const p = await pRes.json();
    setTeams(t.ok ? t.teams : []);
    setLoose(p.ok ? p.participants : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(participantId: number, teamId: number) {
    await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", participantId, teamId }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <ActionButton endpoint="/api/admin/teams" body={{ action: "auto_assign" }} label="⚡ AUTO-PAIR UNASSIGNED" className="border-term-cyan/40 text-term-cyan hover:bg-term-cyan/10" busyLabel="pairing…" />
        <ActionButton endpoint="/api/admin/teams" body={{ action: "create" }} label="+ NEW EMPTY TEAM" className="border-edge hover:border-term-cyan/50" />
        <span className="ml-auto font-mono text-[11px] text-muted self-center">{teams.length} teams · {loose.length} unassigned</span>
      </div>

      {/* unassigned pool */}
      {loose.length > 0 && (
        <section>
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted mb-2">{"// UNASSIGNED OPERATIVES (" + loose.length + ")"}</h2>
          <div className="flex flex-wrap gap-2">
            {loose.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border border-dashed border-term-amber/40 rounded px-3 py-1.5">
                <span className="text-sm">{p.name}</span>
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && move(p.id, Number(e.target.value))}
                  className="rounded px-1.5 py-1 font-mono text-[11px]"
                >
                  <option value="">assign →</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.code}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <p className="font-mono text-xs text-muted">loading…</p>
        ) : (
          teams.map((t) => (
            <div key={t.id} className="border border-edge bg-panel rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-bold">{t.code}</span>
                <span className={`font-mono text-[10px] ${t.deployment_time ? "text-term-green" : t.challenge_started_at ? "text-term-cyan" : "text-muted"}`}>
                  {t.deployment_time ? "DEPLOYED ✓" : t.challenge_started_at ? "CHALLENGE LIVE" : t.token_hint ? `TOKEN …${t.token_hint}` : "NO TOKEN"}
                </span>
              </div>
              <ul className="space-y-1.5 mb-3">
                {t.members.length === 0 && <li className="font-mono text-xs text-muted">empty team</li>}
                {t.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm group">
                    <span>{m.name} <span className={`font-mono text-[9px] ${m.status === "checked_in" ? "text-term-green" : "text-muted"}`}>{m.status === "checked_in" ? "✓IN" : ""}</span></span>
                    <button
                      onClick={() => window.confirm(`Remove ${m.name} from ${t.code}?`) && move(m.id, 0)}
                      className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-term-red"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-edge/60">
                <MoveSelect teams={teams.filter((x) => x.id !== t.id)} onPick={(id) => t.members[0] && move(t.members[0].id, id)} labelText="move 1st →" disabled={t.members.length === 0} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MoveSelect({ teams, onPick, labelText, disabled }: { teams: Team[]; onPick: (id: number) => void; labelText: string; disabled?: boolean }) {
  return (
    <select
      disabled={disabled}
      defaultValue=""
      onChange={(e) => e.target.value && onPick(Number(e.target.value))}
      className="rounded px-1.5 py-1 font-mono text-[10px] disabled:opacity-40"
    >
      <option value="">{labelText}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>{t.code}</option>
      ))}
    </select>
  );
}
