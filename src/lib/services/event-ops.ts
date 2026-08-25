/* eslint-disable @typescript-eslint/no-explicit-any -- better-sqlite3 rows are dynamically typed; shapes enforced at usage sites */
import { getDb, now } from "../db";
import { certificateCode } from "../ids";
import { audit } from "../audit";
import { invalidateLeaderboardCache } from "./leaderboard-service";

// ---------- Announcements ----------

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "critical";
  active: number;
  countdown_to: number | null;
  created_by: string | null;
  created_at: number;
}

export async function listAnnouncements(onlyActive = false): Promise<AnnouncementRow[]> {
  const db = getDb();
  const sql = onlyActive ? `SELECT * FROM announcements WHERE active=1 ORDER BY created_at DESC` : `SELECT * FROM announcements ORDER BY created_at DESC`;
  return (await db.prepare(sql).all()) as unknown as AnnouncementRow[];
}

export async function createAnnouncement(params: {
  title: string;
  body: string;
  priority?: AnnouncementRow["priority"];
  countdownMin?: number | null;
  by: string;
}): Promise<AnnouncementRow> {
  const db = getDb();
  const info = await db
  .prepare(`INSERT INTO announcements (title, body, priority, countdown_to, created_by, created_at) VALUES (?,?,?,?,?,?)`)
    .run(params.title.slice(0, 120), (params.body ?? "").slice(0, 1000), params.priority ?? "normal", params.countdownMin ? now() + params.countdownMin * 60_000 : null, params.by, now());
  await audit({ actorLabel: params.by, action: "announcement_published", targetType: "announcement", targetId: String(info.lastInsertRowid) });
  return (await db.prepare(`SELECT * FROM announcements WHERE id=?`).get(Number(info.lastInsertRowid))) as unknown as AnnouncementRow;
}

export async function setAnnouncementActive(id: number, active: boolean, by: string): Promise<void> {
  await getDb().prepare(`UPDATE announcements SET active=? WHERE id=?`).run(active ? 1 : 0, id);
  if (!active) await audit({ actorLabel: by, action: "announcement_removed", targetId: String(id) });
}

// ---------- Certificates ----------

const AWARD_LABELS: Record<string, string> = {
  fastest_deployer: "Fastest Deployer",
  pipeline_architect: "Pipeline Architect",
  docker_master: "Docker Master",
  bug_slayer: "Bug Slayer",
  devops_innovator: "DevOps Innovator",
};

export function awardLabel(key: string): string {
  return AWARD_LABELS[key] ?? key;
}

/**
 * Generate certificate records for eligible participants:
 *  - everyone checked in => attended
 *  - all 4 missions verified => completed
 * Idempotent; returns number of newly created records.
 */
export async function generateCertificates(by: string): Promise<number> {
  const db = getDb();
  const rows = (await db
  .prepare(
      `SELECT p.id, p.status,
              (SELECT COUNT(*) FROM mission_progress mp JOIN team_members tm ON tm.team_id = mp.team_id WHERE tm.participant_id = p.id AND mp.status='verified') verifiedCount
       FROM participants p`
    )
    .all()) as { id: number; status: string; verifiedCount: number }[];
  let created = 0;
  for (const r of rows) {
    if (r.status !== "checked_in" && r.status !== "approved") continue;
    const existing = (await db.prepare(`SELECT id FROM certificates WHERE participant_id=?`).get(r.id));
    if (existing) continue;
    const completion = r.verifiedCount >= 4 ? "completed" : r.status === "checked_in" ? "attended" : null;
    if (!completion) continue;
    const team = (await db.prepare(`SELECT team_id FROM team_members WHERE participant_id=?`).get(r.id)) as { team_id: number } | undefined;
    (await db.prepare(`INSERT INTO certificates (cert_code, participant_id, team_id, completion_status, awarded_at, created_at) VALUES (?,?,?,?,?,?)`)
      .run(certificateCode(), r.id, team?.team_id ?? null, completion, now(), now()));
    created++;
  }
  if (created > 0) await audit({ actorLabel: by, action: "certificate_assigned", newValue: { created } });
  return created;
}

export async function markCertificateIssued(certId: number, issued: boolean, by: string): Promise<void> {
  const db = getDb();
  await db.prepare(`UPDATE certificates SET issued=? WHERE id=?`).run(issued ? 1 : 0, certId);
  await audit({ actorLabel: by, action: issued ? "certificate_assigned" : "certificate_revoked", targetId: String(certId) });
}

export async function upgradeCertificateToExcellence(participantId: number, by: string): Promise<void> {
  const db = getDb();
  await db.prepare(`UPDATE certificates SET completion_status='excellence' WHERE participant_id=?`).run(participantId);
  await audit({ actorLabel: by, action: "certificate_assigned", targetId: String(participantId), newValue: { excellence: true } });
}

export async function listCertificates(): Promise<any[]> {
  return (await getDb()
    .prepare(
      `SELECT c.*, p.name, p.reg_no, p.code AS participant_code,
        (SELECT t.code FROM teams t WHERE t.id = c.team_id) AS team_code
       FROM certificates c JOIN participants p ON p.id=c.participant_id ORDER BY c.completion_status DESC, p.name`
    )
    .all()) as any[];
}

