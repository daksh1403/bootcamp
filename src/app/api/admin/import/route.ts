import { ok, fail, requireUser, withCsrf } from "@/lib/api-helpers";
import { parseParticipantsWorkbook } from "@/lib/excel";
import { getDb, now } from "@/lib/db";
import { participantCode } from "@/lib/ids";
import { audit } from "@/lib/audit";

/**
 * Import a Participants sheet (the same format the exporter produces) to
 * bulk-create or update registrations. Matching is by Registration Number,
 * falling back to Email. Imported participants start as `pending`.
 */
export const POST = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Attach an .xlsx file in the 'file' field");

  let rows: Record<string, string>[];
  try {
    rows = await parseParticipantsWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not parse workbook");
  }

  const db = getDb();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    const regNo = (row["Registration Number"] ?? row["reg_no"] ?? "").toUpperCase();
    const email = (row["Email"] ?? "").toLowerCase();
    const name = row["Name"] ?? "";
    if (!regNo || !email || !name) {
      errors.push(`Row ${i + 2}: missing Name / Registration Number / Email`);
      continue;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`Row ${i + 2}: invalid email ${email}`);
      continue;
    }
    const t = now();
    const existing = (await db.prepare(`SELECT id FROM participants WHERE reg_no=? OR email=?`).get(regNo, email)) as { id: number } | undefined;
    if (existing) {
      (await db.prepare(
        `UPDATE participants SET name=?, phone=COALESCE(NULLIF(?,''), phone), branch=?, year=?, ram=?, os=?, github_username=NULLIF(?,''), updated_at=? WHERE id=?`
      ).run(name, row["Phone"] ?? "", row["Branch"] ?? "OTHER", row["Year"] ?? "1", row["RAM"] ?? "8GB", row["OS"] ?? "Windows 11", row["GitHub"] ?? "", t, existing.id));
      updated++;
    } else {
      (await db.prepare(
        `INSERT INTO participants (code, name, reg_no, email, phone, branch, year, ram, os, docker_installed, github_username, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(participantCode(), name, regNo, email, row["Phone"] ?? "", row["Branch"] ?? "OTHER", row["Year"] ?? "1", row["RAM"] ?? "8GB", row["OS"] ?? "Windows 11",
        (row["Docker Installed"] ?? "NO").toLowerCase().startsWith("y") ? "yes" : "no", row["GitHub"] ?? "", "pending", t, t));
      created++;
    }
  }
  await audit({ actorLabel: auth.user.email, action: "import_participants", newValue: { created, updated, errors } });
  return ok({ created, updated, errors });
});
