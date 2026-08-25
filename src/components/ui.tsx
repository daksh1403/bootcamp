import Link from "next/link";
import type { ReactNode } from "react";

export function Panel({ children, className = "", title, right }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode }) {
  return (
    <section className={`border border-edge bg-panel rounded-lg ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="font-mono text-[13px] uppercase tracking-[0.14em] text-muted">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const BADGE_STYLES: Record<string, string> = {
  verified: "bg-term-green/10 text-term-green border-term-green/30",
  completed: "bg-term-green/10 text-term-green border-term-green/30",
  checked_in: "bg-term-green/10 text-term-green border-term-green/30",
  approved: "bg-term-cyan/10 text-term-cyan border-term-cyan/30",
  available: "bg-term-cyan/10 text-term-cyan border-term-cyan/30",
  submitted: "bg-term-amber/10 text-term-amber border-term-amber/30",
  in_progress: "bg-term-amber/10 text-term-amber border-term-amber/30",
  pending: "bg-term-amber/10 text-term-amber border-term-amber/30",
  failed: "bg-term-red/10 text-term-red border-term-red/30",
  rejected: "bg-term-red/10 text-term-red border-term-red/30",
  locked: "bg-white/5 text-muted border-edge",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = BADGE_STYLES[status] ?? "bg-white/5 text-muted border-edge";
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cls}`}>
      {status === "verified" && <span aria-hidden>✓</span>}
      {status === "locked" && <span aria-hidden>🔒</span>}
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function StatCard({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className={`border rounded-lg px-4 py-3 ${accent ? "border-term-cyan/30 bg-term-cyan/5" : "border-edge bg-panel"}`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-term-cyan" : ""}`}>{value}</div>
    </div>
  );
}

export function TerminalBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <pre className={`font-mono text-[12.5px] leading-relaxed bg-[#0a0f15] border border-edge rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words text-[#c9d6e2] ${className}`}>
      {children}
    </pre>
  );
}

export function Bar({ count, total, label }: { count: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between font-mono text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">{count}/{total}</span>
      </div>
      <div className="h-2.5 bg-white/5 border border-edge rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${pct >= 80 ? "bg-term-green" : pct >= 40 ? "bg-term-cyan" : "bg-term-amber"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 group">
      <span className={`font-mono font-bold tracking-tight ${small ? "text-sm" : "text-base"}`}>
        <span className="text-term-green">code</span>
        <span className="text-foreground">{"{Y}"}</span>
        <span className="text-term-cyan">gen</span>
      </span>
      <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-muted group-hover:text-term-cyan transition-colors">
        mission control
      </span>
    </Link>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10 text-muted font-mono text-sm">
      <div className="mb-2 text-lg opacity-50">▚▞</div>
      {message}
    </div>
  );
}
