import { NextResponse } from "next/server";
import { sameOrigin, type Role, type SessionUser } from "./auth";
import { currentUser } from "@/lib/auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

export async function requireUser(roles?: Role[]): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await currentUser();
  if (!user) return { response: fail("Not authenticated", 401) };
  if (roles && !roles.includes(user.role)) return { response: fail("Forbidden", 403) };
  return { user };
}

/** Wrap a mutation handler with origin (CSRF) checking. Forwards route context args. */
export function withCsrf<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req: Request, ctx: Ctx) => {
    const method = req.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD" && !sameOrigin(req)) {
      return fail("Cross-origin request blocked", 403);
    }
    return handler(req, ctx);
  };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
