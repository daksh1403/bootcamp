import { makeTempDbPath } from "./helpers/env";
process.env.DATABASE_PATH = makeTempDbPath("registration");

import { describe, it, expect, beforeAll } from "vitest";
import type { RegistrationInput } from "@/lib/validation";

const { getDb } = await import("@/lib/db");
const { registerParticipant, detectDuplicate, listParticipants, setParticipantStatus } = await import("@/lib/services/participants");
const { autoAssignTeams } = await import("@/lib/services/teams");

function validInput(over: Partial<RegistrationInput> = {}): RegistrationInput {
  const uniq = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    name: "Test Student",
    regNo: `26BCE${uniq}`,
    email: `${uniq.toLowerCase()}@vitstudent.ac.in`,
    phone: "9876543210",
    branch: "CSE",
    year: "2",
    ram: "8GB",
    os: "Windows 11",
    dockerInstalled: "no",
    githubUsername: "octocat",
    password: "supersecret1",
    ...over,
  };
}

beforeAll(() => {
  getDb(); // force schema creation
});

describe("registration", () => {
  it("registers a participant with a unique participant ID and pending status", async () => {
    const input = validInput();
    const p = await registerParticipant(input);
    expect(p.code).toMatch(/^CYG26-P-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/);
    expect(p.status).toBe("pending");
    expect(p.reg_no).toBe(input.regNo);
  });

  it("detects duplicate email", async () => {
    const p = await registerParticipant(validInput());
    const dup = await detectDuplicate(p.email, "SOMETHINGELSE1");
    expect(dup).toContain("email");
  });

  it("detects duplicate registration number", async () => {
    const p = await registerParticipant(validInput());
    const dup = await detectDuplicate(`other-${Math.random()}@vitstudent.ac.in`, p.reg_no);
    expect(dup).toContain("registration number");
  });

  it("passes for distinct email + reg no", async () => {
    const a = await registerParticipant(validInput());
    expect(await detectDuplicate(`x-${a.email}`, `X${a.reg_no}`)).toBeNull();
  });

  it("rejects non-VIT emails at validation layer", async () => {
    const { registrationSchema } = await import("@/lib/validation");
    const r = registrationSchema.safeParse({ ...validInput(), email: "hacker@gmail.com" });
    expect(r.success).toBe(false);
  });

  it("rejects short passwords", async () => {
    const { registrationSchema } = await import("@/lib/validation");
    const r = registrationSchema.safeParse({ ...validInput(), password: "short" });
    expect(r.success).toBe(false);
  });
});

describe("teams", () => {
  it("creates teams with sequential codes and initializes progress rows", async () => {
    const team = await import("@/lib/services/teams").then((m) => m.createTeam());
    expect(team.code).toMatch(/^TEAM-\d{2}$/);
    const rows = (await getDb().prepare(`SELECT * FROM mission_progress WHERE team_id=?`).all(team.id)) as any[];
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.mission_code === "M1")?.status).toBe("available");
    expect(rows.find((r) => r.mission_code === "M4")?.status).toBe("locked");
  });

  it("blocks adding a member who already has a team", async () => {
    const teams = await import("@/lib/services/teams");
    const p1 = await registerParticipant(validInput());
    const p2 = await registerParticipant(validInput());
    const t1 = await teams.createTeam();
    const t2 = await teams.createTeam();
    await teams.addMember(t1.id, p1.id);
    await expect(teams.addMember(t2.id, p1.id)).rejects.toThrow(/another team/);
    void p2;
  });

  it("auto-assign pairs unassigned participants into teams of two (odd one solo)", async () => {
    // three fresh unassigned approved participants
    const ps: { id: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await registerParticipant(validInput());
      await setParticipantStatus(p.id, "approved", { actorLabel: "test", auditFn: () => {} });
      ps.push(p);
    }
    const before = (await listParticipants({})).length;
    const created = await autoAssignTeams("test", () => {});
    const after = await listParticipants({});
    expect(created.length).toBeGreaterThanOrEqual(1);
    // all previously-unassigned now have teams
    const unassignedLeft = after.filter((p) => !p.team_code).filter((p) => ps.some((x) => x.id === p.id));
    expect(unassignedLeft).toHaveLength(0);
    void before;
  });
});
