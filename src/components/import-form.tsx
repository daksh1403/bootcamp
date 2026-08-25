"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const formEl = e.currentTarget;
        const fileInput = formEl.elements.namedItem("file") as HTMLInputElement;
        if (!fileInput.files?.length) {
          setResult("Choose an .xlsx file first");
          return;
        }
        setBusy(true);
        setResult("");
        try {
          const res = await fetch("/api/admin/import", {
            method: "POST",
            body: new FormData(formEl),
          });
          const data = await res.json();
          if (data.ok) {
            setResult(`✓ imported — ${data.created} created, ${data.updated} updated${data.errors?.length ? `, ${data.errors.length} skipped` : ""}`);
            if (data.errors?.length) {
              console.warn("Import skips:", data.errors);
            }
            router.refresh();
          } else {
            setResult(`✗ ${data.error ?? "import failed"}`);
          }
        } catch {
          setResult("✗ network error");
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" name="file" accept=".xlsx" required className="rounded px-3 py-2 text-sm w-72" />
        <button type="submit" disabled={busy} className="bg-term-cyan text-black font-semibold rounded px-4 py-2.5 font-mono text-xs tracking-widest hover:brightness-110 transition disabled:opacity-50">
          {busy ? "MERGING…" : "UPLOAD & MERGE →"}
        </button>
      </div>
      {result && <p className={`font-mono text-xs ${result.startsWith("✓") ? "text-term-green" : "text-term-red"}`}>{result}</p>}
    </form>
  );
}
