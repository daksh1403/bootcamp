import { getDb, now } from "../db";
import { participantCode } from "../ids";
import { hashPassword } from "../auth";
import type { RegistrationInput } from "../validation";
import type { AuditEntry } from "../audit";

export interface ParticipantRow {
  id: number;
  code: string;
  user_id: number | null;
  name: string;
  reg_no: string;
  email: string;
  phone: string;
  branch: string;
  year: string;
  ram: string;
  os: string;
  docker_installed: string;
  github_username: string | null;
  status: "pending" | "approved" | "rejected" | "checked_in";
  checked_in_at: number | null;
  notes: string | null;
  created_at: number;
}

export interface TeamRow {
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
}

export async function findParticipantByEmail(email: string): Promise<ParticipantRow | undefined> {
  return (await getDb().prepare(`SELECT * FROM participants WHERE email = ?`).get(email)) as ParticipantRow | undefined;
}

export async function findParticipantByRegNo(regNo: string): Promise<ParticipantRow | undefined> {
  return (await getDb().prepare(`SELECT * FROM participants WHERE reg_no = ?`).get(regNo)) as ParticipantRow | undefined;
}

/** Returns error string on duplicate, else null. */
export async function detectDuplicate(email: string, regNo: string): Promise<string | null> {
  if (await findParticipantByEmail(email)) return "This email is already registered.";
  if (await findParticipantByRegNo(regNo)) return "This registration number is already registered.";
  return null;
}

export async function registerParticipant(
  input: RegistrationInput,
  opts?: { skipPassword?: string }
): Promise<ParticipantRow> {
  const db = getDb();
  const t = now();
  const passwordHash = await hashPassword(opts?.skipPassword ?? input.password);
  const existingUser = (await db.prepare(`SELECT id FROM users WHERE email = ?`).get(input.email)) as { id: number } | undefined;
  if (existingUser) {
    throw new Error("Account already exists for this email — try logging in.");
  }
  const info = await db
  .prepare(`INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?,?,?,?,?)`)
    .run(input.email, passwordHash, "participant", input.name, t);
  const userId = Number(info.lastInsertRowid);

  const code = participantCode();
  (await db.prepare(
    `INSERT INTO participants
      (code, user_id, name, reg_no, email, phone, branch, year, ram, os, docker_installed, github_username, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    code,
    userId,
    input.name,
    input.regNo,
    input.email,
    input.phone,
    input.branch,
    input.year,
    input.ram,
    input.os,
    input.dockerInstalled,
    input.githubUsername || null,
    "pending",
    t,
    t
  ));
  return (await findParticipantByEmail(input.email))!;
}

export async function listParticipants(filter?: { status?: string; q?: string; noTeam?: boolean }): Promise<(ParticipantRow & { team_code: string | null })[]> {
  const db = getDb();
  let sql = `SELECT p.*, tm.team_id FROM participants p
             LEFT JOIN team_members tm ON tm.participant_id = p.id WHERE 1=1`;
  const params: unknown[] = [];
  if (filter?.status && filter.status !== "all") {
    sql += ` AND p.status = ?`;
    params.push(filter.status);
  }
  if (filter?.q) {
    sql += ` AND (p.name LIKE ? OR p.reg_no LIKE ? OR p.code LIKE ? OR p.email LIKE ?)`;
    const like = `%${filter.q}%`;
    params.push(like, like.toUpperCase(), like, like);
  }
  if (filter?.noTeam) sql += ` AND tm.team_id IS NULL`;
  sql += ` ORDER BY p.created_at ASC`;
  const rows = (await db.prepare(sql).all(...(params as never[]))) as unknown as (ParticipantRow & { team_id: number | null })[];
  if (rows.length === 0) return [];
  const teamCodes = new Map<number, string>();
  for (const t of (await db.prepare(`SELECT id, code FROM teams`).all()) as { id: number; code: string }[]) {
    teamCodes.set(t.id, t.code);
  }
  return rows.map(({ team_id, ...p }) => ({ ...p, team_code: team_id ? teamCodes.get(team_id) ?? null : null }));
}

export async function getParticipantByUserId(userId: number): Promise<ParticipantRow | undefined> {
  return (await getDb().prepare(`SELECT * FROM participants WHERE user_id = ?`).get(userId)) as ParticipantRow | undefined;
}

export async function getParticipantById(id: number): Promise<ParticipantRow | undefined> {
  return (await getDb().prepare(`SELECT * FROM participants WHERE id = ?`).get(id)) as ParticipantRow | undefined;
}

export async function setParticipantStatus(
  id: number,
  status: ParticipantRow["status"],
  opts: { actorLabel: string; ip?: string; actionOverride?: string; auditFn: (e: AuditEntry) => void | Promise<void> }
): Promise<void> {
  const db = getDb();
  const before = await getParticipantById(id);
  if (!before) throw new Error("Participant not found");
  const t = now();
  (await db.prepare(
    `UPDATE participants SET status = ?, checked_in_at = ?, updated_at = ? WHERE id = ?`
  ).run(status, status === "checked_in" ? t : before.checked_in_at, t, id));
  const inferred =
    status === "approved" && before.status === "checked_in" ? "check_in_undo"
    : status === "approved" ? "participant_approved"
    : status === "rejected" ? "participant_rejected"
    : status === "checked_in" ? "check_in"
    : "participant_updated";
  opts.auditFn({
    actorLabel: opts.actorLabel,
    action: opts.actionOverride ?? inferred,
    targetType: "participant",
    targetId: before.code,
    oldValue: before.status,
    newValue: status,
    ip: opts.ip,
  });
}
