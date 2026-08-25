import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { generateToken, startChallenge, getTeamById } from "@/lib/services/teams";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { action?: string; teamId?: number };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }

  try {
    switch (body.action) {
      case "generate_token": {
        if (!body.teamId) return fail("Missing teamId");
        // Plaintext is returned exactly once; only the SHA-256 hash persists.
        const token = await generateToken(body.teamId, auth.user.email);
        await audit({ actorLabel: auth.user.email, action: "token_generated", targetId: String(body.teamId) });
        return ok({ token });
      }
      case "start_challenge": {
        if (!body.teamId) return fail("Missing teamId");
        await startChallenge(body.teamId, auth.user.email, audit);
        return ok({ team: await getTeamById(body.teamId) });
      }
      case "start_all": {
        const db = getDb();
        const teams = (await db.prepare(`SELECT id FROM teams WHERE challenge_started_at IS NULL AND token_hash IS NOT NULL`).all()) as { id: number }[];
        for (const t of teams) await startChallenge(t.id, auth.user.email, audit);
        return ok({ started: teams.length });
      }
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Operation failed");
  }
});
