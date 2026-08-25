import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SiteNav from "@/components/site-nav";
import { getSettings } from "@/lib/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "participant") redirect("/admin");

  const settings = await getSettings();
  return (
    <>
      <SiteNav />
      {settings.eventMode && <EventModeBanner />}
      {children}
    </>
  );
}

function EventModeBanner() {
  return (
    <div className="bg-term-green/10 border-b border-term-green/30">
      <div className="max-w-6xl mx-auto px-4 py-1.5 font-mono text-[11px] tracking-[0.18em] text-term-green flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-term-green pulse-dot inline-block" />
        EVENT MODE ACTIVE
      </div>
    </div>
  );
}
