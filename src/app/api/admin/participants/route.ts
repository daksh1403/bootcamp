import { ok, fail, requireUser, withCsrf, clientIp } from "@/lib/api-helpers";
import { listParticipants, setParticipantStatus, getParticipantById } from "@/lib/services/participants";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;
  const url = new URL(req.url);
  const rows = await listParticipants({
    status: url.searchParams.get("status") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    noTeam: url.searchParams.get("noTeam") === "1",
  });
  return ok({ participants: rows });
}

const ACTIONS = new Set(["approve", "reject", "check_in", "undo_check_in", "set_pending", "delete", "add_note"]);

export const PATCH = withCsrf(async (req: Request) => {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;

  let body: { id?: number; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Invalid body");
  }
  const id = Number(body.id);
  const action = String(body.action ?? "");
  if (!ACTIONS.has(action)) return fail("Unknown action");
  const p = await getParticipantById(id);
  if (!p) return fail("Participant not found", 404);

  if (action === "delete" && auth.user.role !== "super_admin") return fail("Super Admin only", 403);

  const ip = clientIp(req);
  const db = getDb();
  switch (action) {
    case "approve":
      await setParticipantStatus(id, "approved", { actorLabel: auth.user.email, ip, auditFn: audit });
      break;
    case "reject":
      await setParticipantStatus(id, "rejected", { actorLabel: auth.user.email, ip, auditFn: audit });
      break;
    case "set_pending":
      await setParticipantStatus(id, "pending", { actorLabel: auth.user.email, ip, auditFn: audit });
      break;
    case "check_in":
      if (p.status === "checked_in") return fail("Already checked in", 409);
      await setParticipantStatus(id, "checked_in", { actorLabel: auth.user.email, ip, auditFn: audit });
      break;
    case "undo_check_in":
      if (p.status !== "checked_in") return fail("Not checked in", 409);
      await setParticipantStatus(id, "approved", { actorLabel: auth.user.email, ip, auditFn: audit });
      break;
    case "add_note":
      (await db.prepare(`UPDATE participants SET notes=?, updated_at=? WHERE id=?`).run(String(body.note ?? "").slice(0, 500), Date.now(), id));
      break;
    case "delete": {
      const user = (await db.prepare(`SELECT user_id FROM participants WHERE id=?`).get(id)) as { user_id: number | null };
      (await db.prepare(`DELETE FROM participants WHERE id=?`).run(id));
      if (user.user_id) (await db.prepare(`DELETE FROM users WHERE id=? AND role='participant'`).run(user.user_id));
      await audit({ actorLabel: auth.user.email, action: "participant_deleted", targetId: p.code });
      break;
    }
  }
  const fresh = await getParticipantById(id);
  return ok({ participant: fresh ? { ...fresh } : null });
});
