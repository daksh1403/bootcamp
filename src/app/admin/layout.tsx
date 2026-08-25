import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import LogoutButton from "@/components/logout-button";

const NAV = [
  { href: "/admin", label: "CONTROL CENTER", icon: "▣" },
  { href: "/admin/live", label: "LIVE STATUS", icon: "◉" },
  { href: "/admin/participants", label: "PARTICIPANTS", icon: "☰" },
  { href: "/admin/checkin", label: "CHECK-IN", icon: "✓" },
  { href: "/admin/teams", label: "TEAMS", icon: "⧉" },
  { href: "/admin/verifications", label: "VERIFICATIONS", icon: "⚖" },
  { href: "/admin/challenge", label: "SHIP IT CONTROL", icon: "🚀" },
  { href: "/admin/leaderboard", label: "LEADERBOARD", icon: "🏆" },
  { href: "/admin/announcements", label: "ANNOUNCEMENTS", icon: "📣" },
  { href: "/admin/certificates", label: "CERTIFICATES", icon: "📜" },
  { href: "/admin/awards", label: "AWARDS", icon: "★" },
  { href: "/admin/excel", label: "EXCEL / BACKUP", icon: "▤" },
  { href: "/admin/settings", label: "SETTINGS", icon: "⚙" },
  { href: "/admin/audit", label: "AUDIT LOG", icon: "≡" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "organizer" && user.role !== "super_admin") redirect("/dashboard");
  const settings = await getSettings();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* sidebar */}
      <aside className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-edge bg-panel/60 lg:h-screen lg:sticky lg:top-0 flex flex-col">
        <div className="px-4 py-4 border-b border-edge">
          <Link href="/" className="font-mono font-bold text-sm">
            <span className="text-term-green">code</span><span>{"{Y}"}</span><span className="text-term-cyan">gen</span>
            <span className="block text-[9px] tracking-[0.25em] text-muted mt-1">MISSION OPS · {user.role === "super_admin" ? "SUPER ADMIN" : "ORGANIZER"}</span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 grid grid-cols-3 lg:grid-cols-1 gap-1 text-[10px] lg:text-xs">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 px-2 py-1.5 rounded font-mono text-muted hover:text-foreground hover:bg-white/[0.04] transition-colors">
              <span className="w-4 text-center opacity-70">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-edge space-y-2">
          <div className={`font-mono text-[10px] ${settings.eventMode ? "text-term-green" : "text-muted"}`}>
            EVENT MODE: {settings.eventMode ? "ON" : "OFF"} · POST-EVENT: {settings.postEventMode ? "ON" : "OFF"}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted truncate">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-6 max-w-[1400px]">{children}</main>
    </div>
  );
}
