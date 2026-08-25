import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { createAnnouncement, setAnnouncementActive, listAnnouncements } from "@/lib/services/event-ops";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  return ok({ announcements: await listAnnouncements(false) });
}

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { title?: string; body?: string; priority?: string; countdownMin?: number };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  if (!body.title?.trim()) return fail("Title required");
  const priorities = new Set(["low", "normal", "high", "critical"]);
  const a = await createAnnouncement({
    title: body.title,
    body: body.body ?? "",
    priority: (priorities.has(body.priority ?? "") ? body.priority : "normal") as "normal",
    countdownMin: typeof body.countdownMin === "number" && body.countdownMin > 0 ? body.countdownMin : null,
    by: auth.user.email,
  });
  return ok({ announcement: a });
});

export const PATCH = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { id?: number; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  if (!body.id) return fail("Missing id");
  await setAnnouncementActive(body.id, !!body.active, auth.user.email);
  return ok({});
});
