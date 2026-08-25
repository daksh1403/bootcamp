import { getDb, now } from "../db";
import { getSettings } from "../settings";

export interface EventStats {
  totalRegistered: number;
  pending: number;
  approved: number;
  rejected: number;
  checkedIn: number;
  teams: number;
  soloTeams: number;
  m1Done: number;
  m2Done: number;
  m3Done: number;
  m4Done: number;
  shipItDeployed: number;
  activeParticipants: number; // checked-in with activity in last 30 min
  pendingVerifications: number;
  needsAttention: { level: "warn" | "info" | "critical"; message: string }[];
}

export async function getEventStats(): Promise<EventStats> {
  const db = getDb();
  const one = async <T>(sql: string, params: unknown[] = []): Promise<T> => (await db.prepare(sql).get(...(params as never[]))) as T;

  const reg = await one<{ total: number; pending: number; approved: number; rejected: number; checked_in: number }>(
    `SELECT COUNT(*) total,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,
            SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) approved,
            SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) rejected,
            SUM(CASE WHEN status='checked_in' THEN 1 ELSE 0 END) checked_in
     FROM participants`
  );
  const teamCounts = await one<{ teams: number }>(`SELECT COUNT(*) teams FROM teams`);
  const solo = await one<{ c: number }>(
    `SELECT COUNT(*) c FROM teams t WHERE (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) = 1`
  );
  const missions = await one<{ m1: number; m2: number; m3: number; m4: number }>(
    `SELECT
       SUM(CASE WHEN mission_code='M1' AND status='verified' THEN 1 ELSE 0 END) m1,
       SUM(CASE WHEN mission_code='M2' AND status='verified' THEN 1 ELSE 0 END) m2,
       SUM(CASE WHEN mission_code='M3' AND status='verified' THEN 1 ELSE 0 END) m3,
       SUM(CASE WHEN mission_code='M4' AND status='verified' THEN 1 ELSE 0 END) m4
     FROM mission_progress`
  );
  const deployed = await one<{ c: number }>(`SELECT COUNT(*) c FROM teams WHERE deployment_time IS NOT NULL`);
  const pending = await one<{ c: number }>(`SELECT COUNT(*) c FROM mission_progress WHERE status='submitted'`);
  const activeRecent = await one<{ c: number }>(
    `SELECT COUNT(*) c FROM mission_progress WHERE updated_at > ?`,
    [now() - 30 * 60_000]
  );
  const dockerIssues = await one<{ c: number }>(
    `SELECT COUNT(*) c FROM participants WHERE docker_installed = 'no' AND status IN ('approved','checked_in')`
  );

  const stuckM1 = (await db
  .prepare(
      `SELECT t.code FROM teams t JOIN mission_progress mp ON mp.team_id = t.id
       WHERE mp.mission_code='M1' AND mp.status IN ('available','failed','in_progress')
       AND mp.updated_at < ? AND EXISTS (SELECT 1 FROM participants p JOIN team_members tm ON tm.participant_id=p.id WHERE tm.team_id=t.id AND p.status='checked_in')`
    )
    .all(now() - 25 * 60 * 1000)) as { code: string }[];

  const settings = await getSettings();
  const attention: EventStats["needsAttention"] = [];
  if (stuckM1.length >= 3) {
    attention.push({ level: "warn", message: `${stuckM1.length} teams idle at M1 for 25+ minutes (${stuckM1.slice(0, 5).map((t) => t.code).join(", ")}${stuckM1.length > 5 ? "…" : ""})` });
  }
  if (pending.c > 0 && !settings.autoVerifyM4) {
    const m4Pending = await one<{ c: number }>(`SELECT COUNT(*) c FROM mission_progress WHERE status='submitted' AND mission_code='M4'`);
    if (m4Pending.c > 0) attention.push({ level: "warn", message: `${m4Pending.c} M4 deployment verifications waiting` });
  }
  const m13Pending = await one<{ c: number }>(`SELECT COUNT(*) c FROM mission_progress WHERE status='submitted' AND mission_code != 'M4'`);
  if (m13Pending.c > 0) attention.push({ level: "warn", message: `${m13Pending.c} mission submissions pending review` });
  if (dockerIssues.c > 0) attention.push({ level: "info", message: `${dockerIssues.c} participant(s) flagged Docker not installed` });
  if (reg.pending > 0) attention.push({ level: "info", message: `${reg.pending} registrations awaiting approval` });

  return {
    totalRegistered: reg.total ?? 0,
    pending: reg.pending ?? 0,
    approved: reg.approved ?? 0,
    rejected: reg.rejected ?? 0,
    checkedIn: reg.checked_in ?? 0,
    teams: teamCounts.teams,
    soloTeams: solo?.c ?? 0,
    m1Done: missions.m1 ?? 0,
    m2Done: missions.m2 ?? 0,
    m3Done: missions.m3 ?? 0,
    m4Done: missions.m4 ?? 0,
    shipItDeployed: deployed?.c ?? 0,
    activeParticipants: activeRecent?.c ?? 0,
    pendingVerifications: pending?.c ?? 0,
    needsAttention: attention,
  };
}
