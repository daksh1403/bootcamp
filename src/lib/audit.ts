import { getDb, now } from "./db";

export interface AuditEntry {
  actorUserId?: number | null;
  actorLabel: string;
  action: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  note?: string;
  ip?: string;
}

const ALLOWED_ACTIONS = new Set([
  "participant_approved",
  "participant_rejected",
  "participant_updated",
  "participant_deleted",
  "check_in",
  "check_in_undo",
  "mission_verified",
  "mission_rejected",
  "retry_requested",
  "token_generated",
  "token_verified",
  "token_fail_recorded",
  "challenge_started",
  "team_created",
  "team_changed",
  "team_merged",
  "team_token_regenerated",
  "leaderboard_override",
  "award_assigned",
  "award_removed",
  "certificate_assigned",
  "certificate_revoked",
  "admin_login",
  "settings_changed",
  "progress_reset",
  "organizer_created",
  "organizer_removed",
  "announcement_published",
  "announcement_removed",
  "import_participants",
]);

export async function audit(entry: AuditEntry): Promise<void> {
  if (!ALLOWED_ACTIONS.has(entry.action)) {
    // Fail loud in dev; never silently drop an unknown audit action.
    throw new Error(`Unknown audit action: ${entry.action}`);
  }
  const db = getDb();
  await db.prepare(
    `INSERT INTO audit_logs (actor_user_id, actor_label, action, target_type, target_id, old_value, new_value, ip, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    entry.actorUserId ?? null,
    entry.actorLabel,
    entry.action,
    entry.targetType ?? null,
    entry.targetId ?? null,
    entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue),
    entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
    entry.ip ?? null,
    now()
  );
}

