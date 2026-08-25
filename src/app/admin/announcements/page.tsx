import AnnouncementsManager from "@/components/announcements-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements" };

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// broadcast to every dashboard + projector"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
      </header>
      <AnnouncementsManager />
    </div>
  );
}
