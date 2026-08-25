import { z } from "zod";
import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { getDb, now } from "@/lib/db";
import { getParticipantByUserId } from "@/lib/services/participants";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  answers: z.array(z.object({ id: z.number().int(), choice: z.number().int().min(0).max(9) })).min(1).max(50),
  durationS: z.number().int().min(0).max(7200),
});

export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["participant", "organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  const participant = await getParticipantByUserId(auth.user.id);
  if (!participant) return fail("Only registered participants can play the quiz");

  const rl = rateLimit(`quiz:${participant.id}`, 5, 60_000);
  if (!rl.ok) return fail("Slow down.", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid answers payload");

  const db = getDb();
  const existing = (await db.prepare(`SELECT id FROM quiz_results WHERE participant_id=?`).get(participant.id));
  if (existing) return fail("You already played the quiz — one attempt per participant.", 409);

  const questions = (await db.prepare(`SELECT id, answer_idx FROM quiz_questions`).all()) as { id: number; answer_idx: number }[];
  const answerMap = new Map(questions.map((q) => [q.id, q.answer_idx]));
  let score = 0;
  for (const a of parsed.data.answers) {
    if (answerMap.get(a.id) === a.choice) score++;
  }
  (await db.prepare(`INSERT INTO quiz_results (participant_id, score, total, duration_s, answers, created_at) VALUES (?,?,?,?,?,?)`)
    .run(participant.id, score, questions.length, parsed.data.durationS, JSON.stringify(parsed.data.answers), now()));
  return ok({ score, total: questions.length });
});
