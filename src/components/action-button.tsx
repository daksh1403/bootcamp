"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActionButton({
  endpoint,
  body,
  method = "POST",
  label,
  busyLabel = "…",
  className = "",
  confirm,
  disabled = false,
}: {
  endpoint: string;
  body: Record<string, unknown>;
  method?: string;
  label: string;
  busyLabel?: string;
  className?: string;
  confirm?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
      } else {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        title={error || undefined}
        className={`font-mono text-[11px] tracking-wider rounded px-2.5 py-1.5 border transition-colors disabled:opacity-40 ${className}`}
      >
        {busy ? busyLabel : done ? "✓ done" : error ? "✗ retry" : label}
      </button>
    </span>
  );
}
