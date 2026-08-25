"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/client-bits";
import type { MissionDef } from "@/lib/missions";

export function HintStack({ hints }: { hints: [string, string, string] }) {
  const [revealed, setRevealed] = useState(0);
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          {i < revealed ? (
            <div className={`border rounded px-3 py-2.5 text-sm rise ${i === 0 ? "border-term-cyan/30 bg-term-cyan/5" : i === 1 ? "border-term-amber/30 bg-term-amber/5" : "border-term-amber/50 bg-term-amber/10"}`}>
              <span className="font-mono text-[10px] uppercase tracking-widest block mb-1 opacity-70">HINT {i + 1}{i === 2 ? " — near-solution" : ""}</span>
              {hints[i]}
            </div>
          ) : i === revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(i + 1)}
              className="w-full border border-dashed border-edge rounded px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-muted hover:border-term-cyan/50 hover:text-term-cyan transition-colors"
            >
              Reveal hint {i + 1} {i > 0 && "(try harder first — it builds character)"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function MissionSubmissionForm({ code, fields }: { code: string; fields: MissionDef["submissionFields"] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<{ error?: string; success?: string; busy?: boolean }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch(`/api/missions/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ error: data.error ?? data.fieldErrors ? Object.values(data.fieldErrors ?? {})[0] as string ?? data.error : "Submission failed" });
        return;
      }
      setState({ success: "Submitted for verification." });
      router.refresh();
    } catch {
      setState({ error: "Network error — retry." });
    }
  }

  if (state.success) {
    return (
      <div className="border border-term-green/40 bg-term-green/10 rounded-lg p-4 text-sm">
        <b className="font-mono">✓ {state.success}</b> Status is now UNDER VERIFICATION — a mentor will review shortly.
        <button onClick={() => setState({})} className="block mt-2 font-mono text-[11px] text-muted hover:text-term-cyan underline">
          edit & resubmit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block font-mono text-[11px] uppercase tracking-wider text-muted mb-1.5" htmlFor={f.key}>
            {f.label} {f.required && "*"}
          </label>
          <input
            id={f.key}
            required={f.required}
            placeholder={f.placeholder}
            value={values[f.key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            className="w-full rounded px-3 py-2.5 text-sm"
          />
        </div>
      ))}
      {state.error && <p className="text-sm text-term-red">{state.error}</p>}
      <button
        type="submit"
        disabled={state.busy}
        className="w-full bg-term-green text-black font-semibold rounded py-3 font-mono text-xs tracking-[0.14em] hover:brightness-110 transition disabled:opacity-50"
      >
        {state.busy ? "TRANSMITTING…" : `SUBMIT ${code} FOR VERIFICATION →`}
      </button>
    </form>
  );
}

export function TokenSubmissionForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ error?: string; busy?: boolean; done?: boolean }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch("/api/challenge/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), deployedUrl: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ error: data.error ?? "Token rejected" });
        return;
      }
      setState({ done: true });
      router.refresh();
    } catch {
      setState({ error: "Network error — retry." });
    }
  }

  if (state.done) {
    return (
      <div className="border border-term-green/40 bg-term-green/10 rounded-lg p-4 text-sm font-mono">
        ✓ TOKEN ACCEPTED. Deployment time recorded — check the leaderboard.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block font-mono text-[11px] uppercase tracking-wider text-muted mb-1.5" htmlFor="tok">
          Deployment token * <span className="normal-case">(format SHIP-XXXX-XXXX)</span>
        </label>
        <input
          id="tok"
          required
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          placeholder="SHIP-XXXX-XXXX"
          className="w-full rounded px-3 py-2.5 text-sm font-mono tracking-widest"
        />
      </div>
      <div>
        <label className="block font-mono text-[11px] uppercase tracking-wider text-muted mb-1.5" htmlFor="durl">
          Deployed app URL
        </label>
        <input
          id="durl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3000"
          className="w-full rounded px-3 py-2.5 text-sm"
        />
      </div>
      {state.error && (
        <p className="text-sm text-term-red border border-term-red/40 bg-term-red/10 rounded px-3 py-2">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={state.busy || !token.trim()}
        className="w-full bg-term-green text-black font-semibold rounded py-3 font-mono text-xs tracking-[0.14em] hover:brightness-110 transition disabled:opacity-50"
      >
        {state.busy ? "VERIFYING…" : "SUBMIT DEPLOYMENT TOKEN →"}
      </button>
      <p className="font-mono text-[10px] text-muted leading-relaxed">
        Tokens are team-specific secrets. Failed attempts are logged and rate-limited.
      </p>
    </form>
  );
}

export function CmdBlock({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-[#0a0f15] border border-edge rounded px-3 py-2 my-1.5">
      <code className="font-mono text-[12px] text-[#c9d6e2] whitespace-pre-wrap break-all">{cmd}</code>
      <CopyButton text={cmd} />
    </div>
  );
}
