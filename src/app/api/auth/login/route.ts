import { loginSchema, validate } from "@/lib/validation";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { withCsrf, ok, fail, clientIp } from "@/lib/api-helpers";
import { getDb, now } from "@/lib/db";
import { audit } from "@/lib/audit";

export const POST = withCsrf(async (req: Request) => {
  const ip = clientIp(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request body");
  }
  const parsed = validate(loginSchema, body);
  if (!parsed.ok) return fail("Invalid credentials", 400);

  const email = parsed.data.email;
  const rlUser = rateLimit(`login:u:${email}`, 8, 5 * 60_000);
  const rlIp = rateLimit(`login:ip:${ip}`, 30, 5 * 60_000);
  if (!rlUser.ok || !rlIp.ok) return fail("Too many login attempts. Try again in a few minutes.", 429);

  const db = getDb();
  const user = (await db.prepare(`SELECT id, email, password_hash, role, name FROM users WHERE email = ?`).get(email)) as
    | { id: number; email: string; password_hash: string; role: string; name: string }
    | undefined;

  // Constant-ish time: always run a compare even when user missing.
  const hash = user?.password_hash ?? "$2a$10$C6UzMDM.H6dfI/f/IKcEeO7ZBpEbF1uV3QeUvHjWl2mS9Xyq0Lm0O";
  const valid = await verifyPassword(parsed.data.password, hash);
  if (!user || !valid) return fail("Invalid email or password", 401);

  const token = await createSession(user.id, ip, req.headers.get("user-agent") ?? undefined);
  (await db.prepare(`UPDATE users SET last_login_at=? WHERE id=?`).run(now(), user.id));
  await setSessionCookie(token);

  if (user.role !== "participant") {
    await audit({ actorUserId: user.id, actorLabel: user.email, action: "admin_login", ip });
  }

  return ok({ role: user.role, name: user.name });
});
