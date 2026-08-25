/* eslint-disable @typescript-eslint/no-explicit-any -- better-sqlite3 rows are dynamically typed; shapes enforced at usage sites */
import ExcelJS from "exceljs";
import { getDb } from "./db";
import { listParticipants } from "./services/participants";
import type { LeaderboardEntry } from "./leaderboard";

export interface ExportBundle {
  generatedAt: number;
  participants: Awaited<ReturnType<typeof listParticipants>>;
  teams: {
    code: string;
    name: string;
    members: string[];
    m1Status: string; m1Time: number | null;
    m2Status: string; m2Time: number | null;
    m3Status: string; m3Time: number | null;
    m4Status: string; m4Time: number | null;
    verifiedBy: string | null;
    challengeStart: number | null;
    attemptCount: number;
    tokenStatus: string;
    deploymentTime: number | null;
  }[];
  leaderboard: LeaderboardEntry[];
  certificates: { participant: string; regNo: string; teamCode: string | null; completionStatus: string; certCode: string; issued: boolean; award: string | null }[];
}

export async function buildExportBundle(leaderboardRows: LeaderboardEntry[]): Promise<ExportBundle> {
  const db = getDb();
  const participants = await listParticipants();

  const progressByTeam = new Map<number, Map<string, { status: string; submittedAt: number | null; verifiedAt: number | null; verifiedBy: string | null }>>();
  for (const row of (await db.prepare(`SELECT * FROM mission_progress`).all()) as any[]) {
    if (!progressByTeam.has(row.team_id)) progressByTeam.set(row.team_id, new Map());
    progressByTeam.get(row.team_id)!.set(row.mission_code, {
      status: row.status,
      submittedAt: row.submitted_at,
      verifiedAt: row.verified_at,
      verifiedBy: row.verified_by,
    });
  }
  const attemptsByTeam = new Map<number, number>();
  for (const a of (await db.prepare(`SELECT team_id, COUNT(*) c FROM challenge_attempts GROUP BY team_id`).all()) as any[]) {
    attemptsByTeam.set(a.team_id, a.c);
  }
  const memberMap = new Map<number, string[]>();
  for (const m of (await db.prepare(`SELECT tm.team_id, p.name FROM team_members tm JOIN participants p ON p.id=tm.participant_id ORDER BY p.name`).all()) as any[]) {
    if (!memberMap.has(m.team_id)) memberMap.set(m.team_id, []);
    memberMap.get(m.team_id)!.push(m.name);
  }

  const teams = ((await db.prepare(`SELECT * FROM teams ORDER BY code`).all()) as any[]).map((t) => {
    const pm = progressByTeam.get(t.id) ?? new Map();
    const g = (c: string) => pm.get(c);
    const tokenIssued = !!t.token_hash;
    const deployed = t.deployment_time != null;
    const verified = !!g("M4")?.verifiedAt;
    return {
      code: t.code,
      name: t.name ?? "",
      members: memberMap.get(t.id) ?? [],
      m1Status: g("M1")?.status ?? "locked",
      m1Time: g("M1")?.verifiedAt ?? null,
      m2Status: g("M2")?.status ?? "locked",
      m2Time: g("M2")?.verifiedAt ?? null,
      m3Status: g("M3")?.status ?? "locked",
      m3Time: g("M3")?.verifiedAt ?? null,
      m4Status: verified ? "verified" : deployed ? "submitted" : g("M4")?.status ?? "locked",
      m4Time: t.m4_verified_at ?? null,
      verifiedBy: g("M4")?.verifiedBy ?? null,
      challengeStart: t.challenge_started_at,
      attemptCount: attemptsByTeam.get(t.id) ?? 0,
      tokenStatus: verified ? "VERIFIED" : deployed ? "TOKEN_OK" : tokenIssued ? "ISSUED" : "NOT_ISSUED",
      deploymentTime: t.deployment_time,
    };
  });

  const teamById = new Map<number, string>();
  for (const t of (await db.prepare(`SELECT id, code FROM teams`).all()) as any[]) teamById.set(t.id, t.code);
  const awards = new Map<string, string>();
  for (const a of (await db.prepare(`SELECT * FROM awards`).all()) as any[]) {
    if (a.team_id) awards.set(String(a.team_id), a.award_key);
  }

  const certificates = (
    (
      await db
      .prepare(
          `SELECT c.*, p.name, p.reg_no FROM certificates c JOIN participants p ON p.id = c.participant_id ORDER BY c.cert_code`
        )
        .all()
    ) as any[]
  ).map((c) => ({
    participant: c.name,
    regNo: c.reg_no,
    teamCode: c.team_id ? teamById.get(c.team_id) ?? null : null,
    completionStatus: c.completion_status,
    certCode: c.cert_code,
    issued: !!c.issued,
    award: awards.get(String(c.team_id ?? "")) ?? null,
  }));

  return { generatedAt: Date.now(), participants, teams, leaderboard: leaderboardRows, certificates };
}

