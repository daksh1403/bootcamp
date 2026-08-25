import { requireUser, fail } from "@/lib/api-helpers";
import { buildWorkbook, buildExportBundle } from "@/lib/excel";
import { computeLeaderboard } from "@/lib/leaderboard";
import { getLeaderboardCached } from "@/lib/services/leaderboard-service";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
}

export async function GET(req: Request, ctx: { params: Promise<{ format: string }> }) {
  const auth = await requireUser(["organizer", "super_admin"]);
  if ("response" in auth) return auth.response;

  const { format } = await ctx.params;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  if (format === "xlsx") {
    const bundle = await buildExportBundle(computeLeaderboard(await getLeaderboardCached(0)));
    const buffer = await buildWorkbook(bundle);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="codeygen-bootcamp-master-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "json") {
    const db = (await import("@/lib/db")).getDb();
    const tables = [
      "users", "participants", "teams", "team_members", "mission_progress", "verification_events",
      "challenge_attempts", "announcements", "certificates", "awards", "audit_logs",
      "event_settings", "quiz_questions", "quiz_results",
    ];
    const backup: Record<string, unknown> = {
      meta: {
        event: "Docker x Jenkins Bootcamp — Code{Y}Gen VITC",
        exportedAt: new Date().toISOString(),
        exportedBy: auth.user.email,
        schemaVersion: 1,
      },
    };
    for (const t of tables) {
      // Never export password hashes or raw session tokens.
      if (t === "users") {
        backup[t] = await db.prepare(`SELECT id, email, role, name, created_at, last_login_at FROM users`).all();
      } else if (t === "sessions") {
        continue;
      } else {
        backup[t] = await db.prepare(`SELECT * FROM ${t}`).all();
      }
    }
    backup.leaderboard = computeLeaderboard(await getLeaderboardCached(0));
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="codeygen-bootcamp-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "csv") {
    const bundle = await buildExportBundle(computeLeaderboard(await getLeaderboardCached(0)));
    const parts: string[] = [];
    parts.push("# PARTICIPANTS");
    parts.push(
      toCsv(
        bundle.participants.map((p) => ({ ...p, team: p.team_code })),
        ["code", "team", "name", "reg_no", "email", "phone", "branch", "year", "ram", "os", "docker_installed", "github_username", "status"]
      )
    );
    parts.push("\n# MISSIONS");
    parts.push(
      toCsv(bundle.teams, [
        "code", "m1Status", "m1Time", "m2Status", "m2Time", "m3Status", "m3Time", "m4Status", "m4Time", "verifiedBy",
      ])
    );
    parts.push("\n# SHIPIT");
    parts.push(toCsv(bundle.teams, ["code", "challengeStart", "attemptCount", "tokenStatus", "deploymentTime"]));
    parts.push("\n# LEADERBOARD");
    parts.push(toCsv(bundle.leaderboard as unknown as Record<string, unknown>[], ["rank", "teamCode", "missionsCompleted", "deploymentTime", "finalStatus", "award"]));
    return new Response(parts.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="codeygen-bootcamp-results-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return fail("Unknown format — use xlsx | csv | json", 404);
}
