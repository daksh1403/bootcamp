import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import {
  listTeams, createTeam, autoAssignTeams, moveMember, removeMember, mergeTeams, addMember, getTeamById,
} from "@/lib/services/teams";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  return ok({ teams: await listTeams() });
}

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { action?: string; teamId?: number; participantId?: number; sourceId?: number; targetId?: number; name?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  try {
    switch (body.action) {
      case "create": {
        const team = await createTeam(body.name);
        await audit({ actorLabel: auth.user.email, action: "team_created", targetType: "team", targetId: team.code });
        return ok({ team });
      }
      case "auto_assign": {
        const created = await autoAssignTeams(auth.user.email, audit);
        return ok({ created: created.length });
      }
      case "assign": {
        if (!body.teamId || !body.participantId) return fail("Missing ids");
        await addMember(body.teamId, body.participantId);
        await audit({ actorLabel: auth.user.email, action: "team_changed", targetType: "participant", targetId: String(body.participantId), newValue: body.teamId });
        return ok({});
      }
      case "move": {
        if (!body.teamId || !body.participantId) return fail("Missing ids");
        await moveMember(body.participantId, body.teamId, auth.user.email, audit);
        return ok({ team: await getTeamById(body.teamId) });
      }
      case "remove_member": {
        if (!body.participantId) return fail("Missing id");
        await removeMember(body.participantId, auth.user.email, audit);
        return ok({});
      }
      case "merge": {
        if (!body.sourceId || !body.targetId) return fail("Missing ids");
        await mergeTeams(body.sourceId, body.targetId, auth.user.email, audit);
        return ok({ team: await getTeamById(body.targetId) });
      }
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Operation failed");
  }
});
