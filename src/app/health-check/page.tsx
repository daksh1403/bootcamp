"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/client-bits";

interface CheckState {
  done: boolean;
  output: string;
}

const CHECKS = [
  {
    id: "docker-version",
    title: "Docker CLI + daemon",
    cmd: "docker version",
    pass: /Server section|Server:/i,
    hint: "Output must include a “Server” section — that proves the Docker daemon is running, not just the CLI.",
  },
  {
    id: "hello-world",
    title: "Container run test",
    cmd: "docker run hello-world",
    pass: /Hello from Docker!/i,
    hint: "Success prints “Hello from Docker!”. This proves images can be pulled and containers can run.",
  },
  {
    id: "git",
    title: "Git installed",
    cmd: "git --version",
    pass: /git version \d/i,
    hint: "Any `git version x.y.z` line passes.",
  },
  {
    id: "github-id",
    title: "GitHub identity configured",
    cmd: "git config --global user.name && git config --global user.email",
    pass: /\S+@\S+\.\S+/,
    hint: "Paste both lines; your email must appear in the output.",
  },
];

function osLabel(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown OS";
}

function ramOk(): boolean | null {
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (!dm) return null; // unknown (Firefox/Safari)
  return dm >= 4;
}

export default function HealthCheckPage() {
  const [states, setStates] = useState<Record<string, CheckState>>({});
  const [os, setOs] = useState("");
  const [ramKnown, setRamKnown] = useState<boolean | null>(null);

  // hydrate once
  useEffect(() => {
    setOs(osLabel());
    setRamKnown(ramOk());
  }, []);

  const passedCount = Object.values(states).filter((s) => s.done).length;
  const totalChecks = CHECKS.length;
  const allPass = passedCount === totalChecks;
  const ramPass = ramKnown === null ? true : ramKnown;

  function evaluate(id: string, output: string) {
    const check = CHECKS.find((c) => c.id === id)!;
    setStates((s) => ({ ...s, [id]: { done: check.pass.test(output), output } }));
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
    <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// bash technical_health_check.sh"}</div>
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Technical Health Check</h1>
      <p className="mt-3 text-muted text-sm leading-relaxed">
        Run each command in your laptop&apos;s terminal (<span className="font-mono">Terminal</span> on macOS/Linux,
        <span className="font-mono"> PowerShell</span> on Windows), then paste the full output below it.
        The checker verifies the result locally in your browser.
      </p>

      <div className="mt-8 space-y-5">
        {CHECKS.map((c) => {
          const st = states[c.id];
          return (
            <div key={c.id} className={`border rounded-lg p-4 ${st?.done ? "border-term-green/40 bg-term-green/5" : st ? "border-term-red/40 bg-term-red/5" : "border-edge bg-panel"}`}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 font-mono text-sm">
                  <span className={st?.done ? "text-term-green" : st?.done === false ? "text-term-red" : "text-muted"}>
                    {st?.done ? "✓" : st ? "✗" : "[ ]"}
                  </span>
                  {c.title}
                </div>
                <CopyButton text={c.cmd} label="copy cmd" />
              </div>
              <code className="block font-mono text-[12px] bg-[#0a0f15] border border-edge rounded px-3 py-2 overflow-x-auto">$ {c.cmd}</code>
              <textarea
                value={st?.output ?? ""}
                onChange={(e) => evaluate(c.id, e.target.value)}
                placeholder="paste terminal output here…"
                rows={3}
                className="mt-3 w-full font-mono text-[12px] rounded p-3 resize-y"
                spellCheck={false}
              />
              {!st?.done && st?.output !== undefined && st.output.length > 0 && <p className="mt-2 text-xs text-muted">{c.hint}</p>}
            </div>
          );
        })}

        {/* RAM */}
        <div className={`border rounded-lg p-4 ${ramPass ? "border-edge bg-panel" : "border-term-amber/40 bg-term-amber/5"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 font-mono text-sm">
              <span className={ramPass ? "text-term-green" : "text-term-amber"}>{ramPass ? "✓" : "!"}</span> System RAM
            </div>
            <span className="font-mono text-xs text-muted">{os || "detecting…"}{ramKnown !== null ? ` · ~${ramKnown ? "≥4GB" : "<4GB"} detected` : " · not detectable here"}</span>
          </div>
          {!ramPass && <p className="mt-2 text-xs text-muted">Under 4 GB detected — Docker will run but slowly. Close heavy apps during the lab.</p>}
        </div>

        {/* RESULT */}
        <div className={`border-2 rounded-lg p-6 text-center font-mono ${allPass ? "border-term-green/50 bg-term-green/10" : "border-edge bg-panel"}`}>
          {allPass ? (
            <>
              <div className="text-term-green text-lg tracking-[0.15em]">SYSTEM READY ✓</div>
              <pre className="mt-4 text-[13px] leading-relaxed text-left inline-block">{`Docker   ✓
Git      ✓
GitHub   ✓
RAM      ✓`}</pre>
              <div className="mt-4 text-term-cyan tracking-[0.2em] blink-none">YOU ARE READY TO SHIP.</div>
            </>
          ) : (
            <>
              <div className="text-muted tracking-[0.15em]">
                SYSTEM STATUS: {passedCount}/{totalChecks} CHECKS PASSING
              </div>
              <p className="mt-3 text-xs text-muted normal-case font-sans">
                Fix the failing checks above. If Docker won&apos;t install, come early (08:45) — setup support is available at the door.
              </p>
            </>
          )}
        </div>

        <div className="text-center">
          <Link href="/register" className="inline-block mt-2 bg-term-green text-black font-semibold rounded px-6 py-3 font-mono text-sm tracking-wider hover:brightness-110 transition">
            READY → REGISTER NOW
          </Link>
        </div>
      </div>
    </main>
  );
}
