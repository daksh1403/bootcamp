import { NextResponse } from "next/server";
import { registrationSchema, validate } from "@/lib/validation";
import { detectDuplicate, registerParticipant } from "@/lib/services/participants";
import { createSession, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCsrf, ok, fail, clientIp } from "@/lib/api-helpers";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";

export const POST = withCsrf(async (req: Request) => {
  const settings = await getSettings();
  if (!settings.registrationOpen && !settings.postEventMode) return fail("Registration is currently closed.", 403);

  const ip = clientIp(req);
  const rl = rateLimit(`register:${ip}`, 8, 60 * 60 * 1000);
  if (!rl.ok) return fail("Too many registration attempts. Try again later.", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }

  const parsed = validate(registrationSchema, body);
  if (!parsed.ok) return NextResponse.json({ ok: false, fieldErrors: parsed.errors }, { status: 400 });

  const dup = await detectDuplicate(parsed.data.email, parsed.data.regNo);
  if (dup) return fail(dup, 409);

  const participant = await registerParticipant(parsed.data);
  const db = getDb();
  const u = (await db.prepare(`SELECT id FROM users WHERE email = ?`).get(parsed.data.email)) as { id: number };
  const token = await createSession(u.id, ip, req.headers.get("user-agent") ?? undefined);
  await setSessionCookie(token);

  return ok({ participant: { code: participant.code, name: participant.name, status: participant.status } });
});
