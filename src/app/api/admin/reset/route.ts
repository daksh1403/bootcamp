import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { getDb, now } from "@/lib/db";
import { ensureProgressRows } from "@/lib/services/missions-service";
import { audit } from "@/lib/audit";

/**
 * Super Admin only: reset mission progress for one team or everyone.
 * Registration data is preserved. This is the emergency recovery lever.
 */
export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { scope?: "team" | "all"; teamId?: number; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  if (body.confirm !== "RESET") return fail('Type "confirm":"RESET" to run this');

  const db = getDb();
  if (body.scope === "team") {
    if (!body.teamId) return fail("Missing teamId");
    (await db.prepare(`DELETE FROM mission_progress WHERE team_id=?`).run(body.teamId));
    (await db.prepare(`DELETE FROM challenge_attempts WHERE team_id=?`).run(body.teamId));
    (await db.prepare(`DELETE FROM verification_events WHERE team_id=?`).run(body.teamId));
    (await db.prepare(`UPDATE teams SET deployment_time=NULL, deployment_url=NULL, m4_verified_at=NULL, challenge_started_at=NULL WHERE id=?`).run(body.teamId));
    await ensureProgressRows(body.teamId);
  } else if (body.scope === "all") {
    await db.exec(`DELETE FROM challenge_attempts; DELETE FROM verification_events; DELETE FROM mission_progress;
             UPDATE teams SET deployment_time=NULL, deployment_url=NULL, m4_verified_at=NULL, challenge_started_at=NULL;`);
    const teams = (await db.prepare(`SELECT id FROM teams`).all()) as { id: number }[];
    for (const t of teams) await ensureProgressRows(t.id);
  } else {
    return fail("scope must be 'team' or 'all'");
  }

  await audit({ actorUserId: auth.user.id, actorLabel: auth.user.email, action: "progress_reset", newValue: body });
  return ok({ at: now() });
});
