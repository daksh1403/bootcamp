import { getDb, now } from "./db";
import { hashPassword } from "./auth";
import { audit } from "./audit";

/**
 * Ensures at least one super admin exists. Run via `pnpm bootstrap`
 * with ADMIN_EMAIL + ADMIN_PASSWORD env vars, or interactively in dev.
 */
export async function ensureSuperAdmin(): Promise<{ created: boolean; email?: string }> {
  const db = getDb();
  const existing = (await db.prepare(`SELECT COUNT(*) c FROM users WHERE role='super_admin'`).get()) as { c: number };
  if (existing.c > 0) return { created: false };

  const email = (process.env.ADMIN_EMAIL || "daksh@codeygen.dev").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Set ADMIN_PASSWORD (min 8 chars) to create the first super admin.");
  }
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  const hash = await hashPassword(password);
  const info = await db
  .prepare(`INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?,?,?,?,?)`)
    .run(email, hash, "super_admin", process.env.ADMIN_NAME || "Event Lead", now());
  await audit({ actorUserId: Number(info.lastInsertRowid), actorLabel: email, action: "organizer_created", newValue: { role: "super_admin" } });
  return { created: true, email };
}

/** Creates the operations lead organizer account if missing (idempotent). */
export async function ensureOrganizer(email: string, name: string, password: string): Promise<boolean> {
  const db = getDb();
  const existing = (await db.prepare(`SELECT id FROM users WHERE email=?`).get(email.toLowerCase()));
  if (existing) return false;
  const hash = await hashPassword(password);
  const info = await db.prepare(`INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?,?,?,?,?)`)
    .run(email.toLowerCase(), hash, "organizer", name, now());
  await audit({ actorUserId: Number(info.lastInsertRowid), actorLabel: email, action: "organizer_created", newValue: { role: "organizer", name } });
  return true;
}
