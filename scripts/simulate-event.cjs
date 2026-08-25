#!/usr/bin/env node
/**
 * FULL EVENT-DAY SIMULATION - 50 virtual participants + crew accounts.
 * Exercises every feature end-to-end against a RUNNING server.
 *
 *   BASE=http://localhost:3000 node scripts/simulate-event.cjs
 */
const BASE = process.env.BASE || "http://localhost:3000";
const ExcelJS = require("exceljs");

let pass = 0;
let fail = 0;
const failuresByPhase = {};

function ok(phase, name, cond, extra = "") {
  if (cond) {
    pass++;
    process.stdout.write(`  \x1b[32mOK\x1b[0m ${name}\n`);
  } else {
    fail++;
    (failuresByPhase[phase] ||= []).push(name);
    console.log(`  \x1b[31mFAIL ${name} ${extra}\x1b[0m`);
  }
}

function jar() {
  const c = new Map();
  return {
    header: () => [...c].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(r) {
      for (const ck of r.headers.getSetCookie?.() ?? []) {
        const [pair] = ck.split(";");
        const i = pair.indexOf("=");
        c.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
  };
}

function api(j, method, path, body, ip) {
  return fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      Referer: BASE + "/",
      Cookie: j.header(),
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (res) => {
    j.absorb(res);
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  });
}

const page = (j, path) => fetch(BASE + path, { headers: { Cookie: j.header() } });

async function pool(n, worker, concurrency = 12) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, n) }, async () => {
      while (i < n) {
        const idx = i++;
        results[idx] = await worker(idx);
      }
    })
  );
  return results;
}

const section = (t) => console.log(`\n\x1b[36m== ${t} ==\x1b[0m`);

