import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser(["super_admin"]);
  if ("response" in auth) return auth.response;
  const users = (await getDb()
    .prepare(`SELECT id, email, name, role FROM users WHERE role IN ('organizer','super_admin') ORDER BY role DESC, name`)
    .all());
  return ok({ users });
}

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { email?: string; name?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role === "organizer" ? "organizer" : "super_admin";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Valid email required");
  if (!name) return fail("Name required");
  if (password.length < 8) return fail("Password must be at least 8 characters");

  const db = getDb();
  const existing = (await db.prepare(`SELECT id FROM users WHERE email=?`).get(email));
  if (existing) return fail("Email already in use", 409);
  const hash = await hashPassword(password);
  (await db.prepare(`INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?,?,?,?,?)`).run(email, hash, role, name, Date.now()));
  await audit({ actorUserId: auth.user.id, actorLabel: auth.user.email, action: "organizer_created", targetId: email, newValue: { role, name } });
  return ok({});
});

export const DELETE = withCsrf(async (req: Request) => {
  const auth = await requireUser(["super_admin"]);
  if ("response" in auth) return auth.response;
  let body: { userId?: number };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  const id = Number(body.userId);
  if (!id || id === auth.user.id) return fail("Invalid user");
  const db = getDb();
  const target = (await db.prepare(`SELECT id FROM users WHERE id=? AND role IN ('organizer','super_admin')`).get(id));
  if (!target) return fail("Organizer not found", 404);
  const targetRole = (target as { role: string }).role;
  if (targetRole === "super_admin") {
    const remainingAdmins = (await db.prepare(`SELECT COUNT(*) c FROM users WHERE role='super_admin' AND id != ?`).get(id)) as { c: number };
    if (remainingAdmins.c === 0) return fail("Cannot remove the last Super Admin");
  }
  (await db.prepare(`DELETE FROM users WHERE id=?`).run(id));
  await audit({ actorUserId: auth.user.id, actorLabel: auth.user.email, action: "organizer_removed", targetId: String(id) });
  return ok({});
});