const HEADER_FILL = "FF10161D";
const fmtTime = (t: number | null): string => (t ? new Date(t).toISOString() : "");

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF22D3EE" }, name: "Consolas" };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function buildWorkbook(bundle: ExportBundle): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Docker x Jenkins Bootcamp — Code{Y}Gen VITC";
  wb.created = new Date(bundle.generatedAt);

  // ---- Participants ----
  const wsP = wb.addWorksheet("Participants");
  wsP.addRow([
    "Participant ID", "Team ID", "Name", "Registration Number", "Email", "Phone", "Branch", "Year",
    "RAM", "OS", "Docker Installed", "GitHub", "Registration Status", "Check-in Status",
  ]);
  for (const p of bundle.participants) {
    wsP.addRow([
      p.code, p.team_code ?? "", p.name, p.reg_no, p.email, p.phone, p.branch, p.year,
      p.ram, p.os, p.docker_installed.toUpperCase(), p.github_username ?? "", p.status.toUpperCase(),
      p.status === "checked_in" ? "YES" : "NO",
    ]);
  }
  styleHeader(wsP);

  // ---- Missions ----
  const wsM = wb.addWorksheet("Missions");
  wsM.addRow([
    "Team ID", "M1 Status", "M1 Time", "M2 Status", "M2 Time", "M3 Status", "M3 Time", "M4 Status", "M4 Time", "Verified By",
  ]);
  for (const t of bundle.teams) {
    wsM.addRow([
      t.code, t.m1Status.toUpperCase(), fmtTime(t.m1Time), t.m2Status.toUpperCase(), fmtTime(t.m2Time),
      t.m3Status.toUpperCase(), fmtTime(t.m3Time), t.m4Status.toUpperCase(), fmtTime(t.m4Time), t.verifiedBy ?? "",
    ]);
  }
  styleHeader(wsM);

  // ---- Ship It ----
  const wsS = wb.addWorksheet("Ship It");
  wsS.addRow(["Team ID", "Challenge Start", "Attempt Count", "Token Status", "Deployment Time", "Verification Status", "Verified By"]);
  for (const t of bundle.teams) {
    wsS.addRow([
      t.code, fmtTime(t.challengeStart), t.attemptCount, t.tokenStatus, fmtTime(t.deploymentTime),
      t.m4Status.toUpperCase(), t.verifiedBy ?? "",
    ]);
  }
  styleHeader(wsS);

  // ---- Leaderboard ----
  const wsL = wb.addWorksheet("Leaderboard");
  wsL.addRow(["Rank", "Team ID", "Team Name", "Missions Completed", "Deployment Time", "Final Status", "Award"]);
  for (const r of bundle.leaderboard) {
    wsL.addRow([r.rank ?? "", r.teamCode, `${r.teamName}${r.members.length ? ` (${r.members.join(", ")})` : ""}`, r.missionsCompleted, fmtTime(r.deploymentTime), r.finalStatus, r.award ?? ""]);
  }
  styleHeader(wsL);

  // ---- Certificates ----
  const wsC = wb.addWorksheet("Certificates");
  wsC.addRow(["Participant", "Registration Number", "Team ID", "Completion Status", "Certificate ID", "Issued", "Award"]);
  for (const c of bundle.certificates) {
    wsC.addRow([c.participant, c.regNo, c.teamCode ?? "", c.completionStatus.toUpperCase(), c.certCode, c.issued ? "YES" : "NO", c.award ?? ""]);
  }
  styleHeader(wsC);

  [wsP, wsM, wsS, wsL, wsC].forEach((ws) => {
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        max = Math.max(max, String(cell.value ?? "").length + 2);
      });
      col.width = Math.min(max, 42);
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Parse an imported Participants sheet back into records keyed by header names. */
export async function parseParticipantsWorkbook(buffer: Buffer): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("Participants");
  if (!ws) throw new Error('Missing "Participants" sheet');
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, num) => {
    if (num === 1) return;
    const obj: Record<string, string> = {};
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (key) {
        obj[key] = String(cell.value ?? "").trim();
        hasData = true;
      }
    });
    if (hasData) rows.push(obj);
  });
  return rows;
}
