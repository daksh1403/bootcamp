import { getDb, now } from "../db";
import { deploymentToken, sha256, teamCode } from "../ids";
import { ensureProgressRows } from "./missions-service";
import type { AuditEntry } from "../audit";

export interface TeamFull {
  id: number;
  code: string;
  name: string | null;
  token_hint: string | null;
  token_generated_at: number | null;
  challenge_started_at: number | null;
  deployment_time: number | null;
  deployment_url: string | null;
  m4_verified_at: number | null;
  award: string | null;
  leaderboard_override: number | null;
  override_note: string | null;
  members: { id: number; code: string; name: string; reg_no: string; status: string }[];
}

export async function getTeamById(id: number): Promise<TeamFull | undefined> {
  const db = getDb();
  const team = (await db
  .prepare(
      `SELECT id, code, name, token_hint, token_generated_at, challenge_started_at, deployment_time,
              deployment_url, m4_verified_at, award, leaderboard_override, override_note
       FROM teams WHERE id = ?`
    )
    .get(id)) as Omit<TeamFull, "members"> | undefined;
  if (!team) return undefined;
  const members = (await db
  .prepare(
      `SELECT p.id, p.code, p.name, p.reg_no, p.status FROM team_members tm JOIN participants p ON p.id = tm.participant_id WHERE tm.team_id = ? ORDER BY p.name`
    )
    .all(id)) as TeamFull["members"];
  return { ...team, members };
}

export async function getTeamByParticipantId(participantId: number): Promise<TeamFull | undefined> {
  const db = getDb();
  const row = (await db.prepare(`SELECT team_id FROM team_members WHERE participant_id = ?`).get(participantId)) as { team_id: number } | undefined;
  if (!row) return undefined;
  return getTeamById(row.team_id);
}

export async function listTeams(): Promise<TeamFull[]> {
  const db = getDb();
  const teams = (await db.prepare(`SELECT id FROM teams ORDER BY code`).all()) as { id: number }[];
  const out: TeamFull[] = [];
  for (const t of teams) out.push((await getTeamById(t.id))!);
  return out;
}

