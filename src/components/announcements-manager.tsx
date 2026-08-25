"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { StatusBadge } from "@/components/ui";

interface A {
  id: number;
  title: string;
  body: string;
  priority: string;
  active: number;
  created_at: number;
  created_by: string | null;
}

const PRESETS = [
  ["M1 starts now.", "normal"],
  ["Jenkins lab begins at 2 PM.", "normal"],
  ["Ship It Challenge is LIVE.", "critical"],
  ["10 minutes remaining.", "high"],
] as const;

export default function AnnouncementsManager() {
  const [items, setItems] = useState<A[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [countdownMin, setCountdownMin] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/announcements", { cache: "no-store" });
    const data = await res.json();
    setItems(data.ok ? data.announcements : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* composer */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await fetch("/api/admin/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, body, priority, countdownMin: countdownMin ? Number(countdownMin) : undefined }),
          });
          setTitle("");
          setBody("");
          setCountdownMin("");
          load();
        }}
        className="border border-edge bg-panel rounded-lg p-4 space-y-3 lg:sticky lg:top-6"
      >
        <div className="font-mono text-xs uppercase tracking-widest text-muted">{"// NEW TRANSMISSION"}</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. M1 STARTS NOW)" required className="w-full rounded px-3 py-2.5 text-sm" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" rows={3} className="w-full rounded px-3 py-2.5 text-sm resize-y" />
        <div className="grid grid-cols-2 gap-3">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded px-2.5 py-2 text-sm">
            {["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <input value={countdownMin} onChange={(e) => setCountdownMin(e.target.value.replace(/\D/g, ""))} placeholder="countdown (min)" className="rounded px-2.5 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full bg-term-green text-black font-semibold rounded py-2.5 font-mono text-xs tracking-widest hover:brightness-110 transition">
          BROADCAST →
        </button>
        <div className="pt-2 border-t border-edge space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">quick presets</div>
          {PRESETS.map(([t, p]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTitle(t);
                setBody("");
                setPriority(p);
              }}
              className="block w-full text-left font-mono text-[11px] border border-edge rounded px-2.5 py-1.5 hover:border-term-cyan/50 transition-colors"
            >
              ▸ {t}
            </button>
          ))}
        </div>
      </form>

      {/* feed */}
      <ul className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted font-mono">No announcements yet.</p>}
        {items.map((a) => (
          <li key={a.id} className={`border rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 ${a.active ? "border-edge bg-panel" : "border-edge/50 opacity-50"}`}>
            <StatusBadge status={a.priority === "critical" ? "failed" : a.priority === "high" ? "submitted" : a.active ? "approved" : "locked"} label={`${a.priority.toUpperCase()}${a.active ? "" : " · OFF"}`} />
            <div className="min-w-0 flex-1">
              <b className="text-sm">{a.title}</b>
              {a.body && <span className="text-muted text-sm"> — {a.body}</span>}
              <div className="font-mono text-[10px] text-muted mt-0.5">
                {new Date(a.created_at).toLocaleTimeString("en-IN")} · {a.created_by ?? "system"}
              </div>
            </div>
            <ActionButton
              endpoint="/api/admin/announcements"
              method="PATCH"
              body={{ id: a.id, active: !a.active }}
              label={a.active ? "DEACTIVATE" : "RE-ACTIVATE"}
              className="border-edge hover:border-term-cyan/50"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
