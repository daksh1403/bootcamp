"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-muted hover:text-term-red transition-colors font-mono text-[11px] tracking-wider disabled:opacity-50"
    >
      {busy ? "…" : "EXIT"}
    </button>
  );
}
