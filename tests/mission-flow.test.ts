process.env.DATABASE_PATH = process.env.TEST_DB_PATH!;

import { describe, it, expect, beforeAll } from "vitest";

const { getDb } = await import("@/lib/db");
const { registerParticipant, setParticipantStatus } = await import("@/lib/services/participants");
const { createTeam, addMember } = await import("@/lib/services/teams");
const {
  getAllProgress,
  submitMission,
  verifyMission,
  rejectMission,
} = await import("@/lib/services/missions-service");
const { MISSIONS } = await import("@/lib/missions");

async function makeTeam() {
  const p1 = await registerParticipant({ ...baseInput() });
  const p2 = await registerParticipant({ ...baseInput() });
  await setParticipantStatus(p1.id, "checked_in", { actorLabel: "test", auditFn: () => {} });
  await setParticipantStatus(p2.id, "checked_in", { actorLabel: "test", auditFn: () => {} });
  const team = await createTeam();
  await addMember(team.id, p1.id);
  await addMember(team.id, p2.id);
  return { team };
}

function baseInput() {
  const uniq = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    name: "Mission Tester",
    regNo: `26BIT${uniq}`,
    email: `${uniq.toLowerCase()}@vitstudent.ac.in`,
    phone: "9876500000",
    branch: "IT" as const,
    year: "3" as const,
    ram: "8GB" as const,
    os: "macOS" as const,
    dockerInstalled: "yes" as const,
    githubUsername: "tester",
    password: "password123",
  };
}

beforeAll(() => getDb());

describe("mission progression state machine", () => {
  it("starts with M1 available and everything else locked", async () => {
    const { team } = await makeTeam();
    const progress = await getAllProgress(team.id);
    expect(progress[0].status).toBe("available");
    expect(progress.map((p) => p.status)).toEqual(["available", "locked", "locked", "locked"]);
  });

  it("refuses submission when team is not checked in", async () => {
    const p = await registerParticipant(baseInput()); // pending
    const team = await createTeam();
    await addMember(team.id, p.id);
    const res = await submitMission({
      teamId: team.id,
      code: "M1",
      payload: { imageTag: "x/app:v1", notes: "test" },
      actorLabel: "test",
      checkedIn: false,
    });
    expect(res.ok).toBe(false);
  });

  it("M1 submit → submitted; participant can NEVER self-verify", async () => {
    const { team } = await makeTeam();
    const res = await submitMission({
      teamId: team.id,
      code: "M1",
      payload: Object.fromEntries(MISSIONS.M1.submissionFields.filter((f) => f.required).map((f) => [f.key, "value"])),
      actorLabel: "participant",
      checkedIn: true,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("submitted");
    const progress = await getAllProgress(team.id);
    // the critical security invariant:
    expect(progress.find((p) => p.mission_code === "M1")!.status).toBe("submitted");
    expect(progress.find((p) => p.mission_code === "M1")!.verified_at).toBeNull();
  });

  it("organizer verification unlocks M2; M2 stays locked until then", async () => {
    const { team } = await makeTeam();
    await submitMission({ teamId: team.id, code: "M1", payload: { a: "b" }, actorLabel: "p", checkedIn: true });
    let progress = await getAllProgress(team.id);
    expect(progress.find((p) => p.mission_code === "M2")!.status).toBe("locked");

    await verifyMission({ teamId: team.id, code: "M1", verifierLabel: "mentor@crew" });
    progress = await getAllProgress(team.id);
    expect(progress.find((p) => p.mission_code === "M1")!.status).toBe("verified");
    expect(progress.find((p) => p.mission_code === "M1")!.verified_by).toBe("mentor@crew");
    expect(progress.find((p) => p.mission_code === "M2")!.status).toBe("available");
    expect(progress.find((p) => p.mission_code === "M4")!.status).toBe("locked");
  });

  it("reject sends the mission back to failed with note and allows resubmit", async () => {
    const { team } = await makeTeam();
    await submitMission({ teamId: team.id, code: "M1", payload: { a: "b" }, actorLabel: "p", checkedIn: true });
    await rejectMission({ teamId: team.id, code: "M1", verifierLabel: "mentor", note: "container not running" });
    const progress = await getAllProgress(team.id);
    expect(progress.find((p) => p.mission_code === "M1")!.status).toBe("failed");
    // resubmit works from failed state
    const res = await submitMission({ teamId: team.id, code: "M1", payload: { a: "c" }, actorLabel: "p", checkedIn: true });
    expect(res.ok).toBe(true);
  });

  it("cannot verify a locked mission", async () => {
    const { team } = await makeTeam();
    const res = await verifyMission({ teamId: team.id, code: "M3", verifierLabel: "cheater" });
    expect(res.ok).toBe(false);
  });

  it("full chain M1→M4 unlock sequence", async () => {
    const { team } = await makeTeam();
    for (const code of ["M1", "M2", "M3"] as const) {
      await submitMission({ teamId: team.id, code, payload: { evidence: "x" }, actorLabel: "p", checkedIn: true });
      await verifyMission({ teamId: team.id, code, verifierLabel: "mentor" });
    }
    const progress = await getAllProgress(team.id);
    expect(progress.find((p) => p.mission_code === "M4")!.status).toBe("available");
  });
});
