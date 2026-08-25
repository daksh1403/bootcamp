import { getDb } from "@/lib/db";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** Public trivia standings for presenter mode. Exposes codes only, never names. */
export async function GET() {
  const db = getDb();
  const rows = (await db
  .prepare(
      `SELECT p.code, r.score, r.total, r.duration_s FROM quiz_results r
       JOIN participants p ON p.id = r.participant_id
       ORDER BY r.score DESC, r.duration_s ASC LIMIT 10`
    )
    .all());
  return ok({ rows });
}
