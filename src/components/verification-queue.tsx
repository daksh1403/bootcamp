"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { StatusBadge, EmptyState } from "@/components/ui";

interface QueueItem {
  id: number;
  team_id: number;
  mission_code: string;
  status: string;
  submitted_payload: Record<string, string> | null;
  submitted_at: number;
  verifier_note: string | null;
  team_code: string;
  members: { name: string; code: string }[];
  teamName: string;
}

const MISSION_FILTERS = ["all", "M1", "M2", "M3", "M4"];

export default function VerificationQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState("all");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/verifications?mission=${filter}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.ok ? data.queue : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {MISSION_FILTERS.map((m) => (
          <button
            key={m}
            onClick={() => setFilter(m)}
            className={`font-mono text-[11px] rounded px-3 py-1.5 border transition-colors ${
              filter === m ? "border-term-cyan text-term-cyan bg-term-cyan/10" : "border-edge text-muted hover:text-foreground"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-muted self-center">{items.length} in queue</span>
      </div>

      {loading ? (
        <p className="font-mono text-xs text-muted">loading queue…</p>
      ) : items.length === 0 ? (
        <EmptyState message="Queue empty — every submission is handled." />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="border border-edge bg-panel rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono font-bold text-term-cyan">{it.team_code}</span>
                  <span className="font-mono text-sm">{it.mission_code}</span>
                  {it.members.length > 0 && <span className="text-xs text-muted">{it.members.map((m) => m.name).join(", ")}</span>}
                </div>
                <StatusBadge status={it.status} />
              </div>

              {it.submitted_payload && (
                <pre className="font-mono text-[12px] bg-[#0a0f15] border border-edge rounded p-3 overflow-x-auto whitespace-pre-wrap">
                  {Object.entries(it.submitted_payload).map(([k, v]) => `${k}: ${v}`).join("\n")}
                </pre>
              )}
              {it.verifier_note && <p className="mt-2 text-xs text-term-red">previous note: {it.verifier_note}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ActionButton
                  endpoint="/api/admin/verifications"
                  body={{ teamId: it.team_id, mission: it.mission_code, action: "verify" }}
                  label={`VERIFY ${it.mission_code} ✓`}
                  className="bg-term-green text-black !border-transparent font-semibold hover:brightness-110"
                />
                <ActionButton
                  endpoint="/api/admin/verifications"
                  body={{ teamId: it.team_id, mission: it.mission_code, action: "reject", note: notes[it.id] }}
                  label="REJECT ✗"
                  className="border-term-red/40 text-term-red hover:bg-term-red/10"
                />
                <ActionButton
                  endpoint="/api/admin/verifications"
                  body={{ teamId: it.team_id, mission: it.mission_code, action: "retry", note: notes[it.id] || "Please re-check and resubmit" }}
                  label="REQUEST RETRY ↺"
                  className="border-term-amber/40 text-term-amber hover:bg-term-amber/10"
                />
                <input
                  value={notes[it.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [it.id]: e.target.value }))}
                  placeholder="note to team (optional)"
                  className="rounded px-2.5 py-1.5 text-xs w-56"
                />
                <span className="ml-auto font-mono text-[10px] text-muted tabular-nums">
                  {new Date(it.submitted_at).toLocaleTimeString("en-IN")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
