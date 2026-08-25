import { ok } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Questions without answers — answers are checked server-side on submit.
  const db = getDb();
  const rows = (await db.prepare(`SELECT id, question, options FROM quiz_questions ORDER BY id`).all()) as {
    id: number;
    question: string;
    options: string;
  }[];
  return ok({
    questions: rows.map((r) => ({ id: r.id, question: r.question, options: JSON.parse(r.options) })),
  });
}
