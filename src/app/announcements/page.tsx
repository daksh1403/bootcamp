import SiteNav from "@/components/site-nav";
import { listAnnouncements } from "@/lib/services/event-ops";
import { EmptyState, Panel } from "@/components/ui";
import { AnnouncementFeed } from "@/components/mission-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const items = await listAnnouncements(true);
  return (
    <>
      <SiteNav />
      <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// journalctl -f mission-broadcasts"}</div>
        <h1 className="text-3xl font-bold tracking-tight mb-8">Announcements</h1>
        <Panel>
          {items.length === 0 ? <EmptyState message="No active transmissions. Stay tuned." /> : <AnnouncementFeed items={items} />}
        </Panel>
      </main>
    </>
  );
}
