import TeamsManager from "@/components/teams-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teams" };

export default function AdminTeamsPage() {
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// squad assignment"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
        <p className="text-sm text-muted mt-1">Pairs preferred, solo allowed, max 3 per team. Auto-pair groups unassigned approved participants alphabetically.</p>
      </header>
      <TeamsManager />
    </div>
  );
}
