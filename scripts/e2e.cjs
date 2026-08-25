#!/usr/bin/env node
/**
 * Full end-to-end walkthrough against a RUNNING server.
 * Exercises scenarios A–L from the acceptance criteria.
 *
 * Usage: BASE=http://localhost:3000 node scripts/e2e.cjs
 */
const BASE = process.env.BASE || "http://localhost:3000";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function jar() {
  const cookies = new Map();
  return {
    header: () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      const set = res.headers.getSetCookie?.() ?? [];
      for (const c of set) {
        const [pair] = c.split(";");
        const idx = pair.indexOf("=");
        cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
  };
}

async function api(j, method, path, body, expectStatus = 200) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE, Referer: BASE + "/", Cookie: j.header() },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  j.absorb(res);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  console.log(`E2E against ${BASE}\n`);

  // ---------- Setup: ensure super admin exists via API-less path is not possible; use provided env ----------
  // We assume the server was started after `pnpm bootstrap` with ADMIN_EMAIL=a@b.dev / ADMIN_PASSWORD=password1
  const admin = jar();
  console.log("[0] Admin login");
  let r = await api(admin, "POST", "/api/auth/login", { email: process.env.ADMIN_EMAIL || "a@b.dev", password: process.env.ADMIN_PASSWORD || "password1" });
  check("admin authenticated", r.status === 200 && r.data.ok, JSON.stringify(r.data));

  // ---------- Scenario A: registration ----------
  console.log("\n[A] Participant registers");
  const uniq = Math.random().toString(36).slice(2, 8).toUpperCase();
  const pJ = jar();
  r = await api(pJ, "POST", "/api/auth/register", {
    name: "E2E Student", regNo: `26BCE${uniq}`, email: `e2e-${uniq.toLowerCase()}@vitstudent.ac.in`,
    phone: "9876543210", branch: "CSE", year: "2", ram: "8GB", os: "Windows 11",
    dockerInstalled: "no", githubUsername: "e2ecat", password: "password123",
  });
  check("registration accepted", r.status === 200 && r.data.ok);
  const participantCode = r.data?.participant?.code;

  // duplicate rejected
  const dupJ = jar();
  r = await api(dupJ, "POST", "/api/auth/register", {
    name: "Dup Student", regNo: `26BCE${uniq}`, email: `other${Math.random()}@vitstudent.ac.in`,
    phone: "9876543211", branch: "IT", year: "3", ram: "8GB", os: "macOS",
    dockerInstalled: "yes", githubUsername: "", password: "password123",
  });
  check("duplicate reg-no rejected (409)", r.status === 409);

  // invalid email rejected
  r = await api(jar(), "POST", "/api/auth/register", {
    name: "Gmail Student", regNo: `26BCE${Math.random().toString(36).slice(2, 8)}`, email: "not-vit@gmail.com",
    phone: "9876543212", branch: "CSE", year: "2", ram: "8GB", os: "Windows 11",
    dockerInstalled: "yes", githubUsername: "", password: "password123",
  });
  check("non-VIT email rejected with field error", r.status === 400 && r.data.fieldErrors?.email);

  // ---------- Scenario B: organizer approves ----------
  console.log("\n[B] Organizer approves");
  r = await api(admin, "GET", `/api/admin/participants?q=${participantCode}`);
  const row = r.data.participants?.[0];
  check("participant findable by ID", !!row);
  r = await api(admin, "PATCH", "/api/admin/participants", { id: row.id, action: "approve" });
  check("approved", r.status === 200 && r.data.participant.status === "approved");

  // RBAC: participant cannot call admin APIs
  r = await api(pJ, "GET", "/api/admin/participants");
  check("participant blocked from admin API (403)", r.status === 403);
  // anonymous blocked
  r = await api(jar(), "GET", "/api/admin/participants");
  check("anonymous blocked (401)", r.status === 401);

  // ---------- Scenario C: check-in ----------
  console.log("\n[C] Check-in");
  r = await api(admin, "PATCH", "/api/admin/participants", { id: row.id, action: "check_in" });
  check("checked in", r.status === 200 && r.data.participant.status === "checked_in");
  r = await api(admin, "PATCH", "/api/admin/participants", { id: row.id, action: "check_in" });
  check("duplicate check-in warns (409)", r.status === 409);

  // ---------- Team assignment ----------
  console.log("\n[T] Team assignment");
  r = await api(admin, "POST", "/api/admin/teams", { action: "create" });
  check("team created", r.status === 200);
  r = await api(admin, "POST", "/api/admin/teams", { action: "assign", teamId: r.data.team.id, participantId: row.id });
  check("participant assigned to team", r.status === 200);

  // ---------- Scenarios D–F: M1 submit → verify → M2 unlocks ----------
  console.log("\n[D-F] M1 → M3 chain");
  for (const code of ["M1", "M2"]) {
    r = await api(pJ, "POST", `/api/missions/${code}/submit`, code === "M1"
      ? { imageTag: "e2e/sample-app:v2", notes: "customized headline" }
      : { imageTag: "e2e/sample-app:v3", improvement: "layer caching" });
    check(`${code} submitted`, r.status === 200 && r.data.status === "submitted");

    const q = await api(admin, "GET", `/api/admin/verifications?mission=${code}`);
    const item = q.data.queue.find((x) => x.team_code === r.data.teamCode) ?? q.data.queue[0];
    check(`${code} appears in queue`, !!item);
    r = await api(admin, "POST", "/api/admin/verifications", { teamId: item.team_id, mission: code, action: "verify" });
    check(`${code} VERIFIED by organizer`, r.status === 200 && r.data.status === "verified");

    if (code === "M1") {
      // M2 must now be available but NOT verified
      const dash = await fetch(`${BASE}/dashboard/m2`, { headers: { Cookie: pJ.header() } });
      const html = await dash.text();
      check("M2 briefing accessible after unlock", dash.status === 200 && !html.includes("IS LOCKED"));
    }
  }

  // M3 Jenkins submission
  r = await api(pJ, "POST", "/api/missions/M3/submit", { jenkinsUrl: "http://jenkins:8080/job/x/7/", buildNumber: "7", notes: "all green" });
  check("M3 submitted", r.status === 200);
  let q = await api(admin, "GET", "/api/admin/verifications?mission=M3");
  const m3 = q.data.queue[0];
  r = await api(admin, "POST", "/api/admin/verifications", { teamId: m3.team_id, mission: "M3", action: "verify" });
  check("M3 VERIFIED", r.status === 200);

  // ---------- Scenario G/H: Ship It — token flow ----------
  console.log("\n[G-H] SHIP IT token flow");
  // premature token submission must fail
  r = await api(pJ, "POST", "/api/challenge/token", { token: "SHIP-AAAA-BBBB" });
  check("token before challenge start rejected", r.status === 400);

  r = await api(admin, "POST", "/api/admin/challenge", { action: "generate_token", teamId: m3.team_id });
  check("token generated (plaintext returned once)", r.status === 200 && /^SHIP-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.data.token || ""));
  const realToken = r.data.token;

  r = await api(admin, "POST", "/api/admin/challenge", { action: "start_challenge", teamId: m3.team_id });
  check("challenge started", r.status === 200);

  r = await api(pJ, "POST", "/api/challenge/token", { token: "SHIP-WRNG-TOKN", deployedUrl: "" });
  check("wrong token rejected", r.status === 400);
  r = await api(pJ, "POST", "/api/challenge/token", { token: realToken.toLowerCase().replace("ship", "SHIP"), deployedUrl: "http://localhost:3000" });
  check("correct token accepted", r.status === 200 && r.data.ok === true);

  // ---------- Scenario I/J: leaderboard updates ----------
  console.log("\n[I-J] Deployment verified + leaderboard");
  r = await fetch(`${BASE}/api/leaderboard`).then((x) => x.json());
  const entry = r.rows.find((x) => x.deploymentTime);
  check("leaderboard shows deployment time", !!entry);

  // ---------- Scenario K: Excel export ----------
  console.log("\n[K] Excel export");
  const xlsxRes = await fetch(`${BASE}/api/admin/export/xlsx`, { headers: { Cookie: admin.header() } });
  const buf = Buffer.from(await xlsxRes.arrayBuffer());
  check("xlsx downloads as OOXML", xlsxRes.status === 200 && buf.slice(0, 2).toString() === "PK");
  const jsonRes = await fetch(`${BASE}/api/admin/export/json`, { headers: { Cookie: admin.header() } });
  const backup = await jsonRes.json();
  check(
    "json backup contains all event tables",
    !!(backup.meta && backup.participants && backup.teams && backup.mission_progress && backup.audit_logs),
  );
  check("backup excludes password hashes", !JSON.stringify(backup.users?.[0] ?? {}).includes("password_hash"));

  // anonymous export blocked
  const anon = await fetch(`${BASE}/api/admin/export/xlsx`);
  check("anonymous export blocked (401)", anon.status === 401);

  // ---------- Scenario L: certificates ----------
  console.log("\n[L] Certificates");
  r = await api(admin, "POST", "/api/admin/certificates", { action: "generate" });
  check("certificate generation runs", r.status === 200);

  // ---------- Announcements & audit ----------
  console.log("\n[X] Extras");
  r = await api(admin, "POST", "/api/admin/announcements", { title: "Ship It is LIVE.", priority: "critical" });
  check("announcement published", r.status === 200);
  const pub = await fetch(`${BASE}/api/announcements`).then((x) => x.json());
  check("public announcements feed serves it", pub.announcements.some((a) => a.title.includes("LIVE")));

  r = await api(admin, "GET", "/api/admin/audit?limit=50");
  const actions = new Set(r.data.logs.map((l) => l.action));
  check(
    "audit trail captures the day's actions",
    actions.has("check_in") && actions.has("mission_verified") && actions.has("token_generated"),
  );

  // CSRF: cross-origin mutation blocked
  const csrf = await fetch(`${BASE}/api/missions/M1/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({}),
  });
  check("cross-origin mutation blocked (403)", csrf.status === 403);

  console.log(failures === 0 ? "\nALL E2E CHECKS PASSED ✓" : `\n${failures} E2E CHECKS FAILED ✗`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
