import { getDb, now } from "../db";
import { sha256 } from "../ids";
import { MISSION_ORDER, type MissionCode } from "../missions";
import { invalidateLeaderboardCache } from "./leaderboard-service";
import { getSettings } from "../settings";
import { audit, AuditEntry } from "../audit";

export interface MissionProgressRow {
  id: number;
  team_id: number;
  mission_code: MissionCode;
  status: "locked" | "available" | "in_progress" | "submitted" | "verified" | "failed";
  submitted_payload: string | null;
  submitted_at: number | null;
  verified_at: number | null;
  verified_by: string | null;
  verifier_note: string | null;
  attempt_count: number;
}

export async function ensureProgressRows(teamId: number): Promise<void> {
  const db = getDb();
  const existing = (await db.prepare(`SELECT mission_code FROM mission_progress WHERE team_id = ?`).all(teamId)) as { mission_code: MissionCode }[];
  const have = new Set(existing.map((e) => e.mission_code));
  for (const code of MISSION_ORDER) {
    if (!have.has(code)) {
      (await db.prepare(`INSERT INTO mission_progress (team_id, mission_code, status, updated_at) VALUES (?,?,?,?)`)
        .run(teamId, code, code === "M1" ? "available" : "locked", now()));
    }
  }
}

export async function recomputeUnlocks(teamId: number): Promise<void> {
  const db = getDb();
  await ensureProgressRows(teamId);
  let prevVerified = true;
  for (const code of MISSION_ORDER) {
    const row = (await getProgress(teamId, code))!;
    if (!prevVerified) {
      if (row.status === "available") {
        (await db.prepare(`UPDATE mission_progress SET status='locked', updated_at=? WHERE id=?`).run(now(), row.id));
      }
      prevVerified = false;
      continue;
    }
    if (row.status === "locked") {
      (await db.prepare(`UPDATE mission_progress SET status='available', updated_at=? WHERE id=?`).run(now(), row.id));
    }
    prevVerified = row.status === "verified";
  }
}

export async function getProgress(teamId: number, code: MissionCode): Promise<MissionProgressRow | undefined> {
  return (await getDb().prepare(`SELECT * FROM mission_progress WHERE team_id = ? AND mission_code = ?`).get(teamId, code)) as MissionProgressRow | undefined;
}

export async function getAllProgress(teamId: number): Promise<MissionProgressRow[]> {
  await ensureProgressRows(teamId);
  await recomputeUnlocks(teamId);
  return (await getDb()
    .prepare(`SELECT * FROM mission_progress WHERE team_id = ? ORDER BY mission_code`)
    .all(teamId)) as unknown as MissionProgressRow[];
}

async function logEvent(teamId: number, code: MissionCode, action: string, actorLabel: string, note?: string) {
  await getDb().prepare(
    `INSERT INTO verification_events (team_id, mission_code, action, actor_label, note, created_at) VALUES (?,?,?,?,?,?)`
  ).run(teamId, code, action, actorLabel, note ?? null, now());
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  status?: string;
}

/**
 * Participant-side submission. The participant can never set a mission to
 * verified — only to `submitted`. Official completion happens exclusively
 * through organizer verification below.
 */
export async function submitMission(params: {
  teamId: number;
  code: MissionCode;
  payload: Record<string, unknown>;
  actorLabel: string;
  checkedIn: boolean;
}): Promise<SubmitResult> {
  const db = getDb();
  const { teamId, code, payload, actorLabel, checkedIn } = params;

  if (!checkedIn) return { ok: false, error: "Your team must be checked in before submitting missions." };

  const progress = await getProgress(teamId, code);
  if (!progress) return { ok: false, error: "Mission not found." };
  if (progress.status === "locked") return { ok: false, error: `${code} is locked — verify ${MISSION_ORDER[MISSION_ORDER.indexOf(code) - 1]} first.` };
  if (progress.status === "verified") return { ok: true, status: "verified", error: undefined };
  if (code === "M4") {
    // M4 submissions go through the token flow.
    return submitDeploymentToken({ teamId, token: String(payload.token ?? ""), url: String(payload.deployedUrl ?? ""), ip: "participant", actorLabel });
  }

  (await db.prepare(
    `UPDATE mission_progress
     SET status='submitted', submitted_payload=?, submitted_at=?, attempt_count=attempt_count+1, verifier_note=NULL, updated_at=?
     WHERE id=?`
  ).run(JSON.stringify(payload), now(), now(), progress.id));
  await logEvent(teamId, code, "submit", actorLabel);
  invalidateLeaderboardCache();
  return { ok: true, status: "submitted" };
}

