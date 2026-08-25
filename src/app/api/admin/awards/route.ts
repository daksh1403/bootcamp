import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { assignAward, removeAward, getAwardSuggestions } from "@/lib/services/event-ops";

export const dynamic = "force-dynamic";

const VALID_AWARDS = new Set(["fastest_deployer", "pipeline_architect", "docker_master", "bug_slayer", "devops_innovator"]);

export async function GET() {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  return ok({ suggestions: await getAwardSuggestions() });
}

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { action?: string; key?: string; teamId?: number };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  if (!body.key || !VALID_AWARDS.has(body.key)) return fail("Unknown award");
  switch (body.action) {
    case "assign": {
      if (!body.teamId) return fail("Missing teamId");
      try {
        await assignAward(body.key, body.teamId, auth.user.email);
        return ok({});
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Assign failed");
      }
    }
    case "remove": {
      await removeAward(body.key, auth.user.email);
      return ok({});
    }
    default:
      return fail("Unknown action");
  }
});
