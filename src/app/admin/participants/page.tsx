import ParticipantsTable from "@/components/admin-participants-table";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Participants" };

export default async function AdminParticipantsPage() {
  const user = await currentUser();
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// roster management"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Participants</h1>
      </header>
      <p className="font-mono text-[11px] text-muted">
        Amber row highlight = Docker not installed (setup risk). Approve → participant can log in fully; Check In at the lab door.
      </p>
      <ParticipantsTable canDelete={user?.role === "super_admin"} />
    </div>
  );
}
