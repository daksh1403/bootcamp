"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { Panel, StatusBadge } from "@/components/ui";

interface Suggestion {
  key: string;
  label: string;
  suggestion: { teamCode: string; reason: string } | null;
  assignedTeamId: number | null;
}

interface Team {
  id: number;
  code: string;
  members: { name: string }[];
  award: string | null;
}

export default function AdminAwardsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [aRes, tRes] = await Promise.all([
      fetch("/api/admin/awards", { cache: "no-store" }),
      fetch("/api/admin/teams", { cache: "no-store" }),
    ]);
    const a = await aRes.json();
    const t = await tRes.json();
    setSuggestions(a.ok ? a.suggestions : []);
    setTeams(t.ok ? t.teams : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// organizer has final authority — suggestions are just data"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Awards</h1>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {suggestions.map((s) => {
          const winner = teams.find((t) => t.id === s.assignedTeamId);
          return (
            <Panel
              key={s.key}
              title={s.label}
              right={winner ? <StatusBadge status="verified" label={`→ ${winner.code}`} /> : <StatusBadge status="locked" label="OPEN" />}
            >
              <div className="space-y-3">
                {s.suggestion && !s.assignedTeamId && (
                  <p className="text-sm border border-term-cyan/30 bg-term-cyan/5 rounded px-3 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-term-cyan block mb-1">system suggests</span>
                    <b>{s.suggestion.teamCode}</b> — {s.suggestion.reason}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={picks[s.key] ?? String(s.assignedTeamId ?? "")}
                    onChange={(e) => setPicks((p) => ({ ...p, [s.key]: e.target.value }))}
                    className="rounded px-2.5 py-2 text-sm min-w-[140px]"
                  >
                    <option value="">— select team —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code}{t.members.length ? ` (${t.members.map((m) => m.name).join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                  <ActionButton
                    endpoint="/api/admin/awards"
                    body={{ action: "assign", key: s.key, teamId: Number(picks[s.key] ?? s.assignedTeamId) }}
                    label="ASSIGN ★"
                    disabled={!picks[s.key] && !s.assignedTeamId}
                    className="border-term-amber/40 text-term-amber hover:bg-term-amber/10"
                  />
                  {s.assignedTeamId && (
                    <ActionButton endpoint="/api/admin/awards" body={{ action: "remove", key: s.key }} label="CLEAR ✕" className="border-edge hover:border-term-red/50" />
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <p className="font-mono text-[11px] text-muted">
        Suggestions derive from live mission data (fastest deploy, M2→M3 gap, M1+M2 speed, attempt counts). DevOps Innovator is organizer&apos;s choice.
      </p>
    </div>
  );
}
