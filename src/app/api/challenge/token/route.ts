import { withCsrf, ok, fail, clientIp, requireUser } from "@/lib/api-helpers";
import { getParticipantByUserId } from "@/lib/services/participants";
import { getTeamByParticipantId } from "@/lib/services/teams";
import { submitDeploymentToken } from "@/lib/services/missions-service";
import { rateLimit } from "@/lib/rate-limit";

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["participant"]);
  if ("response" in auth) return auth.response;

  const participant = await getParticipantByUserId(auth.user.id);
  if (!participant) return fail("No participant record found for this account", 403);
  const team = await getTeamByParticipantId(participant.id);
  if (!team) return fail("You are not assigned to a team yet.", 400);

  const rl = rateLimit(`token:${team.id}`, 8, 60_000);
  if (!rl.ok) return fail("Too many token attempts — wait a minute.", 429);

  let body: { token?: string; deployedUrl?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }
  const token = String(body.token ?? "").trim();
  if (!token) return fail("Enter your deployment token");

  const result = await submitDeploymentToken({
    teamId: team.id,
    token,
    url: String(body.deployedUrl ?? "").slice(0, 300),
    ip: clientIp(req),
    actorLabel: participant.code,
  });
  if (!result.ok) return fail(result.error ?? "Token rejected", 400);
  return ok({
    deploymentTime: result.deploymentTime ?? null,
    autoVerified: result.autoVerified ?? false,
  });
});