/** Organizer verification — the ONLY path to `verified`. */
export async function verifyMission(params: {
  teamId: number;
  code: MissionCode;
  verifierLabel: string;
  auditEntry?: Omit<AuditEntry, "action">;
}): Promise<SubmitResult> {
  const { teamId, code, verifierLabel, auditEntry } = params;
  const db = getDb();
  const progress = await getProgress(teamId, code);
  if (!progress) return { ok: false, error: "Mission not found." };
  if (progress.status === "verified") return { ok: true, status: "verified" };
  if (progress.status === "locked") return { ok: false, error: "Cannot verify a locked mission." };
  if (code === "M4") {
    const t = (await getDb().prepare(`SELECT deployment_time FROM teams WHERE id=?`).get(teamId)) as { deployment_time: number | null };
    if (!t.deployment_time) return { ok: false, error: "No successful deployment token on record for this team." };
    (await db.prepare(`UPDATE teams SET m4_verified_at=? WHERE id=?`).run(now(), teamId));
  }
  (await db.prepare(
    `UPDATE mission_progress SET status='verified', verified_at=?, verified_by=?, updated_at=? WHERE id=?`
  ).run(now(), verifierLabel, now(), progress.id));
  await logEvent(teamId, code, "verify", verifierLabel);
  await recomputeUnlocks(teamId);
  invalidateLeaderboardCache();
  if (auditEntry) await audit({ ...auditEntry, action: "mission_verified" });
  return { ok: true, status: "verified" };
}

export async function rejectMission(params: {
  teamId: number;
  code: MissionCode;
  verifierLabel: string;
  note?: string;
  retry?: boolean;
  auditEntry?: Omit<AuditEntry, "action">;
}): Promise<SubmitResult> {
  const { teamId, code, verifierLabel, note, retry, auditEntry } = params;
  const db = getDb();
  const progress = await getProgress(teamId, code);
  if (!progress) return { ok: false, error: "Mission not found." };
  if (progress.status === "verified") return { ok: false, error: "Already verified — use reset via Super Admin if needed." };
  (await db.prepare(`UPDATE mission_progress SET status='failed', verifier_note=?, updated_at=? WHERE id=?`).run(note ?? null, now(), progress.id));
  await logEvent(teamId, code, retry ? "retry" : "reject", verifierLabel, note);
  invalidateLeaderboardCache();
  if (auditEntry) await audit({ ...auditEntry, action: retry ? "retry_requested" : "mission_rejected" });
  return { ok: true, status: "failed" };
}

// ---------- M4 / Ship It ----------

export interface TokenResult {
  ok: boolean;
  error?: string;
  autoVerified?: boolean;
  deploymentTime?: number;
}

export async function submitDeploymentToken(params: {
  teamId: number;
  token: string;
  url: string;
  ip: string;
  actorLabel: string;
}): Promise<TokenResult> {
  const db = getDb();
  const settings = await getSettings();
  const team = (await db.prepare(`SELECT * FROM teams WHERE id = ?`).get(params.teamId)) as
    | { id: number; code: string; token_hash: string | null; challenge_started_at: number | null; deployment_time: number | null }
    | undefined;
  if (!team) return { ok: false, error: "Team not found." };
  if (!team.challenge_started_at) return { ok: false, error: "The challenge has not started for your team yet." };
  if (!team.token_hash) return { ok: false, error: "No token issued for your team yet — ask a mentor." };
  if (team.deployment_time) return { ok: true, deploymentTime: team.deployment_time };

  const attempts = (await db.prepare(`SELECT COUNT(*) c FROM challenge_attempts WHERE team_id=? AND result='fail'`).get(params.teamId)) as { c: number };
  if (attempts.c >= settings.maxTokenAttempts) {
    return { ok: false, error: "Too many failed attempts. Ask a mentor to inspect your deployment." };
  }

  const submittedHash = sha256(params.token.trim().toUpperCase());
  const success = submittedHash === team.token_hash;
  (await db.prepare(`INSERT INTO challenge_attempts (team_id, token_submitted_hash, result, ip, created_at) VALUES (?,?,?,?,?)`)
    .run(params.teamId, submittedHash, success ? "success" : "fail", params.ip, now()));

  if (!success) {
    await logEvent(params.teamId, "M4", "token_fail", params.actorLabel, "invalid token");
    await audit({
      actorUserId: null,
      actorLabel: params.actorLabel,
      action: "token_fail_recorded",
      targetType: "team",
      targetId: team.code,
    });
    const remaining = settings.maxTokenAttempts - attempts.c - 1;
    return { ok: false, error: `Invalid token.${remaining > 0 ? ` ${remaining} attempts left.` : ""}` };
  }

  const t = now();
  (await db.prepare(`UPDATE teams SET deployment_time=?, deployment_url=? WHERE id=?`).run(t, params.url || null, params.teamId));
  invalidateLeaderboardCache();
  (await db.prepare(`UPDATE mission_progress SET status='submitted', submitted_at=?, updated_at=? WHERE team_id=? AND mission_code='M4'`)
    .run(t, t, params.teamId));
  await logEvent(params.teamId, "M4", "token_success", params.actorLabel);

  if (settings.autoVerifyM4) {
    const res = await verifyMission({ teamId: params.teamId, code: "M4", verifierLabel: "system:auto-token" });
    await audit({
      actorUserId: null,
      actorLabel: "system:auto-token",
      action: "token_verified",
      targetType: "team",
      targetId: team.code,
      newValue: { deploymentTime: t },
    });
    return { ok: true, autoVerified: res.ok, deploymentTime: t };
  }
  await audit({
    actorUserId: null,
    actorLabel: params.actorLabel,
    action: "token_verified",
    targetType: "team",
    targetId: team.code,
    newValue: { deploymentTime: t },
  });
  return { ok: true, deploymentTime: t };
}
