"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui";

interface P {
  id: number;
  code: string;
  name: string;
  reg_no: string;
  email: string;
  phone: string;
  branch: string;
  year: string;
  ram: string;
  os: string;
  docker_installed: string;
  github_username: string | null;
  status: string;
  team_code: string | null;
  notes: string | null;
}

const STATUS_FILTERS = ["all", "pending", "approved", "checked_in", "rejected"];

export default function ParticipantsTable({ canDelete }: { canDelete: boolean }) {
  const [rows, setRows] = useState<P[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/participants?status=${status}&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setRows(data.participants);
        setError("");
      } else setError(data.error ?? "Load failed");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function act(id: number, action: string) {
    await fetch("/api/admin/participants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search name / reg no / ID / email…"
          className="rounded px-3 py-2 text-sm w-72"
        />
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`font-mono text-[10px] uppercase tracking-wider rounded px-2.5 py-2 border transition-colors ${
                status === s ? "border-term-cyan text-term-cyan bg-term-cyan/10" : "border-edge text-muted hover:text-foreground"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">{rows.length} shown</span>
      </div>

      {error && <p className="text-sm text-term-red">{error}</p>}

      <div className="border border-edge rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-edge font-mono text-[10px] uppercase tracking-wider text-muted text-left">
              <th className="px-3 py-2.5">PARTICIPANT</th>
              <th className="px-3 py-2.5 hidden xl:table-cell">REG NO</th>
              <th className="px-3 py-2.5 hidden lg:table-cell">BRANCH/YR</th>
              <th className="px-3 py-2.5 hidden lg:table-cell">RAM/OS</th>
              <th className="px-3 py-2.5">DOCKER</th>
              <th className="px-3 py-2.5 hidden md:table-cell">TEAM</th>
              <th className="px-3 py-2.5">STATUS</th>
              <th className="px-3 py-2.5 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center font-mono text-xs text-muted">loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center font-mono text-xs text-muted">no matches</td></tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className={`border-b border-edge/40 hover:bg-white/[0.02] ${p.docker_installed === "no" && p.status !== "pending" ? "bg-term-amber/[0.04]" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="font-mono text-[10px] text-muted">{p.code}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs hidden xl:table-cell">{p.reg_no}</td>
                  <td className="px-3 py-2 text-xs hidden lg:table-cell">{p.branch} · Yr{p.year}</td>
                  <td className="px-3 py-2 text-xs hidden lg:table-cell">{p.ram} · {p.os}</td>
                  <td className="px-3 py-2">
                    <span className={`font-mono text-[10px] ${p.docker_installed === "yes" ? "text-term-green" : "text-term-amber"}`}>
                      {p.docker_installed.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs hidden md:table-cell">{p.team_code ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      {p.status === "pending" && (
                        <>
                          <ActBtn onClick={() => act(p.id, "approve")} cls="btn-ok">APPROVE</ActBtn>
                          <ActBtn onClick={() => act(p.id, "reject")} cls="btn-bad">REJECT</ActBtn>
                        </>
                      )}
                      {p.status === "approved" && <ActBtn onClick={() => act(p.id, "check_in")} cls="btn-ok">CHECK IN</ActBtn>}
                      {p.status === "checked_in" && <ActBtn onClick={() => act(p.id, "undo_check_in")} cls="">UNDO ✓</ActBtn>}
                      {p.status === "rejected" && <ActBtn onClick={() => act(p.id, "set_pending")} cls="">RESET</ActBtn>}
                      {canDelete && <ActBtn confirm={`Delete ${p.name} permanently?`} onClick={() => act(p.id, "delete")} cls="btn-bad">DEL</ActBtn>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <style jsx global>{`
        .btn-ok { border-color: rgba(74,222,128,.35); color: #4ade80; }
        .btn-ok:hover { background: rgba(74,222,128,.1); }
        .btn-bad { border-color: rgba(248,113,113,.35); color: #f87171; }
        .btn-bad:hover { background: rgba(248,113,113,.1); }
      `}</style>
    </div>
  );
}

function ActBtn({ onClick, children, cls = "", confirm }: { onClick: () => void; children: React.ReactNode; cls?: string; confirm?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        onClick();
      }}
      className={`font-mono text-[10px] tracking-wider border border-edge rounded px-2 py-1 hover:border-edge/60 ${cls}`}
    >
      {children}
    </button>
  );
}
