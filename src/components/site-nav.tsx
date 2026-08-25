import Link from "next/link";
import { Logo } from "./ui";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

export default async function SiteNav() {
  const settings = await getSettings();
  const user = await currentUser();

  if (settings.eventMode && user?.role === "participant") {
    // Event-day mode: minimal chrome.
    return (
      <nav className="sticky top-0 z-40 border-b border-edge bg-background/85 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <Logo small />
          <div className="flex items-center gap-3 font-mono text-xs">
            <Link href="/dashboard" className="text-term-cyan">DASHBOARD</Link>
            <Link href="/leaderboard" className="hover:text-term-cyan transition-colors">LEADERBOARD</Link>
            <LogoutButton />
          </div>
        </div>
      </nav>
    );
  }

  const links = [
    { href: "/event-info", label: "EVENT INFO" },
    { href: "/timeline", label: "TIMELINE" },
    { href: "/setup", label: "SETUP GUIDE" },
    { href: "/leaderboard", label: "LEADERBOARD" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-edge bg-background/85 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Logo />
        <div className="hidden md:flex items-center gap-5 font-mono text-[11px] tracking-[0.14em] text-muted">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
          {settings.postEventMode && (
            <Link href="/results" className="text-term-amber hover:text-foreground transition-colors">
              RESULTS
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          {user ? (
            <>
              {(user.role === "organizer" || user.role === "super_admin") && (
                <Link
                  href="/admin"
                  className="border border-term-amber/40 text-term-amber rounded px-3 py-1.5 hover:bg-term-amber/10 transition-colors"
                >
                  ADMIN
                </Link>
              )}
              <Link
                href="/dashboard"
                className="bg-term-green text-black font-semibold rounded px-3 py-1.5 hover:brightness-110 transition"
              >
                MISSION CONTROL
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="border border-edge rounded px-3 py-1.5 hover:border-term-cyan/50 transition-colors">
                LOG IN
              </Link>
              <Link
                href="/register"
                className="bg-term-green text-black font-semibold rounded px-3 py-1.5 hover:brightness-110 transition"
              >
                REGISTER NOW
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
