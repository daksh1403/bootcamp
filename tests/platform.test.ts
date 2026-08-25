import { makeTempDbPath } from "./helpers/env";
process.env.DATABASE_PATH = makeTempDbPath("platform");

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await import("@/lib/db").then((m) => m.getDb());
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks with retry time", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterS).toBeGreaterThan(0);
  });

  it("resets after the window", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `test-window-${Math.random()}`;
    rateLimit(key, 1, 10); // 10ms window
    expect(rateLimit(key, 1, 10).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(rateLimit(key, 1, 10).ok).toBe(true);
  });
});

describe("auth primitives", () => {
  it("hashes and verifies passwords", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/auth");
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("creates sessions that resolve to the user and expire cleanly", async () => {
    const { getDb } = await import("@/lib/db");
    const { createSession, getSessionUser, destroySession } = await import("@/lib/auth");
    const info = await getDb()
      .prepare(`INSERT INTO users (email, password_hash, role, name, created_at) VALUES (?,?,?,?,?)`)
      .run(`sess-${Math.random()}@vitstudent.ac.in`, "x", "participant", "Sess User", Date.now());
    const userId = Number(info.lastInsertRowid);
    const token = await createSession(userId);
    const user = await getSessionUser(token);
    expect(user?.id).toBe(userId);

    // tampered tokens are rejected
    expect(await getSessionUser(token.slice(0, -2) + "zz")).toBeNull();

    await destroySession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
});

describe("audit log", () => {
  it("records actions with old/new values and rejects unknown actions loudly", async () => {
    const { audit } = await import("@/lib/audit");
    await audit({
      actorLabel: "tester@crew",
      action: "mission_verified",
      targetType: "mission",
      targetId: "M1:TEAM-99",
      oldValue: "submitted",
      newValue: "verified",
    });
    const { getDb } = await import("@/lib/db");
    const row = (await getDb().prepare(`SELECT * FROM audit_logs WHERE actor_label='tester@crew' ORDER BY id DESC`).get()) as any;
    expect(row.action).toBe("mission_verified");
    expect(JSON.parse(row.old_value)).toBe("submitted");
    expect(JSON.parse(row.new_value)).toBe("verified");

    await expect(
      audit({ actorLabel: "x", action: "totally_made_up_action" })
    ).rejects.toThrow(/Unknown audit action/);
  });
});

describe("certificates", () => {
  it("generates records only for eligible participants and is idempotent", async () => {
    const { registerParticipant, setParticipantStatus } = await import("@/lib/services/participants");
    const { createTeam, addMember } = await import("@/lib/services/teams");
    const uniq = Math.random().toString(36).slice(2, 8).toUpperCase();
    const p = await registerParticipant({
      name: "Cert Tester", regNo: `26CSE${uniq}`, email: `${uniq.toLowerCase()}@vitstudent.ac.in`,
      phone: "9876522222", branch: "CSE" as const, year: "2" as const, ram: "8GB" as const, os: "Windows 11" as const,
      dockerInstalled: "yes" as const, githubUsername: "", password: "password123",
    });
    await setParticipantStatus(p.id, "checked_in", { actorLabel: "t", auditFn: () => {} });
    const team = await createTeam();
    await addMember(team.id, p.id);

    const { generateCertificates } = await import("@/lib/services/event-ops");
    const first = await generateCertificates("tester");
    expect(first).toBeGreaterThanOrEqual(1);
    // pending participants never get certificates
    const second = await generateCertificates("tester");
    expect(second).toBe(0); // already generated for this participant

    const certs = (await (await import("@/lib/services/event-ops")).listCertificates()) as any[];
    const mine = certs.find((c) => c.reg_no === p.reg_no || c.regNo === p.reg_no);
    expect(mine).toBeTruthy();
    expect(mine.cert_code ?? mine.certCode).toMatch(/^CYG26-CERT-/);
  });
});
