"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuroraBackground from "@/components/fx/aurora-background";

const BRANCHES = ["CSE", "CSE-AI&ML", "CSE-DS", "IT", "AI&ML", "ECE", "EEE", "MECH", "CIVIL", "OTHER"];
const YEARS = ["1", "2", "3", "4", "5"];

interface FormState {
  name: string;
  regNo: string;
  email: string;
  phone: string;
  branch: string;
  year: string;
  ram: string;
  os: string;
  dockerInstalled: string;
  githubUsername: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "", regNo: "", email: "", phone: "",
    branch: "CSE", year: "2", ram: "8GB",
    os: typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "macOS"
      : typeof navigator !== "undefined" && /Linux/.test(navigator.userAgent) ? "Linux" : "Windows 11",
    dockerInstalled: "no", githubUsername: "", password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [busy, setBusy] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setGlobalError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dockerInstalled: form.dockerInstalled }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        else if (data.error === detectDup(data)) setGlobalError(data.error);
        else setGlobalError(data.error ?? "Registration failed");
        return;
      }
      router.push("/dashboard?welcome=1");
      router.refresh();
    } catch {
      setGlobalError("Network error — check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  function detectDup(data: { error?: string }) {
    return data.error?.includes("already registered") ? data.error : "";
  }

  const inputCls = "w-full rounded px-3 py-2.5 text-sm";
  const labelCls = "block font-mono text-[11px] uppercase tracking-wider text-muted mb-1.5";
  const errCls = "mt-1 text-xs text-term-red";

  return (
    <main className="relative max-w-2xl mx-auto px-4 py-12 overflow-hidden min-h-screen">
      <AuroraBackground density={40} className="opacity-40" />
      <div className="relative">
    <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// ./register --mission devops"}</div>
      <h1 className="text-3xl font-bold tracking-tight">Enlist for the Mission</h1>
      <p className="mt-2 text-muted text-sm">
        Docker × Jenkins Bootcamp · 31 Aug 2026 · AB1-404B Lab. Your Participant ID is generated instantly.
      </p>

      {globalError && (
        <div className="mt-6 border border-term-red/40 bg-term-red/10 rounded-lg px-4 py-3 text-sm">{globalError}</div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="name">Full Name *</label>
            <input id="name" className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="As per VIT records" />
            {errors.name && <p className={errCls}>{errors.name}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="regNo">Registration Number *</label>
            <input id="regNo" className={`${inputCls} uppercase`} value={form.regNo} onChange={(e) => set("regNo", e.target.value.toUpperCase())} placeholder="e.g. 24BCE1234" />
            {errors.regNo && <p className={errCls}>{errors.regNo}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="email">VIT Email *</label>
            <input id="email" type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@vitstudent.ac.in" />
            {errors.email && <p className={errCls}>{errors.email}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="phone">Phone *</label>
            <input id="phone" inputMode="numeric" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" />
            {errors.phone && <p className={errCls}>{errors.phone}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="github">GitHub Username</label>
            <input id="github" className={inputCls} value={form.githubUsername} onChange={(e) => set("githubUsername", e.target.value)} placeholder="octocat" />
            {errors.githubUsername && <p className={errCls}>{errors.githubUsername}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="branch">Branch *</label>
            <select id="branch" className={inputCls} value={form.branch} onChange={(e) => set("branch", e.target.value)}>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="year">Year of Study *</label>
            <select id="year" className={inputCls} value={form.year} onChange={(e) => set("year", e.target.value)}>
              {YEARS.map((y) => <option key={y} value={y}>{y}{y === "1" ? "st" : y === "2" ? "nd" : y === "3" ? "rd" : "th"} Year</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="ram">Laptop RAM *</label>
            <select id="ram" className={inputCls} value={form.ram} onChange={(e) => set("ram", e.target.value)}>
              {["4GB", "8GB", "16GB+"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="os">Operating System *</label>
            <select id="os" className={inputCls} value={form.os} onChange={(e) => set("os", e.target.value)}>
              {["Windows 11", "Windows 10", "macOS", "Linux"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Is Docker already installed? *</span>
            <div className="flex gap-3">
              {[["yes", "YES — ready"], ["no", "NO — will install"]].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("dockerInstalled", v)}
                  className={`flex-1 border rounded px-3 py-2.5 font-mono text-xs tracking-wider transition-colors ${
                    form.dockerInstalled === v ? "border-term-cyan text-term-cyan bg-term-cyan/10" : "border-edge text-muted hover:border-edge/80"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {form.dockerInstalled === "no" && (
              <p className="mt-2 text-xs text-muted">No problem — follow the <Link href="/setup" className="text-term-cyan hover:underline">setup guide</Link>, or arrive at 08:45 for install help.</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="password">Create Password * (min 8 chars)</label>
            <input id="password" type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="You'll use this to log into Mission Control" />
            {errors.password && <p className={errCls}>{errors.password}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-term-green text-black font-semibold rounded py-3.5 font-mono text-sm tracking-[0.12em] hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? "INITIALIZING…" : "INITIATE REGISTRATION →"}
        </button>
        <p className="text-center font-mono text-[11px] text-muted">
          Already enlisted? <Link href="/login" className="text-term-cyan hover:underline">Log in to Mission Control →</Link>
        </p>
      </form>
      </div>
    </main>
  );
}
