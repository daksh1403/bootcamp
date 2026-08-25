import { withCsrf, ok, fail } from "@/lib/api-helpers";
import { requireUser } from "@/lib/api-helpers";
import { getParticipantByUserId } from "@/lib/services/participants";
import { getTeamByParticipantId } from "@/lib/services/teams";
import { submitMission } from "@/lib/services/missions-service";
import { rateLimit } from "@/lib/rate-limit";
import { MISSIONS, type MissionCode } from "@/lib/missions";

export const POST = withCsrf(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const auth = await requireUser(["participant"]);
  if ("response" in auth) return auth.response;

  const { code } = await ctx.params;
  if (!MISSIONS[code as MissionCode]) return fail("Unknown mission", 404);

  const participant = await getParticipantByUserId(auth.user.id);
  if (!participant) return fail("No participant record found for this account", 403);
  const team = await getTeamByParticipantId(participant.id);
  if (!team) return fail("You are not assigned to a team yet. Ask an organizer.", 400);

  const rl = rateLimit(`mission:${participant.id}`, 15, 60_000);
  if (!rl.ok) return fail("Too many submissions — slow down.", 429);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Whitelist payload fields per mission definition; never trust extra input.
  const fields = MISSIONS[code as MissionCode].submissionFields;
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    const v = body[f.key];
    if (v !== undefined && v !== null) payload[f.key] = String(v).slice(0, 500);
  }
  for (const f of fields) {
    if (f.required && !String(payload[f.key] ?? "").trim()) {
      return fail(`Missing required field: ${f.label}`, 400);
    }
  }

  const result = await submitMission({
    teamId: team.id,
    code: code as MissionCode,
    payload,
    actorLabel: participant.code,
    checkedIn: participant.status === "checked_in",
  });
  if (!result.ok) return fail(result.error ?? "Submission failed", 400);
  return ok({ status: result.status });
});