async function nextTeamSeq(db: ReturnType<typeof getDb>): Promise<number> {
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM teams`).get()) as { c: number };
  // Reuse gaps is not needed for a one-day event; always append.
  return row.c + 1;
}

export async function createTeam(name?: string): Promise<TeamFull> {
  const db = getDb();
  let code = teamCode(await nextTeamSeq(db));
  while ((await db.prepare(`SELECT 1 FROM teams WHERE code = ?`).get(code))) {
    code = teamCode(Number(code.split("-")[1]) + 1 + Math.floor(Math.random() * 5));
  }
  const info = await db.prepare(`INSERT INTO teams (code, name, created_at) VALUES (?,?,?)`).run(code, name ?? null, now());
  const teamId = Number(info.lastInsertRowid);
  await ensureProgressRows(teamId);
  return (await getTeamById(teamId))!;
}

/** Pair up unassigned approved participants into new teams of two (odd one gets a solo team). */
export async function autoAssignTeams(actorLabel: string, auditFn: (e: AuditEntry) => void | Promise<void>): Promise<TeamFull[]> {
  const db = getDb();
  const unassigned = (await db
  .prepare(
      `SELECT p.id FROM participants p LEFT JOIN team_members tm ON tm.participant_id = p.id
       WHERE tm.id IS NULL AND p.status IN ('approved','checked_in') ORDER BY p.reg_no`
    )
    .all()) as { id: number }[];
  const created: TeamFull[] = [];
  for (let i = 0; i < unassigned.length; i += 2) {
    const team = await createTeam();
    const batch = unassigned.slice(i, i + 2);
    for (const m of batch) await addMember(team.id, m.id);
    await auditFn({ actorLabel, action: "team_created", targetType: "team", targetId: team.code, newValue: { members: batch.length } });
    created.push((await getTeamById(team.id))!);
  }
  return created;
}

export async function addMember(teamId: number, participantId: number): Promise<void> {
  const db = getDb();
  const existing = (await db.prepare(`SELECT team_id FROM team_members WHERE participant_id = ?`).get(participantId)) as { team_id: number } | undefined;
  if (existing) {
    if (existing.team_id === teamId) return;
    throw new Error("Participant already belongs to another team — move them first.");
  }
  const teamSize = (await db.prepare(`SELECT COUNT(*) c FROM team_members WHERE team_id = ?`).get(teamId)) as { c: number };
  if (teamSize.c >= 3) throw new Error("Team is full (max 3).");
  (await db.prepare(`INSERT INTO team_members (team_id, participant_id, joined_at) VALUES (?,?,?)`).run(teamId, participantId, now()));
}

export async function moveMember(participantId: number, toTeamId: number, actorLabel: string, auditFn: (e: AuditEntry) => void | Promise<void>): Promise<void> {
  const db = getDb();
  const from = (await db.prepare(`SELECT team_id FROM team_members WHERE participant_id = ?`).get(participantId)) as { team_id: number } | undefined;
  if (from?.team_id === toTeamId) return;
  const teamSize = (await db.prepare(`SELECT COUNT(*) c FROM team_members WHERE team_id = ?`).get(toTeamId)) as { c: number };
  if (teamSize.c >= 3) throw new Error("Team is full (max 3).");
  // Replace semantics: a move atomically leaves the old team and joins the new one.
  if (from) (await db.prepare(`DELETE FROM team_members WHERE participant_id = ? AND team_id = ?`).run(participantId, from.team_id));
  (await db.prepare(`INSERT INTO team_members (team_id, participant_id, joined_at) VALUES (?,?,?)`).run(toTeamId, participantId, now()));
  const p = (await db.prepare(`SELECT code FROM participants WHERE id = ?`).get(participantId)) as { code: string };
  await auditFn({
    actorLabel,
    action: "team_changed",
    targetType: "participant",
    targetId: p.code,
    oldValue: from ? from.team_id : null,
    newValue: toTeamId,
  });
}

export async function removeMember(participantId: number, actorLabel: string, auditFn: (e: AuditEntry) => void | Promise<void>): Promise<void> {
  const db = getDb();
  const from = (await db.prepare(`SELECT team_id FROM team_members WHERE participant_id = ?`).get(participantId)) as { team_id: number } | undefined;
  if (!from) return;
  (await db.prepare(`DELETE FROM team_members WHERE participant_id = ?`).run(participantId));
  const p = (await db.prepare(`SELECT code FROM participants WHERE id = ?`).get(participantId)) as { code: string };
  await auditFn({ actorLabel, action: "team_changed", targetType: "participant", targetId: p.code, oldValue: from.team_id, newValue: null });
}

/** Merge source into target: moves members and carries progress only if target has none. */
export async function mergeTeams(sourceId: number, targetId: number, actorLabel: string, auditFn: (e: AuditEntry) => void | Promise<void>): Promise<void> {
  if (sourceId === targetId) throw new Error("Cannot merge a team into itself.");
  const db = getDb();
  const members = (await db.prepare(`SELECT participant_id FROM team_members WHERE team_id = ?`).all(sourceId)) as { participant_id: number }[];
  for (const m of members) await moveMember(m.participant_id, targetId, actorLabel, auditFn);
  const srcProgress = (await db.prepare(`SELECT COUNT(*) c FROM mission_progress WHERE team_id = ? AND status != 'locked'`).get(sourceId)) as { c: number };
  const tgtProgress = (await db.prepare(`SELECT COUNT(*) c FROM mission_progress WHERE team_id = ? AND status != 'locked'`).get(targetId)) as { c: number };
  if (srcProgress.c > tgtProgress.c) {
    (await db.prepare(`DELETE FROM mission_progress WHERE team_id = ?`).run(targetId));
    (await db.prepare(`UPDATE mission_progress SET team_id = ? WHERE team_id = ?`).run(targetId, sourceId));
  }
  await db.prepare(`DELETE FROM team_members WHERE team_id = ?`).run(sourceId);
  await db.prepare(`DELETE FROM mission_progress WHERE team_id = ?`).run(sourceId);
  await db.prepare(`DELETE FROM verification_events WHERE team_id = ?`).run(sourceId);
  await db.prepare(`DELETE FROM challenge_attempts WHERE team_id = ?`).run(sourceId);
  await db.prepare(`DELETE FROM teams WHERE id = ?`).run(sourceId);
  await auditFn({ actorLabel, action: "team_merged", targetType: "team", targetId: String(targetId), oldValue: sourceId });
}

export async function generateToken(teamId: number, by: string): Promise<string> {
  const db = getDb();
  const token = deploymentToken();
  (await db.prepare(
    `UPDATE teams SET token_hash = ?, token_hint = ?, token_generated_at = ?, token_generated_by = ? WHERE id = ?`
  ).run(sha256(token), token.slice(-4), now(), by, teamId));
  return token;
}

export async function startChallenge(teamId: number, actorLabel: string, auditFn: (e: AuditEntry) => void | Promise<void>): Promise<void> {
  const db = getDb();
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");
  const hasToken = !!(await db.prepare(`SELECT 1 FROM teams WHERE id=? AND token_hash IS NOT NULL`).get(teamId));
  if (!hasToken) throw new Error("Generate the deployment token first");
  (await db.prepare(`UPDATE teams SET challenge_started_at = ? WHERE id = ?`).run(now(), teamId));
  await auditFn({ actorLabel, action: "challenge_started", targetType: "team", targetId: team.code, oldValue: team.challenge_started_at, newValue: now() });
}
