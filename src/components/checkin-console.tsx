"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Hit {
  id: number;
  code: string;
  name: string;
  reg_no: string;
  status: string;
  team_code: string | null;
}

type P = Hit;

export default function CheckInConsole() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [counts, setCounts] = useState<{ checked: number; total: number }>({ checked: 0, total: 0 });
  const [flash, setFlash] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setHits([]);
      return;
    }
    const res = await fetch(`/api/admin/participants?q=${encodeURIComponent(term)}`, { cache: "no-store" });
    const data = await res.json();
    setHits(data.ok ? data.participants.slice(0, 6) : []);
  }, []);

  const loadCounts = useCallback(async () => {
    const res = await fetch("/api/admin/participants", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      const total = data.participants.length;
      const checked = data.participants.filter((p: P) => p.status === "checked_in").length;
      setCounts({ checked, total });
    }
  }, []);

  useEffect(() => {
    void loadCounts();
    const t = setTimeout(() => search(q), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function checkIn(hit: Hit, undo = false) {
    if (hit.status === "checked_in" && !undo) {
      setFlash(`⚠ ${hit.name} (${hit.code}) is ALREADY CHECKED IN — duplicate entry?`);
      setTimeout(() => setFlash(""), 4000);
      return;
    }
    const action = undo ? "undo_check_in" : "check_in";
    const res = await fetch("/api/admin/participants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: hit.id, action }),
    });
    const data = await res.json();
    if (data.ok) {
      setFlash(`${undo ? "↩ UNDO" : "✓"} — ${hit.name} · ID ${hit.code}`);
      setTimeout(() => setFlash(""), 2500);
      setQ("");
      setHits([]);
      inputRef.current?.focus();
      void loadCounts();
      search("");
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-term-green/30 bg-term-green/5 rounded-lg px-4 py-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted">CHECKED IN</div>
          <div className="text-3xl font-bold tabular-nums text-term-green">{counts.checked}</div>
        </div>
        <div className="border border-edge rounded-lg px-4 py-3">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted">REMAINING</div>
          <div className="text-3xl font-bold tabular-nums">{Math.max(0, counts.total - counts.checked)}</div>
        </div>
      </div>

      <input
        ref={inputRef}
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="scan / type name · registration no · participant ID · team code…"
        className="w-full rounded px-4 py-3.5 text-base font-mono"
      />

      {flash && (
        <div className={`border rounded px-4 py-3 font-mono text-sm ${flash.startsWith("⚠") ? "border-term-amber/50 bg-term-amber/10" : "border-term-green/40 bg-term-green/10"}`}>
          {flash}
        </div>
      )}

      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-3 border border-edge rounded-lg px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium">{h.name} <span className="font-mono text-xs text-muted ml-1">{h.code}{h.team_code ? ` · ${h.team_code}` : ""}</span></div>
              <div className="font-mono text-[11px] text-muted">{h.reg_no} · {h.status.toUpperCase()}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              {h.status !== "checked_in" ? (
                <button onClick={() => checkIn(h)} className="bg-term-green text-black font-semibold rounded px-4 py-2 font-mono text-xs tracking-wider hover:brightness-110 transition">
                  CHECK IN →
                </button>
              ) : (
                <>
                  <span className="font-mono text-xs text-term-green self-center">IN LAB ✓</span>
                  <button onClick={() => checkIn(h, true)} className="border border-edge rounded px-3 py-2 font-mono text-[10px] tracking-wider hover:border-term-red/50 hover:text-term-red transition-colors">
                    UNDO
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="font-mono text-[11px] text-muted">
        Tip: keep this tab open at the desk. Duplicate check-ins warn instead of failing silently.
      </p>
    </div>
  );
}
