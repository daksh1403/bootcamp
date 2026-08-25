"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";

interface Settings {
  eventMode: boolean;
  postEventMode: boolean;
  autoVerifyM4: boolean;
  maxTokenAttempts: number;
  registrationOpen: boolean;
  challengeDurationMin: number;
}

interface OrgUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

function Toggle({ label, desc, value, onToggle, danger = false }: { label: string; desc: string; value: boolean; onToggle: (v: boolean) => void; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-edge rounded-lg px-4 py-3.5">
      <div>
        <div className={`font-mono text-sm ${danger && value ? "text-term-red" : ""}`}>{label}</div>
        <p className="text-xs text-muted mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onToggle(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${value ? (danger ? "bg-term-red" : "bg-term-green") : "bg-white/10"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
}

export default function SettingsPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", role: "organizer" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const stRes = await fetch("/api/admin/settings", { cache: "no-store" });
    const st = await stRes.json();
    if (st.ok) setS(st.settings);
    if (isSuperAdmin) {
      const usersRes = await fetch("/api/admin/users", { cache: "no-store" });
      const d = await usersRes.json();
      setUsers(d.ok ? d.users : []);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(update: Partial<Settings>) {
    const next = { ...s!, ...update };
    setS(next); // optimistic
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
  }

  if (!s) return <p className="font-mono text-xs text-muted">loading…</p>;

  return (
    <div className="grid xl:grid-cols-2 gap-6 items-start">
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">{"// EVENT STATE"}</h2>
        <Toggle
          label="EVENT MODE"
          desc="Minimal navigation for participants, live banner, mission-first layout."
          value={s.eventMode}
          onToggle={(v) => patch({ eventMode: v })}
        />
        <Toggle
          label="POST-EVENT MODE"
          desc="Public results page, winners on landing, certificates access."
          value={s.postEventMode}
          onToggle={(v) => patch({ postEventMode: v })}
          danger={false}
        />
        <Toggle
          label="REGISTRATION OPEN"
          desc="Close to freeze the roster before event day."
          value={s.registrationOpen}
          onToggle={(v) => patch({ registrationOpen: v })}
        />
        <Toggle
          label="AUTO-VERIFY CORRECT M4 TOKENS"
          desc="Safe automation: correct token ⇒ DEPLOYED instantly. You retain reject authority; every action is audit-logged."
          value={s.autoVerifyM4}
          onToggle={(v) => patch({ autoVerifyM4: v })}
        />
        <div className="flex items-center justify-between border border-edge rounded-lg px-4 py-3.5">
          <div>
            <div className="font-mono text-sm">CHALLENGE DURATION (MIN)</div>
            <p className="text-xs text-muted mt-0.5">Ship It countdown shown to teams.</p>
          </div>
          <input
            type="number"
            min={10}
            max={180}
            defaultValue={s.challengeDurationMin}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== s.challengeDurationMin) patch({ challengeDurationMin: v });
            }}
            className="w-20 rounded px-2 py-1.5 font-mono text-sm"
          />
        </div>
        <div className="flex items-center justify-between border border-edge rounded-lg px-4 py-3.5">
          <div>
            <div className="font-mono text-sm">MAX TOKEN ATTEMPTS</div>
            <p className="text-xs text-muted mt-0.5">Failed Ship It submissions before lockout.</p>
          </div>
          <input
            type="number"
            min={1}
            max={50}
            defaultValue={s.maxTokenAttempts}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== s.maxTokenAttempts) patch({ maxTokenAttempts: v });
            }}
            className="w-20 rounded px-2 py-1.5 font-mono text-sm"
          />
        </div>

        {isSuperAdmin && (
          <div className="border border-term-red/40 rounded-lg p-4 space-y-3 mt-4">
            <div className="font-mono text-xs uppercase tracking-widest text-term-red">{"// EMERGENCY RECOVERY"}</div>
            <ActionButton
              endpoint="/api/admin/reset"
              body={{ scope: "all", confirm: "RESET" }}
              label="RESET ALL MISSION PROGRESS"
              className="border-term-red/50 text-term-red hover:bg-term-red/10"
              busyLabel="resetting…"
              confirm="DANGER: wipe ALL mission progress, deployments and attempts? Registrations are kept. This cannot be undone."
            />
            <p className="text-[11px] text-muted font-mono">Use only for a catastrophic mis-start. Individual team reset also exists via API with scope=team.</p>
          </div>
        )}
      </section>

      {isSuperAdmin && (
        <section className="space-y-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">{"// CREW ACCOUNTS"}</h2>
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="border border-edge rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm">{u.name}</div>
                  <div className="font-mono text-[11px] text-muted">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] uppercase tracking-wider border rounded px-2 py-0.5 ${u.role === "super_admin" ? "border-term-amber/40 text-term-amber" : "border-edge text-muted"}`}>
                    {u.role.replace("_", " ")}
                  </span>
                  <ActionButton
                    endpoint="/api/admin/users"
                    method="DELETE"
                    body={{ userId: u.id }}
                    label="✕"
                    className="border-edge hover:border-term-red/50 hover:text-term-red"
                    confirm={`Remove ${u.name}'s organizer access?`}
                  />
                </div>
              </li>
            ))}
          </ul>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
              });
              const data = await res.json();
              setMsg(data.ok ? "✓ organizer created" : data.error ?? "failed");
              if (data.ok) {
                setNewUser({ email: "", name: "", password: "", role: "organizer" });
                load();
              }
            }}
            className="border border-dashed border-edge rounded-lg p-4 space-y-2.5"
          >
            <div className="font-mono text-xs uppercase tracking-widest text-muted">add crew member</div>
            <input required placeholder="Name" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} className="w-full rounded px-3 py-2 text-sm" />
            <input required type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} className="w-full rounded px-3 py-2 text-sm" />
            <input required type="password" minLength={8} placeholder="Password (min 8 chars)" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} className="w-full rounded px-3 py-2 text-sm" />
            <select value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))} className="rounded px-2.5 py-2 text-sm">
              <option value="organizer">Organizer</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <button type="submit" className="w-full bg-term-cyan text-black font-semibold rounded py-2.5 font-mono text-xs tracking-widest hover:brightness-110 transition">
              CREATE ACCOUNT →
            </button>
            {msg && <p className={`font-mono text-xs ${msg.startsWith("✓") ? "text-term-green" : "text-term-red"}`}>{msg}</p>}
          </form>
        </section>
      )}
    </div>
  );
}
