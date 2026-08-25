/* eslint-disable @typescript-eslint/no-explicit-any -- better-sqlite3 rows are dynamically typed; shapes enforced at usage sites */
import { ok, fail, requireUser, withCsrf, clientIp } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { verifyMission, rejectMission } from "@/lib/services/missions-service";
import { getTeamById } from "@/lib/services/teams";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const mission = url.searchParams.get("mission");
  const db = getDb();
  const rows = (await db
    .prepare(
      `SELECT mp.*, t.code AS team_code FROM mission_progress mp JOIN teams t ON t.id = mp.team_id
       WHERE mp.status IN ('submitted','failed')
       ${mission && mission !== "all" ? "AND mp.mission_code = ?" : ""}
       ORDER BY mp.submitted_at ASC`
    )
    .all(...(mission && mission !== "all" ? [mission] : []))) as any[];
  const queue = await Promise.all(
    rows.map(async (r) => {
      const team = await getTeamById(r.team_id);
      return {
        ...r,
        submitted_payload: r.submitted_payload ? JSON.parse(r.submitted_payload) : null,
        members: team?.members ?? [],
        teamName: team?.name ?? "",
      };
    })
  );
  return ok({ queue });
}

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { teamId?: number; mission?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  const validMissions = new Set(["M1", "M2", "M3", "M4"]);
  if (!body.teamId || !body.mission || !validMissions.has(body.mission)) return fail("Missing or invalid fields");
  const auditBase = {
    actorUserId: auth.user.id,
    actorLabel: auth.user.email,
    targetType: "mission",
    targetId: `${body.mission}:${body.teamId}`,
    ip: clientIp(req),
    oldValue: undefined as unknown,
    note: body.note,
  };

  try {
    switch (body.action) {
      case "verify": {
        const r = await verifyMission({ teamId: body.teamId, code: body.mission as "M1", verifierLabel: auth.user.email, auditEntry: auditBase });
        if (!r.ok) return fail(r.error ?? "Verify failed");
        return ok({ status: r.status });
      }
      case "reject":
      case "retry": {
        const r = await rejectMission({
          teamId: body.teamId,
          code: body.mission as "M1",
          verifierLabel: auth.user.email,
          note: body.note,
          retry: body.action === "retry",
          auditEntry: auditBase,
        });
        if (!r.ok) return fail(r.error ?? "Action failed");
        return ok({ status: r.status });
      }
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Operation failed");
  }
});
