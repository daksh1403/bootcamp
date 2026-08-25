import { ok, requireUser } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1000);
  const rows = (await getDb()
    .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`)
    .all(limit));
  return ok({ logs: rows });
}