// ---------- Awards ----------

export interface AwardSuggestion {
  key: string;
  label: string;
  suggestion: { teamCode: string; reason: string } | null;
}

export async function getAwardSuggestions(): Promise<AwardSuggestion[]> {
  const db = getDb();
  const suggestions: AwardSuggestion[] = [];
  const teamsWithM4 = (await db
  .prepare(`SELECT code, deployment_time FROM teams WHERE m4_verified_at IS NOT NULL ORDER BY deployment_time ASC LIMIT 1`)
    .get()) as { code: string; deployment_time: number } | undefined;

  let fastest: { teamCode: string; reason: string } | null = teamsWithM4
    ? { teamCode: teamsWithM4.code, reason: "Earliest verified deployment time" }
    : null;
  if (!fastest) {
    const t = (await db.prepare(`SELECT code, deployment_time FROM teams WHERE deployment_time IS NOT NULL ORDER BY deployment_time LIMIT 1`).get()) as { code: string; deployment_time: number } | undefined;
    if (t) fastest = { teamCode: t.code, reason: "Earliest token acceptance (pending final verify)" };
  }
  suggestions.push({ key: "fastest_deployer", label: AWARD_LABELS.fastest_deployer, suggestion: fastest });

  const pipeline = (await db
  .prepare(
      `SELECT t.code, MIN(m3.verified_at) - MIN(m2.verified_at) AS delta
       FROM teams t
       JOIN mission_progress m2 ON m2.team_id=t.id AND m2.mission_code='M2' AND m2.status='verified'
       JOIN mission_progress m3 ON m3.team_id=t.id AND m3.mission_code='M3' AND m3.status='verified'
       GROUP BY t.id HAVING delta IS NOT NULL ORDER BY delta ASC LIMIT 1`
    )
    .get()) as { code: string; delta: number } | undefined;
  suggestions.push({
    key: "pipeline_architect",
    label: AWARD_LABELS.pipeline_architect,
    suggestion: pipeline ? { teamCode: pipeline.code, reason: "Fastest M2 → M3 automation gap" } : null,
  });

  const docker = (await db
  .prepare(
      `SELECT t.code, MIN(m1.verified_at) AS firstDone FROM teams t
       JOIN mission_progress m1 ON m1.team_id=t.id AND m1.mission_code='M1' AND m1.status='verified'
       JOIN mission_progress m2b ON m2b.team_id=t.id AND m2b.mission_code='M2' AND m2b.status='verified'
       GROUP BY t.id ORDER BY firstDone ASC LIMIT 1`
    )
    .get()) as { code: string; firstDone: number } | undefined;
  suggestions.push({
    key: "docker_master",
    label: AWARD_LABELS.docker_master,
    suggestion: docker ? { teamCode: docker.code, reason: "Fastest to complete M1+M2 containerization block" } : null,
  });

  const bugSlayer = (await db
  .prepare(
      `SELECT t.code, SUM(mp.attempt_count) attempts FROM teams t
       JOIN mission_progress mp ON mp.team_id=t.id
       GROUP BY t.id HAVING attempts >= 3 ORDER BY attempts DESC LIMIT 1`
    )
    .get()) as { code: string; attempts: number } | undefined;
  suggestions.push({
    key: "bug_slayer",
    label: AWARD_LABELS.bug_slayer,
    suggestion: bugSlayer ? { teamCode: bugSlayer.code, reason: `${bugSlayer.attempts} total submission attempts — fought through failures` } : null,
  });

  suggestions.push({ key: "devops_innovator", label: AWARD_LABELS.devops_innovator, suggestion: null });

  const assignedRows = (await db.prepare(`SELECT award_key, team_id FROM awards`).all()) as any[];
  const assigned = new Map(assignedRows.map((a: any) => [a.award_key, a.team_id]));
  return suggestions.map((s) => ({ ...s, assignedTeamId: assigned.get(s.key) ?? null })) as any[];
}

export async function assignAward(key: string, teamId: number, by: string): Promise<void> {
  const db = getDb();
  await db.prepare(
    `INSERT INTO awards (award_key, team_id, assigned_by, assigned_at) VALUES (?,?,?,?)
     ON CONFLICT(award_key) DO UPDATE SET team_id=excluded.team_id, assigned_by=excluded.assigned_by, assigned_at=excluded.assigned_at`
  ).run(key, teamId, by, now());
  const team = (await db.prepare(`SELECT code FROM teams WHERE id=?`).get(teamId)) as { code: string };
  await db.prepare(`UPDATE teams SET award=? WHERE id=?`).run(key, teamId);
  invalidateLeaderboardCache();
  await audit({ actorLabel: by, action: "award_assigned", targetId: key, newValue: { teamCode: team.code } });
}

export async function removeAward(key: string, by: string): Promise<void> {
  const db = getDb();
  const row = (await db.prepare(`SELECT team_id FROM awards WHERE award_key=?`).get(key)) as { team_id: number } | undefined;
  await db.prepare(`DELETE FROM awards WHERE award_key=?`).run(key);
  if (row) await db.prepare(`UPDATE teams SET award=NULL WHERE id=?`).run(row.team_id);
  invalidateLeaderboardCache();
  await audit({ actorLabel: by, action: "award_removed", targetId: key });
}
