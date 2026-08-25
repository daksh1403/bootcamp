import LeaderboardOverride from "@/components/leaderboard-override";
import { getLeaderboardInput } from "@/lib/services/leaderboard-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard Control" };

export default async function AdminLeaderboardPage() {
  const input = await getLeaderboardInput();
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// ranking: deployment time first, missions second"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard Control</h1>
        <p className="text-sm text-muted mt-1">
          Auto-ranking is live below. To pin a team at an exact rank (dispute resolution, tie-breaks), type the rank and press PIN.
          Leave empty + PIN to release a pin. Every override is audit-logged.
        </p>
      </header>
      <LeaderboardOverride input={input} />
    </div>
  );
}
