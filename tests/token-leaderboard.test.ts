process.env.DATABASE_PATH = process.env.TEST_DB_PATH!;

import { describe, it, expect, beforeAll } from "vitest";
import { computeLeaderboard, type LeaderboardInputTeam } from "@/lib/leaderboard";
import { sha256 } from "@/lib/ids";

const { getDb } = await import("@/lib/db");
const { registerParticipant, setParticipantStatus } = await import("@/lib/services/participants");
const { createTeam, addMember, generateToken, startChallenge } = await import("@/lib/services/teams");
const { submitDeploymentToken, verifyMission } = await import("@/lib/services/missions-service");

async function makeTeam() {
  const p1 = await registerParticipant({
    name: "Ship Tester", regNo: `26BME${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    email: `${Math.random().toString(36).slice(2, 8)}@vitstudent.ac.in`, phone: "9876511111",
    branch: "MECH", year: "4", ram: "16GB+", os: "Linux", dockerInstalled: "yes", githubUsername: "", password: "password123",
  });
  await setParticipantStatus(p1.id, "checked_in", { actorLabel: "test", auditFn: () => {} });
  const team = await createTeam();
  await addMember(team.id, p1.id);
  return team;
}

beforeAll(() => getDb());

describe("deployment token verification (M4)", () => {
  it("rejects submissions before the challenge starts", async () => {
    const team = await makeTeam();
    const token = await generateToken(team.id, "mentor");
    const res = await submitDeploymentToken({ teamId: team.id, token, url: "http://x", ip: "t", actorLabel: "p" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not started/i);
  });

  it("accepts the correct token and stamps deployment time; wrong tokens rejected + logged", async () => {
    const team = await makeTeam();
    const token = await generateToken(team.id, "mentor");
    await startChallenge(team.id, "mentor", () => {});

    const bad = await submitDeploymentToken({ teamId: team.id, token: "SHIP-WRNG-TOKN", url: "", ip: "t", actorLabel: "p" });
    expect(bad.ok).toBe(false);

    const good = await submitDeploymentToken({ teamId: team.id, token, url: "http://localhost:3000", ip: "t", actorLabel: "p" });
    expect(good.ok).toBe(true);
    expect(good.deploymentTime).toBeGreaterThan(0);
    // autoVerifyM4 default true → mission flips to verified
    const row = (await getDb().prepare(`SELECT status FROM mission_progress WHERE team_id=? AND mission_code='M4'`).get(team.id)) as any;
    expect(row.status).toBe("verified");

    const attempts = (await getDb().prepare(`SELECT result FROM challenge_attempts WHERE team_id=?`).all(team.id)) as any[];
    expect(attempts.map((a) => a.result)).toContain("fail");
    expect(attempts.map((a) => a.result)).toContain("success");
  });

  it("tokens are stored hashed — plaintext never persists", async () => {
    const team = await makeTeam();
    const token = await generateToken(team.id, "mentor");
    const stored = (await getDb().prepare(`SELECT token_hash FROM teams WHERE id=?`).get(team.id)) as any;
    expect(stored.token_hash).toBe(sha256(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("enforces max failed attempts lockout", async () => {
    process.env.AUTO_VERIFY = "0";
    const team = await makeTeam();
    await generateToken(team.id, "mentor");
    await startChallenge(team.id, "mentor", () => {});
    for (let i = 0; i < 5; i++) {
      await submitDeploymentToken({ teamId: team.id, token: `SHIP-XXXX-XXXX`, url: "", ip: "t", actorLabel: "p" });
    }
    const locked = await submitDeploymentToken({ teamId: team.id, token: "SHIP-ZZZZ-ZZZZ", url: "", ip: "t", actorLabel: "p" });
    expect(locked.ok).toBe(false);
    expect(locked.error).toMatch(/too many/i);
  });

  it("with autoVerify disabled, correct token parks at submitted for organizer review", async () => {
    const { getSettings, setSetting } = await import("@/lib/settings");
    const prev = (await getSettings()).autoVerifyM4;
    await setSetting("autoVerifyM4", false);
    try {
      const team = await makeTeam();
      const token = await generateToken(team.id, "mentor");
      await startChallenge(team.id, "mentor", () => {});
      const res = await submitDeploymentToken({ teamId: team.id, token, url: "", ip: "t", actorLabel: "p" });
      expect(res.ok).toBe(true);
      const row = (await getDb().prepare(`SELECT status FROM mission_progress WHERE team_id=? AND mission_code='M4'`).get(team.id)) as any;
      expect(row.status).toBe("submitted");
      // organizer verify completes it
      await verifyMission({ teamId: team.id, code: "M4", verifierLabel: "mentor" });
      const done = (await getDb().prepare(`SELECT status FROM mission_progress WHERE team_id=? AND mission_code='M4'`).get(team.id)) as any;
      expect(done.status).toBe("verified");
    } finally {
      await setSetting("autoVerifyM4", prev);
    }
  });
});

describe("leaderboard ranking rules", () => {
  const t = (over: Partial<LeaderboardInputTeam>): LeaderboardInputTeam => ({
    code: "T", name: null, members: [], m1VerifiedAt: null, m2VerifiedAt: null, m3VerifiedAt: null,
    m4VerifiedAt: null, deploymentTime: null, overrideRank: null, award: null,
    ...over,
  });

  it("ranks by verified deployment time first", () => {
    const rows = computeLeaderboard([
      t({ code: "SLOW", m1VerifiedAt: 1, m2VerifiedAt: 2, m3VerifiedAt: 3, deploymentTime: 500, m4VerifiedAt: 500 }),
      t({ code: "FAST", m1VerifiedAt: 10, m2VerifiedAt: 20, m3VerifiedAt: 30, deploymentTime: 100, m4VerifiedAt: 100 }),
    ]);
    expect(rows[0].teamCode).toBe("FAST");
    expect(rows[1].teamCode).toBe("SLOW");
  });

  it("non-deployed teams rank below deployed ones by missions completed", () => {
    const rows = computeLeaderboard([
      t({ code: "ZERO" }),
      t({ code: "THREE", m1VerifiedAt: 1, m2VerifiedAt: 2, m3VerifiedAt: 3 }),
      t({ code: "DEPLOYED", m1VerifiedAt: 5, m2VerifiedAt: 6, m3VerifiedAt: 7, deploymentTime: 999 }),
    ]);
    expect(rows.map((r) => r.teamCode)).toEqual(["DEPLOYED", "THREE", "ZERO"]);
  });

  it("organizer override pins a rank with absolute authority", () => {
    const rows = computeLeaderboard([
      t({ code: "A", deploymentTime: 10, m4VerifiedAt: 10 }),
      t({ code: "B", deploymentTime: 20, m4VerifiedAt: 20 }),
      t({ code: "C", deploymentTime: 30, m4VerifiedAt: 30, overrideRank: 1, award: "fastest_deployer" }),
    ]);
    expect(rows.find((r) => r.teamCode === "C")!.rank).toBe(1);
    expect(rows.find((r) => r.teamCode === "A")!.rank).toBe(2);
    expect(rows.find((r) => r.teamCode === "B")!.rank).toBe(3);
  });
});
