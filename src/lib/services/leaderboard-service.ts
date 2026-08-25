import { getDb, now } from "../db";
import type { LeaderboardInputTeam } from "../leaderboard";

export interface FullLeaderboardTeam extends LeaderboardInputTeam {
  id: number;
  tokenIssued: boolean;
  challengeStarted: boolean;
}

export async function getLeaderboardInput(): Promise<FullLeaderboardTeam[]> {
  const db = getDb();
  const teams = (await db.prepare(`SELECT * FROM teams ORDER BY code`).all()) as {
    id: number;
    code: string;
    name: string | null;
    deployment_time: number | null;
    m4_verified_at: number | null;
    award: string | null;
    leaderboard_override: number | null;
    token_hash: string | null;
    challenge_started_at: number | null;
  }[];
  const progress = (await db.prepare(`SELECT team_id, mission_code, verified_at FROM mission_progress WHERE verified_at IS NOT NULL`).all()) as {
    team_id: number;
    mission_code: string;
    verified_at: number;
  }[];
  const membersMap = new Map<number, string[]>();
  const memberRows = (await db
  .prepare(
      `SELECT tm.team_id, p.name FROM team_members tm JOIN participants p ON p.id = tm.participant_id ORDER BY p.name`
    )
    .all()) as { team_id: number; name: string }[];
  for (const m of memberRows) {
    if (!membersMap.has(m.team_id)) membersMap.set(m.team_id, []);
    membersMap.get(m.team_id)!.push(m.name);
  }
  const byTeam = new Map<number, Map<string, number>>();
  for (const p of progress) {
    if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, new Map());
    byTeam.get(p.team_id)!.set(p.mission_code, p.verified_at);
  }

  return teams.map((t) => {
    const pv = byTeam.get(t.id);
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      members: membersMap.get(t.id) ?? [],
      m1VerifiedAt: pv?.get("M1") ?? null,
      m2VerifiedAt: pv?.get("M2") ?? null,
      m3VerifiedAt: pv?.get("M3") ?? null,
      m4VerifiedAt: t.m4_verified_at,
      deploymentTime: t.deployment_time,
      overrideRank: t.leaderboard_override,
      award: t.award,
      tokenIssued: !!t.token_hash,
      challengeStarted: !!t.challenge_started_at,
    };
  });
}

// Simple TTL cache so 50 dashboards polling don't recompute constantly.
let cache: { data: FullLeaderboardTeam[]; at: number } | null = null;

async function computeCached() {
  return getLeaderboardInput();
}

export async function getLeaderboardCached(maxAgeMs = 3000): Promise<FullLeaderboardTeam[]> {
  const t = now();
  if (!cache || t - cache.at > maxAgeMs) {
    cache = { data: await computeCached(), at: t };
  }
  return cache!.data;
}

export function invalidateLeaderboardCache(): void {
  cache = null;
}
