import { getDb, now } from "./db";
import { sessionToken, sha256 } from "./ids";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export type Role = "participant" | "organizer" | "super_admin";

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
  name: string;
}

export const SESSION_COOKIE = "cyg_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: number, ip?: string, ua?: string): Promise<string> {
  const db = getDb();
  const token = sessionToken();
  const t = now();
  (await db.prepare(
    `INSERT INTO sessions (user_id, token_hash, created_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?)`
  ).run(userId, sha256(token), t, t + SESSION_TTL_MS, ip ?? null, ua?.slice(0, 200) ?? null));
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const db = getDb();
  (await db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(sha256(token)));
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getDb();
  const row = (await db
  .prepare(
      `SELECT u.id, u.email, u.role, u.name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(sha256(token))) as { id: number; email: string; role: Role; name: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < now()) {
    await destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, role: row.role, name: row.name };
}

/** Read the current user from cookies in a server component / route handler. */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}

export async function requireRole(...roles: Role[]): Promise<SessionUser | null> {
  const user = await currentUser();
  if (!user) return null;
  if (!roles.includes(user.role)) return null;
  return user;
}

export function isOrganizer(role: Role): boolean {
  return role === "organizer" || role === "super_admin";
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** CSRF defense: mutations must originate from our own origin. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Non-browser clients (curl without Origin). Require a same-host referer OR allow when no cookie auth used — we do use cookies, so be strict in production.
    const host = req.headers.get("host");
    const referer = req.headers.get("referer");
    if (referer && host) {
      try {
        return new URL(referer).host === host;
      } catch {
        return false;
      }
    }
    return process.env.NODE_ENV !== "production" ? true : false;
  }
  try {
    const originHost = new URL(origin).host;
    const host = req.headers.get("host");
    const allowed = process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    return originHost === host || allowed.includes(origin);
  } catch {
    return false;
  }
}
