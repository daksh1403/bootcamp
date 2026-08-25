process.env.DATABASE_PATH = process.env.TEST_DB_PATH!;

import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import { computeLeaderboard } from "@/lib/leaderboard";

const { buildWorkbook, buildExportBundle, parseParticipantsWorkbook } = await import("@/lib/excel");
const { getLeaderboardInput } = await import("@/lib/services/leaderboard-service");

beforeAll(async () => {
  const { getDb } = await import("@/lib/db");
  getDb();
});

describe("excel export", () => {
  it("produces a workbook with the five official sheets and exact headers", async () => {
    const bundle = await buildExportBundle(computeLeaderboard(await getLeaderboardInput()));
    const buf = await buildWorkbook(bundle);
    expect(buf.length).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);

    expect(wb.worksheets.map((w) => w.name)).toEqual(["Participants", "Missions", "Ship It", "Leaderboard", "Certificates"]);

    const participants = wb.getWorksheet("Participants")!;
    expect(participants.getRow(1).getCell(1).value).toBe("Participant ID");
    expect(participants.getRow(1).getCell(2).value).toBe("Team ID");
    expect(participants.getRow(1).getCell(14).value).toBe("Check-in Status");

    const missions = wb.getWorksheet("Missions")!;
    expect(missions.getRow(1).getCell(10).value).toBe("Verified By");

    const shipIt = wb.getWorksheet("Ship It")!;
    const shipHeaders = ["Team ID", "Challenge Start", "Attempt Count", "Token Status", "Deployment Time", "Verification Status", "Verified By"];
    shipHeaders.forEach((h, i) => expect(shipIt.getRow(1).getCell(i + 1).value).toBe(h));

    const leaderboard = wb.getWorksheet("Leaderboard")!;
    ["Rank", "Team ID", "Team Name", "Missions Completed", "Deployment Time", "Final Status", "Award"].forEach(
      (h, i) => expect(leaderboard.getRow(1).getCell(i + 1).value).toBe(h)
    );

    const certs = wb.getWorksheet("Certificates")!;
    expect(certs.getRow(1).getCell(5).value).toBe("Certificate ID");
  });

  it("round-trips: exported workbook re-imports as participant rows", async () => {
    const bundle = await buildExportBundle(computeLeaderboard(await getLeaderboardInput()));
    const buf = await buildWorkbook(bundle);
    const rows = await parseParticipantsWorkbook(buf);
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty("Registration Number");
      expect(rows[0]).toHaveProperty("Email");
    }
  });

  it("rejects workbooks without a Participants sheet", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Random");
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(parseParticipantsWorkbook(buf)).rejects.toThrow(/Participants/);
  });
});
