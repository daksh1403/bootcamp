import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { invalidateLeaderboardCache } from "@/lib/services/leaderboard-service";

/** Organizer override: pin a team at an exact rank (final authority), or clear it. */
export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { teamId?: number; rank?: number | null; note?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  if (!body.teamId) return fail("Missing teamId");

  const db = getDb();
  const team = (await db.prepare(`SELECT code, leaderboard_override FROM teams WHERE id=?`).get(body.teamId)) as { code: string; leaderboard_override: number | null } | undefined;
  if (!team) return fail("Team not found", 404);

  const rank = body.rank === null ? null : Number(body.rank);
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 500)) return fail("Rank must be a positive integer (or null to clear)");

  // Two teams cannot share the same pinned rank.
  if (rank !== null) {
    (await db.prepare(`UPDATE teams SET leaderboard_override=NULL WHERE leaderboard_override=? AND id != ?`).run(rank, body.teamId));
  }
  (await db.prepare(`UPDATE teams SET leaderboard_override=?, override_note=? WHERE id=?`).run(rank, String(body.note ?? "").slice(0, 300) || null, body.teamId));
  invalidateLeaderboardCache();
  await audit({
    actorUserId: auth.user.id,
    actorLabel: auth.user.email,
    action: "leaderboard_override",
    targetId: team.code,
    oldValue: team.leaderboard_override,
    newValue: rank,
    note: body.note,
  });
  return ok({ teamCode: team.code, rank });
});
