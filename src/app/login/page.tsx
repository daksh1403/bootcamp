"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuroraBackground from "@/components/fx/aurora-background";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(data.role === "participant" ? "/dashboard" : "/admin");
      router.refresh();
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative max-w-md mx-auto px-4 py-20 overflow-hidden min-h-screen">
      <AuroraBackground density={45} className="opacity-50" />
      <div className="relative">
    <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// ssh into mission control"}</div>
      <h1 className="text-3xl font-bold tracking-tight">Log In</h1>

      {error && (
        <div className="mt-6 border border-term-red/40 bg-term-red/10 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block font-mono text-[11px] uppercase tracking-wider text-muted mb-1.5">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded px-3 py-2.5 text-sm" required />
        </div>
        <div>
          <label htmlFor="password" className="block font-mono text-[11px] uppercase tracking-wider text-muted mb-1.5">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded px-3 py-2.5 text-sm" required />
        </div>
        <button type="submit" disabled={busy}
          className="w-full bg-term-green text-black font-semibold rounded py-3 font-mono text-sm tracking-[0.12em] hover:brightness-110 transition disabled:opacity-50">
          {busy ? "AUTHENTICATING…" : "AUTHENTICATE →"}
        </button>
      </form>

      <p className="mt-6 text-center font-mono text-[11px] text-muted">
        No account? <Link href="/register" className="text-term-cyan hover:underline">Register for the mission →</Link>
      </p>
      </div>
    </main>
  );
}
