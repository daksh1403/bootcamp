import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { getSettings, setSetting, type EventSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  return ok({ settings: await getSettings() });
}

const KEYS: (keyof EventSettings)[] = ["eventMode", "postEventMode", "autoVerifyM4", "maxTokenAttempts", "registrationOpen", "challengeDurationMin"];

export const PATCH = withCsrf(async (req: Request) => {
  const auth = await requireUser(["super_admin", "organizer"]);
  if ("response" in auth) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  const oldSettings = await getSettings();
  for (const key of KEYS) {
    if (key in body) {
      await setSetting(key, body[key] as string | boolean | number);
    }
  }
  await audit({
    actorUserId: auth.user.id,
    actorLabel: auth.user.email,
    action: "settings_changed",
    oldValue: oldSettings,
    newValue: await getSettings(),
  });
  return ok({ settings: await getSettings() });
});