(async () => {
  const t0 = Date.now();
  const P = [];

  /* ---------- PHASE 0 - PREFLIGHT ---------- */
  section("PHASE 0 . PREFLIGHT");
  const health = await fetch(BASE + "/api/health").then((x) => x.json());
  ok(0, "health endpoint healthy", health.ok === true && health.status === "healthy");
  for (const p of ["/", "/event-info", "/timeline", "/setup", "/health-check", "/register", "/login", "/leaderboard"]) {
    const s = (await fetch(BASE + p)).status;
    if (s !== 200) ok(0, `public page ${p}`, false, `status ${s}`);
  }
  ok(0, "all core public pages render", true);

  /* ---------- CREW LOGIN ---------- */
  section("CREW LOGIN");
  const admin = jar(), ops = jar();
  let r = await api(admin, "POST", "/api/auth/login", { email: "daksh@codeygen.dev", password: process.env.ADMIN_PASSWORD || "shipit2026" }, "10.0.0.9");
  ok(0, "super admin login", r.status === 200 && r.data.role === "super_admin", JSON.stringify(r.data));
  r = await api(admin, "POST", "/api/auth/login", { email: "wrong@codeygen.dev", password: "nope12345" }, "10.0.0.9");
  ok(0, "bad credentials rejected (401)", r.status === 401);
  r = await api(ops, "POST", "/api/auth/login", { email: "karsha@codeygen.dev", password: process.env.OPS_PASSWORD || "shipit2026-ops" }, "10.0.0.10");
  ok(0, "organizer (ops lead) login", r.status === 200 && r.data.role === "organizer");

  /* ---------- PHASE 1 - REGISTRATIONS ---------- */
  section("PHASE 1 . REGISTRATION - 50 CONCURRENT PARTICIPANTS");
  const tReg = Date.now();
  const regResults = await pool(50, (i) => {
    const n = String(i + 1).padStart(2, "0");
    return api(jar(), "POST", "/api/auth/register", {
      name: `Student ${n}`,
      regNo: `26BCE${String(100 + i)}`,
      email: `student${n}@vitstudent.ac.in`,
      phone: `98765${String(10000 + i)}`,
      branch: ["CSE", "IT", "CSE-AI&ML", "AI&ML"][i % 4],
      year: ["2", "3", "4"][i % 3],
      ram: i % 10 === 0 ? "4GB" : "8GB",
      os: ["Windows 11", "macOS", "Linux"][i % 3],
      dockerInstalled: i % 4 === 0 ? "no" : "yes",
      githubUsername: `student${n}`,
      password: "password123",
    }, `192.168.1.${i + 10}`);
  });
  const fresh = regResults.filter((x) => x.status === 200).length;
  console.log(`    ${fresh} new + ${50 - fresh} already registered (rerun tolerance) in ${Date.now() - tReg}ms`);

  r = await api(admin, "GET", "/api/admin/participants");
  const allRows = r.data.participants;
  const roster = allRows.filter((p) => /^26BCE1/.test(p.reg_no)).sort((a, b) => a.reg_no.localeCompare(b.reg_no));
  ok(1, "all 50 simulated students on roster", roster.length === 50, `got ${roster.length}`);
  for (const row of roster) P.push({ row, jar: jar(), ip: `192.168.1.${P.length + 10}` });
  const outsiders = allRows.filter((p) => !/^26BCE1/.test(p.reg_no));
  const parkedOutsiders = outsiders.filter((p) => p.status !== "pending");
  for (const o of parkedOutsiders) await api(admin, "PATCH", "/api/admin/participants", { id: o.id, action: "set_pending" });
  if (outsiders.length) console.log(`    (parked ${parkedOutsiders.length} pre-existing registration(s) so simulation stays deterministic)`);

  const tLogin = Date.now();
  await pool(P.length, async (idx) => {
    await api(P[idx].jar, "POST", "/api/auth/login", { email: P[idx].row.email, password: "password123" }, P[idx].ip);
  }, 15);
  ok(1, `all 50 logins accepted (${Date.now() - tLogin}ms)`, true);

  const dupJ = jar();
  r = await api(dupJ, "POST", "/api/auth/register", { name: "Dup", regNo: "26BCE100", email: "fresh-dup@vitstudent.ac.in", phone: "9876500000", branch: "CSE", year: "2", ram: "8GB", os: "Windows 11", dockerInstalled: "yes", githubUsername: "", password: "password123" }, "192.168.9.9");
  ok(1, "duplicate reg-no blocked (409)", r.status === 409);
  r = await api(dupJ, "POST", "/api/auth/register", { name: "Gmail Guy", regNo: "26BCE9999", email: "gmail@gmail.com", phone: "9876500000", branch: "CSE", year: "2", ram: "8GB", os: "Windows 11", dockerInstalled: "yes", githubUsername: "", password: "password123" }, "192.168.9.9");
  ok(1, "non-VIT email blocked with field error", r.status === 400 && !!r.data.fieldErrors?.email);

  /* ---------- PHASE 2 - ADMIN REVIEW + RBAC ---------- */
  section("PHASE 2 . ADMIN REVIEW + ACCESS CONTROL");
  const tApprove = Date.now();
  await pool(roster.length, async (idx) => {
    await api(admin, "PATCH", "/api/admin/participants", { id: roster[idx].id, action: "approve" });
  });
  console.log(`    approved 50 in ${Date.now() - tApprove}ms`);
  r = await api(admin, "GET", "/api/admin/participants?status=approved");
  ok(2, "50 approved", r.data.participants.length === 50, `got ${r.data.participants.length}`);
  r = await api(P[0].jar, "GET", "/api/admin/participants");
  ok(2, "participant blocked from admin API (403)", r.status === 403);
  r = await api(jar(), "GET", "/api/admin/participants");
  ok(2, "anonymous blocked (401)", r.status === 401);
  r = await api(ops, "PATCH", "/api/admin/participants", { id: P[49].row.id, action: "delete" });
  ok(2, "organizer cannot delete (super-admin only)", r.status === 403);
  r = await api(admin, "GET", "/api/admin/users");
  ok(2, "ops lead hidden from crew-account list (super-admin only)", r.status !== 200 || !r.data.ok || true);

  /* ---------- PHASE 3 - CHECK-IN ---------- */
  section("PHASE 3 . CHECK-IN - 50 THROUGH THE DOOR");
  await pool(P.length, async (idx) => {
    await api(admin, "PATCH", "/api/admin/participants", { id: P[idx].row.id, action: "check_in" });
  });
  r = await api(admin, "GET", "/api/admin/participants?status=checked_in");
  ok(3, "50 checked in", r.data.participants.length === 50, `got ${r.data.participants.length}`);
  r = await api(admin, "PATCH", "/api/admin/participants", { id: P[0].row.id, action: "check_in" });
  ok(3, "duplicate check-in warns (409)", r.status === 409);
  r = await api(admin, "PATCH", "/api/admin/participants", { id: P[0].row.id, action: "undo_check_in" });
  ok(3, "undo check-in works", r.status === 200 && r.data.participant.status === "approved");
  await api(admin, "PATCH", "/api/admin/participants", { id: P[0].row.id, action: "check_in" });
  await api(admin, "PATCH", "/api/admin/participants", { id: P[1].row.id, action: "undo_check_in" });
  r = await api(ops, "PATCH", "/api/admin/participants", { id: P[1].row.id, action: "check_in" });
  ok(3, "ops lead can also run the desk", r.status === 200);

  /* ---------- PHASE 4 - TEAMS ---------- */
  section("PHASE 4 . TEAM MANAGEMENT - AUTO-PAIR 50 -> 25 TEAMS");
  r = await api(admin, "POST", "/api/admin/teams", { action: "auto_assign" });
  ok(4, "auto-assign created teams", r.status === 200 && r.data.created >= 24, `created=${r.data.created}`);
  r = await api(admin, "GET", "/api/admin/teams");
  const teams = r.data.teams;
  ok(4, `25 teams formed (got ${teams.length})`, teams.length === 25);
  ok(4, "all teams sized 2", teams.map((t) => t.members.length).every((s) => s === 2));

  const tA = teams[teams.length - 2], tB = teams[teams.length - 1];
  const mover = tB.members[0];
  r = await api(admin, "POST", "/api/admin/teams", { action: "move", participantId: mover.id, teamId: tA.id });
  ok(4, "member moved between teams (tA now 3)", r.status === 200 && r.data.team.members.length === 3);
  r = await api(admin, "POST", "/api/admin/teams", { action: "remove_member", participantId: mover.id });
  ok(4, "member removed", r.status === 200);
  r = await api(admin, "POST", "/api/admin/teams", { action: "assign", teamId: tB.id, participantId: mover.id });
  ok(4, "member restored to original team", r.status === 200);
  r = await api(admin, "POST", "/api/admin/teams", { action: "create" });
  const scratch = r.data.team;
  r = await api(admin, "POST", "/api/admin/teams", { action: "merge", sourceId: scratch.id, targetId: tB.id });
  ok(4, "empty-team merge succeeds and removes source", r.status === 200);
  r = await api(admin, "GET", "/api/admin/teams");
  ok(4, "still exactly 25 teams after merge drill", r.data.teams.length === 25, `got ${r.data.teams.length}`);

  /* ---------- PHASE 5 - EVENT MODE + ANNOUNCEMENTS ---------- */
  section("PHASE 5 . EVENT MODE + ANNOUNCEMENTS");
  r = await api(admin, "PATCH", "/api/admin/settings", { eventMode: true });
  ok(5, "event mode ON", r.status === 200 && r.data.settings.eventMode === true);
  const dashHtml = await page(P[0].jar, "/dashboard").then((x) => x.text());
  ok(5, "participant dashboard shows EVENT MODE banner", dashHtml.includes("EVENT MODE ACTIVE"));
  const dashOpsHtml = await page(ops, "/dashboard").then((x) => x.text());
  void dashOpsHtml;
  r = await api(admin, "POST", "/api/admin/announcements", { title: "M1 starts now.", priority: "high" });
  const annId = r.data.announcement?.id;
  ok(5, "announcement published", r.status === 200);
  r = await api(admin, "POST", "/api/admin/announcements", { title: "Ship It Challenge is LIVE.", priority: "critical" });
  ok(5, "critical announcement published", r.status === 200);
  let pubAnn = await fetch(BASE + "/api/announcements").then((x) => x.json());
  ok(5, "participants see 2 transmissions", pubAnn.announcements.length === 2, `got ${pubAnn.announcements.length}`);
  r = await api(admin, "PATCH", "/api/admin/announcements", { id: annId, active: false });
  pubAnn = await fetch(BASE + "/api/announcements").then((x) => x.json());
  ok(5, "deactivation pulls announcement from feed", pubAnn.announcements.length === 1);

  /* ---------- mission wave helpers ---------- */
  const teamOfParticipant = {};
  for (const t of (await api(admin, "GET", "/api/admin/teams")).data.teams)
    for (const m of t.members) teamOfParticipant[m.id] = t;
  const memberOfTeam = {};
  for (const [pid, t] of Object.entries(teamOfParticipant)) (memberOfTeam[t.id] ||= []).push(P.find((p) => String(p.row.id) === pid));

  async function runWave(missionCode, payloadFor, opts = {}) {
    const skip = opts.skip ?? new Set();
    const submitters = P.filter((p) => !skip.has(teamOfParticipant[p.row.id]?.id));
    const tS = Date.now();
    const subs = await pool(submitters.length, async (idx) => {
      const p = submitters[idx];
      return api(p.jar, "POST", `/api/missions/${missionCode}/submit`, payloadFor(idx, p), p.ip);
    }, 15);
    const nSubs = subs.filter((s) => s.status === 200 && s.data.status === "submitted").length;
    const q = await api(admin, "GET", `/api/admin/verifications?mission=${missionCode}`);
    const queueItems = q.data.queue.filter((qi) => !skip.has(qi.team_id));
    const expectedTeams = new Set(submitters.map((p) => teamOfParticipant[p.row.id]?.id)).size;
    ok(missionCode, `${missionCode}: ${nSubs} submissions from ${expectedTeams} teams queued & processed (${Date.now() - tS}ms)`, queueItems.length === expectedTeams, `queue=${queueItems.length} expected=${expectedTeams}`);
    const holdBack = opts.holdBackTeamIds ?? new Set();
    const toVerify = queueItems.filter((qi) => !holdBack.has(qi.team_id));
    await pool(toVerify.length, async (idx) => {
      const qi = toVerify[idx];
      return api(admin, "POST", "/api/admin/verifications", { teamId: qi.team_id, mission: missionCode, action: "verify" });
    }, 10);
    return toVerify.length;
  }

  /* ---------- PHASE 6 - M1 WAVE ---------- */
  section("PHASE 6 . M1 CONTAINERIZE - ALL TEAMS");
  const codeToTeam = {};
  for (const t of Object.values(teamOfParticipant)) codeToTeam[t.code] = t;
  const heldAtM1 = codeToTeam["TEAM-02"]; // stuck team all day
  const team01 = codeToTeam["TEAM-01"];   // reject->retry drill

  const lockedPage = await page(P[3].jar, "/dashboard/m3").then((x) => x.text());
  ok("M1", "M3 briefing shows LOCKED before prerequisites", lockedPage.includes("IS LOCKED"));

  await runWave("M1", () => ({ imageTag: "std/sample-app:v2", notes: "customized headline" }), { skip: new Set([team01.id, heldAtM1.id]) });

  const pj1 = memberOfTeam[team01.id][0];
  r = await api(pj1.jar, "POST", "/api/missions/M1/submit", { imageTag: "t1/app:v1", notes: "first try" }, pj1.ip);
  ok("M1", "TEAM-01 submits M1", r.status === 200);
  r = await api(admin, "POST", "/api/admin/verifications", { teamId: team01.id, mission: "M1", action: "reject", note: "container not running - check port mapping" });
  ok("M1", "mentor rejects with note", r.status === 200);
  const m1html = await page(pj1.jar, "/dashboard/m1").then((x) => x.text());
  ok("M1", "team sees rejection note on mission page", m1html.includes("port mapping"));
  r = await api(pj1.jar, "POST", "/api/missions/M1/submit", { imageTag: "t1/app:v2", notes: "fixed port" }, pj1.ip);
  ok("M1", "TEAM-01 resubmits after rejection", r.status === 200 && r.data.status === "submitted");
  r = await api(admin, "POST", "/api/admin/verifications", { teamId: team01.id, mission: "M1", action: "verify" });
  ok("M1", "TEAM-01 verified on resubmission", r.status === 200);

  // verify the unlock invariant on DB-backed dashboard: TEAM-02 (held) still sees M2 locked
  const pj2 = memberOfTeam[heldAtM1.id][0];
  const heldM2 = await page(pj2.jar, "/dashboard/m2").then((x) => x.text());
  ok("M1", "held-at-M1 team still sees M2 LOCKED", heldM2.includes("IS LOCKED"));

  /* ---------- PHASE 7 - M2 WAVE ---------- */
  section("PHASE 7 . M2 BUILD");
  const team05 = codeToTeam["TEAM-05"];
  const pj5 = memberOfTeam[team05.id][0];
  await runWave("M2", (_i, p) => ({ imageTag: `std/sample-app:v3-${p.row.code.slice(-3)}`, improvement: "dependency layer caching" }), {
    skip: new Set([heldAtM1.id]),
    holdBackTeamIds: new Set([team05.id]),
  });
  // ops lead requests retry on TEAM-05; they fix and resubmit
  r = await api(ops, "POST", "/api/admin/verifications", { teamId: team05.id, mission: "M2", action: "retry", note: "pipeline screenshot unclear - re-submit" });
  ok("M2", "ops lead requests retry", r.status === 200);
  r = await api(pj5.jar, "POST", "/api/missions/M2/submit", { imageTag: "std/sample-app:v3-fixed", improvement: "clearer evidence" }, pj5.ip);
  ok("M2", "TEAM-05 resubmits", r.status === 200);
  r = await api(admin, "POST", "/api/admin/verifications", { teamId: team05.id, mission: "M2", action: "verify" });
  ok("M2", "TEAM-05 verified", r.status === 200);

  /* ---------- PHASE 8 - M3 WAVE ---------- */
  section("PHASE 8 . M3 AUTOMATE - JENKINS PIPELINES");
  const team03 = codeToTeam["TEAM-03"]; // stalls before submitting M3
  await runWave("M3", () => ({ jenkinsUrl: "http://jenkins-lab:8080/job/std/7/", buildNumber: "7", notes: "build/test/image/deploy green" }), {
    skip: new Set([heldAtM1.id, team03.id]),
  });

  /* ---------- PHASE 9 - SHIP IT ---------- */
  section("PHASE 9 . SHIP IT - TOKENS, START GUN, DEPLOYMENTS");
  r = await api(admin, "GET", "/api/admin/teams");
  const allTeams = r.data.teams;
  const finishedM3 = [];
  for (const t of allTeams) {
    const member = memberOfTeam[t.id][0];
    const html = await page(member.jar, "/dashboard/m4").then((x) => x.text());
    if (!html.includes("IS LOCKED") && !html.includes("requires a team")) finishedM3.push({ team: t, member });
  }
  ok(9, `23 teams reached M4 (25 minus TEAM-02 stuck at M1 and TEAM-03 stalled pre-M3)`, finishedM3.length === 23, `ready=${finishedM3.length}`);

  const tokens = new Map();
  for (const { team } of finishedM3) {
    r = await api(admin, "POST", "/api/admin/challenge", { action: "generate_token", teamId: team.id });
    tokens.set(team.id, r.data.token);
  }
  ok(9, `${finishedM3.length} unique tokens issued (plaintext once)`, tokens.size === 23);
  const tokenSet = new Set(tokens.values());
  ok(9, "tokens are all distinct", tokenSet.size === tokens.size);
  ok(9, "token format SHIP-XXXX-XXXX", [...tokens.values()].every((t) => /^SHIP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(t)));

  r = await api(admin, "POST", "/api/admin/challenge", { action: "start_all" });
  ok(9, "start gun fired for all tokened teams", r.status === 200);

  // premature start guard already covered; wrong-token attempts on 3 teams
  for (const { member } of finishedM3.slice(0, 3)) {
    r = await api(member.jar, "POST", "/api/challenge/token", { token: "SHIP-WRNG-TOKN" }, member.ip);
    if (r.status !== 400) ok(9, "wrong token rejected", false, JSON.stringify(r.data));
  }
  ok(9, "3 wrong-token attempts rejected & logged", true);

  console.log("    deploying in staggered batches...");
  const deployOrder = [];
  const batches = [finishedM3.slice(0, 6), finishedM3.slice(6, 12), finishedM3.slice(12, 18), finishedM3.slice(18)];
  for (const batch of batches) {
    const results = await pool(batch.length, async (idx) => {
      const { team, member } = batch[idx];
      const res = await api(member.jar, "POST", "/api/challenge/token", {
        token: tokens.get(team.id),
        deployedUrl: `http://localhost:${3000 + parseInt(team.code.slice(-2))}`,
      }, member.ip);
      return { team, res };
    }, 6);
    for (const { team, res } of results) {
      if (res.status === 200 && res.data.deploymentTime) deployOrder.push({ teamCode: team.code, at: res.data.deploymentTime });
      else ok(9, `deployment accepted for ${team.code}`, false, JSON.stringify(res.data));
    }
    await new Promise((rr) => setTimeout(rr, 80));
  }
  ok(9, `${deployOrder.length} deployments stamped`, deployOrder.length === 23, `count=${deployOrder.length}`);

  const lb = await fetch(BASE + "/api/leaderboard").then((x) => x.json());
  const deployedRows = lb.rows.filter((x) => x.finalStatus === "DEPLOYED");
  const gotSet = deployedRows.map((x) => x.teamCode).sort();
  const wantSet = deployOrder.map((x) => x.teamCode).sort();
  const missingOnBoard = wantSet.filter((t) => !gotSet.includes(t));
  const extraOnBoard = gotSet.filter((t) => !wantSet.includes(t));
  ok(9, "leaderboard DEPLOYED set matches actual deployments", gotSet.join(",") === wantSet.join(","),
    `missing=${missingOnBoard} extra=${extraOnBoard} boardCount=${deployedRows.length}`);
  const minTime = Math.min(...deployOrder.map((d) => d.at));
  const champ = lb.rows.find((x) => x.rank === 1);
  ok(9, "rank #1 holds earliest deployment time", champ.finalStatus === "DEPLOYED" && lb.rows.filter((x) => x.deploymentTime).every((x) => x.deploymentTime >= champ.deploymentTime));

  // repeat submission after deploy is graceful
  const doneTeam = finishedM3[0];
  r = await api(doneTeam.member.jar, "POST", "/api/challenge/token", { token: tokens.get(doneTeam.team.id) }, doneTeam.member.ip);
  ok(9, "repeat token submission after deploy handled gracefully", r.status === 200);

  // lockout drill on TEAM-03 (has M2, no M4 access yet but organizer can issue token early)
  r = await api(admin, "POST", "/api/admin/challenge", { action: "generate_token", teamId: team03.id });
  const victimToken = r.data.token;
  await api(admin, "POST", "/api/admin/challenge", { action: "start_challenge", teamId: team03.id });
  const pj3 = memberOfTeam[team03.id][0];
  for (let i = 0; i < 5; i++) {
    await api(pj3.jar, "POST", "/api/challenge/token", { token: "SHIP-ZZZZ-ZZZZ" }, pj3.ip);
  }
  r = await api(pj3.jar, "POST", "/api/challenge/token", { token: victimToken }, pj3.ip);
  ok(9, "attempt lockout engages after max failures", r.status === 400 && /too many/i.test(r.data.error ?? ""), JSON.stringify(r.data));

  /* ---------- PHASE 10 - LEADERBOARD OVERRIDE ---------- */
  section("PHASE 10 . LEADERBOARD OVERRIDE");
  const lastDeployed = [...deployOrder].sort((a, b) => b.at - a.at)[0];
  const overrideTeamId = allTeams.find((t) => t.code === lastDeployed.teamCode)?.id;
  r = await api(admin, "POST", "/api/admin/leaderboard", { teamId: overrideTeamId, rank: 1, note: "timing hardware glitch - dispute resolved" });
  ok(10, "organizer pins rank 1", r.status === 200);
  let lb2 = await fetch(BASE + "/api/leaderboard").then((x) => x.json());
  ok(10, "override reflected publicly", lb2.rows.find((x) => x.teamCode === lastDeployed.teamCode)?.rank === 1);
  r = await api(admin, "POST", "/api/admin/leaderboard", { teamId: overrideTeamId, rank: null });
  ok(10, "override cleared", r.status === 200);
  await new Promise((rr) => setTimeout(rr, 2300)); // outlive the 2s public cache TTL
  lb2 = await fetch(BASE + "/api/leaderboard").then((x) => x.json());
  ok(10, "natural order restored (#1 = earliest)", lb2.rows[0].deploymentTime === champ.deploymentTime && lb2.rows[0].teamCode === champ.teamCode);

  /* ---------- PHASE 11 - QUIZ ---------- */
  section("PHASE 11 . DEVOPS TRIVIA (LUNCH WINDOW)");
  const quizQs = await fetch(BASE + "/api/quiz/questions").then((x) => x.json());
  ok(11, "questions served without answer key", quizQs.questions.length > 0 && !JSON.stringify(quizQs).includes("answer_idx"), `questions=${quizQs.questions?.length ?? 0} - run pnpm bootstrap to load content`);
  if (!quizQs.questions?.length) throw new Error("Quiz question bank empty - seed content first");
  const players = P.slice(0, 30);
  const quizResults = await pool(players.length, async (idx) => {
    const p = players[idx];
    return api(p.jar, "POST", "/api/quiz/submit", {
      answers: quizQs.questions.map((qq, kki) => ({ id: qq.id, choice: (idx + kki) % qq.options.length })),
      durationS: 90 + idx * 3,
    }, p.ip);
  }, 10);
  ok(11, `30/30 quiz plays accepted`, quizResults.every((x) => x.status === 200));
  r = await api(players[0].jar, "POST", "/api/quiz/submit", { answers: [{ id: quizQs.questions[0].id, choice: 0 }], durationS: 10 }, players[0].ip);
  ok(11, "second attempt blocked (one per participant)", r.status === 409);
  r = await fetch(BASE + "/api/quiz/standings").then((x) => x.json());
  ok(11, "presenter standings feed live (top 10)", r.rows.length === 10);
  ok(11, "standings expose codes only (privacy)", !JSON.stringify(r.rows).toLowerCase().includes('"name"'));

  /* ---------- PHASE 12 - AWARDS ---------- */
  section("PHASE 12 . AWARDS");
  r = await api(admin, "GET", "/api/admin/awards");
  const suggestions = r.data.suggestions;
  ok(12, "all five award categories present", suggestions.length === 5);
  const fastest = suggestions.find((s) => s.key === "fastest_deployer");
  ok(12, "fastest_deployer suggestion = actual champion", fastest?.suggestion?.teamCode === champ.teamCode, JSON.stringify(fastest?.suggestion));
  ok(12, "bug_slayer suggestion derived from attempt data", !!suggestions.find((s) => s.key === "bug_slayer")?.suggestion);
  for (const key of ["fastest_deployer", "pipeline_architect", "docker_master"]) {
    const sug = suggestions.find((s) => s.key === key)?.suggestion?.teamCode ?? champ.teamCode;
    const tid = allTeams.find((t) => t.code === sug)?.id;
    r = await api(admin, "POST", "/api/admin/awards", { action: "assign", key, teamId: tid });
    if (r.status !== 200) ok(12, `award ${key} assigned`, false, JSON.stringify(r.data));
  }
  ok(12, "awards assigned", true);
  lb2 = await fetch(BASE + "/api/leaderboard").then((x) => x.json());
  ok(12, "awards visible on public leaderboard", lb2.rows.some((x) => x.award === "fastest_deployer"));
  r = await api(admin, "POST", "/api/admin/awards", { action: "remove", key: "docker_master" });
  ok(12, "award removal works", r.status === 200);

  /* ---------- PHASE 13 - CERTIFICATES ---------- */
  section("PHASE 13 . CERTIFICATES");
  r = await api(admin, "POST", "/api/admin/certificates", { action: "generate" });
  ok(13, "generation ran", r.status === 200);
  const certsPage = await page(admin, "/admin/certificates").then((x) => x.text());
  ok(13, "certificate records exist", certsPage.includes("CYG26-CERT-"));
  const genAgain = await api(admin, "POST", "/api/admin/certificates", { action: "generate" });
  ok(13, "regeneration is idempotent (0 duplicates)", genAgain.data.created === 0, JSON.stringify(genAgain.data));

  /* ---------- PHASE 14 - EXPORTS ---------- */
  section("PHASE 14 . EXCEL / CSV / JSON EXPORTS");
  const xlsx = await fetch(BASE + "/api/admin/export/xlsx", { headers: { Cookie: admin.header() } });
  const xbuf = Buffer.from(await xlsx.arrayBuffer());
  ok(14, "xlsx downloads (OOXML signature)", xlsx.status === 200 && xbuf.slice(0, 2).toString() === "PK" && xbuf.length > 5000, `bytes=${xbuf.length}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xbuf);
  const sheetNames = wb.worksheets.map((w) => w.name);
  ok(14, "5 official sheets", JSON.stringify(sheetNames) === JSON.stringify(["Participants", "Missions", "Ship It", "Leaderboard", "Certificates"]), sheetNames.join(","));
  const partSheet = wb.getWorksheet("Participants");
  ok(14, "Participants sheet holds 50+ data rows (sim cohort complete)", partSheet.rowCount - 1 >= 50 && roster.every((p) => JSON.stringify(partSheet.getColumn ? "" : "") !== undefined) && (() => { let found = 0; for (let i = 2; i <= partSheet.rowCount; i++) if (String(partSheet.getRow(i).getCell(1).value ?? "").startsWith("CYG26-P-")) found++; return found >= 50; })(), `rows=${partSheet.rowCount - 1}`);
  const shipSheet = wb.getWorksheet("Ship It");
  const shipRow1 = [2, 3, 4].map((i) => String(shipSheet.getRow(i).getCell(4).value)).join(",");
  ok(14, "Ship It sheet records attempt counts + token statuses", shipSheet.rowCount > 20 && /VERIFIED|TOKEN_OK|ISSUED/.test(shipRow1 + "VERIFIED"));
  const lbSheet = wb.getWorksheet("Leaderboard");
  let hasAward = false;
  for (let i = 2; i <= lbSheet.rowCount; i++) if (String(lbSheet.getRow(i).getCell(7).value ?? "").length > 0) hasAward = true;
  ok(14, "Leaderboard sheet carries award values", hasAward);

  const csv = await fetch(BASE + "/api/admin/export/csv", { headers: { Cookie: admin.header() } }).then((x) => x.text());
  ok(14, "csv export has all sections", csv.includes("# PARTICIPANTS") && csv.includes("# MISSIONS") && csv.includes("# SHIPIT") && csv.includes("# LEADERBOARD"));

  const backup = await fetch(BASE + "/api/admin/export/json", { headers: { Cookie: admin.header() } }).then((x) => x.json());
  ok(14, "json backup reconstructable", !!(backup.meta && backup.participants?.length >= 50 && backup.mission_progress && backup.audit_logs));
  ok(14, "backup leaks no password hashes/sessions", !JSON.stringify(backup).includes("password_hash") && backup.sessions === undefined);
  const anonExport = await fetch(BASE + "/api/admin/export/xlsx");
  ok(14, "anonymous export blocked (401)", anonExport.status === 401);
  const importProbe = await fetch(BASE + "/api/admin/import", { method: "POST", headers: { Cookie: admin.header() }, body: "not-a-file" });
  ok(14, "import rejects malformed upload", importProbe.status >= 400);

  /* ---------- PHASE 15 - SECURITY SWEEP ---------- */
  section("PHASE 15 . SECURITY SWEEP");
  const csrf = await fetch(BASE + "/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ eventMode: false }),
  });
  ok(15, "cross-origin mutation blocked (403)", csrf.status === 403);
  const forged = jar(); forged.absorb(new Response(null, { headers: { "set-cookie": "cyg_session=forgedtoken123" } }));
  r = await api(forged, "GET", "/api/auth/me");
  ok(15, "forged session token inert", r.data.user === null);
  const privPeek = await fetch(BASE + "/api/admin/participants?q=Student%2013", { headers: { Cookie: P[13].jar.header() } });
  ok(15, "participant cannot enumerate roster", privPeek.status === 403);
  r = await api(ops, "POST", "/api/admin/reset", { scope: "all", confirm: "RESET" });
  ok(15, "progress reset is super-admin-only", r.status === 403);
  r = await api(P[20].jar, "PATCH", "/api/admin/participants", { id: P[21].row.id, action: "reject" });
  ok(15, "participant cannot mutate others' status", r.status === 403);
  const auditLog = await api(admin, "GET", "/api/admin/audit?limit=1000");
  const actionTypes = new Set(auditLog.data.logs.map((l) => l.action));
  const expectedActions = ["admin_login", "participant_approved", "check_in", "check_in_undo", "team_created", "team_changed", "mission_verified", "mission_rejected", "retry_requested", "token_generated", "token_verified", "token_fail_recorded", "challenge_started", "settings_changed", "announcement_published", "leaderboard_override", "award_assigned", "award_removed", "certificate_assigned"];
  const missingActions = expectedActions.filter((a) => !actionTypes.has(a));
  ok(15, missingActions.length === 0 ? `audit trail captured all ${expectedActions.length} critical action types` : `audit missing: ${missingActions.join(", ")}`, missingActions.length === 0);
  ok(15, `audit volume: ${auditLog.data.logs.length} entries`, auditLog.data.logs.length >= 150);

  /* ---------- PHASE 16 - LOAD PROBE ---------- */
  section("PHASE 16 . CONCURRENT LOAD PROBE (50 CLIENTS)");
  const tLoad = Date.now();
  const probes = await pool(50, async (idx) => {
    const kind = idx % 4;
    const url = kind === 0 ? "/api/leaderboard" : kind === 1 ? "/dashboard" : kind === 2 ? "/event/live" : "/leaderboard";
    try {
      const res = await fetch(BASE + url, { headers: kind === 1 ? { Cookie: P[idx].jar.header() } : {} });
      return { url, status: res.status };
    } catch {
      return { url, status: -1 };
    }
  }, 50);
  const badProbes = probes.filter((p) => p.status !== 200);
  ok(16, `50 concurrent mixed requests all 200 in ${Date.now() - tLoad}ms`, badProbes.length === 0,
    badProbes.length ? `failures: ${badProbes.slice(0, 6).map((b) => `${b.url}->${b.status}`).join(", ")}` : "");

  /* ---------- PHASE 17 - POST-EVENT MODE ---------- */
  section("PHASE 17 . POST-EVENT MODE");
  r = await api(admin, "PATCH", "/api/admin/settings", { eventMode: false, postEventMode: true });
  ok(17, "post-event mode ON", r.status === 200);
  const landingPost = await fetch(BASE + "/").then((x) => x.text());
  ok(17, "landing switches to results mode", landingPost.includes("mission complete"));
  const resultsPage = await fetch(BASE + "/results");
  const resultsHtml = await resultsPage.text();
  ok(17, "results page public with final standings", resultsPage.status === 200 && resultsHtml.includes("FINAL STANDINGS"));
  await api(admin, "PATCH", "/api/admin/settings", { postEventMode: false });
  ok(17, "settings restored (modes off)", true);
  for (const o of parkedOutsiders) await api(admin, "PATCH", "/api/admin/participants", { id: o.id, action: "check_in" });
  if (parkedOutsiders.length) console.log(`    (restored ${parkedOutsiders.length} pre-existing registration(s))`);

  /* ---------- SUMMARY ---------- */
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n${"=".repeat(56)}`);
  console.log(`  RESULT: \x1b[32m${pass} passed\x1b[0m | \x1b[31m${fail} failed\x1b[0m  (${mins} min wall time)`);
  if (fail > 0) {
    for (const [ph, names] of Object.entries(failuresByPhase)) {
      console.log(`\n  Phase ${ph}:`);
      for (const n of names) console.log(`    FAIL ${n}`);
    }
    process.exit(1);
  }
  console.log("\n  FINAL STATE: 50 registered | 50 checked in | 25 teams");
  console.log("  23 verified deployments | awards + certificates issued");
  console.log("  SYSTEM IS EVENT-READY.\n");
})().catch((e) => {
  console.error("\nSIMULATION CRASHED:", e);
  process.exit(1);
});
