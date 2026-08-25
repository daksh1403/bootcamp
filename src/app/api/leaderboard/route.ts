import { computeLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardCached } from "@/lib/services/leaderboard-service";
import { getSettings } from "@/lib/settings";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const input = await getLeaderboardCached(2000);
  const rows = computeLeaderboard(input);
  const settings = await getSettings();
  // In post-event mode the full board is public history; live mode hides nothing
  // (tokens are never exposed anywhere), but keep response lean.
  void settings;
  return ok({ rows });
}
