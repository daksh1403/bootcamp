import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { generateCertificates, markCertificateIssued, upgradeCertificateToExcellence } from "@/lib/services/event-ops";

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { action?: string; participantId?: number; certId?: number; issued?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  switch (body.action) {
    case "generate":
      return ok({ created: await generateCertificates(auth.user.email) });
    case "issue": {
      if (!body.certId) return fail("Missing certId");
      markCertificateIssued(body.certId, body.issued !== false, auth.user.email);
      return ok({});
    }
    case "excellence": {
      if (!body.participantId) return fail("Missing participantId");
      upgradeCertificateToExcellence(body.participantId, auth.user.email);
      return ok({});
    }
    default:
      return fail("Unknown action");
  }
});
