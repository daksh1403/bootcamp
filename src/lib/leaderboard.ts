
export interface LeaderboardEntry {
  rank: number | null;
  teamCode: string;
  teamName: string;
  members: string[];
  missionsCompleted: number;
  deploymentTime: number | null;
  lastActivityAt: number | null;
  finalStatus: "DEPLOYED" | "IN PROGRESS" | "PENDING";
  award: string | null;
}

export interface LeaderboardInputTeam {
  code: string;
  name: string | null;
  members: string[];
  m1VerifiedAt: number | null;
  m2VerifiedAt: number | null;
  m3VerifiedAt: number | null;
  m4VerifiedAt: number | null;
  deploymentTime: number | null;
  overrideRank: number | null;
  award: string | null;
}

/**
 * Pure ranking logic per event plan:
 *   1. Verified deployment time first (earliest wins).
 *   2. Missions completed second.
 * Organizer overrides pin teams at fixed ranks with absolute authority.
 */
export function computeLeaderboard(teams: LeaderboardInputTeam[]): LeaderboardEntry[] {
  const entries: (LeaderboardEntry & { overrideRank: number | null; sortKey: [number, number] })[] = teams.map((t) => {
    const verifiedTimes = [t.m1VerifiedAt, t.m2VerifiedAt, t.m3VerifiedAt].filter((x): x is number => x !== null);
    const missionsCompleted =
      (t.m1VerifiedAt ? 1 : 0) + (t.m2VerifiedAt ? 1 : 0) + (t.m3VerifiedAt ? 1 : 0) + (t.m4VerifiedAt ? 1 : 0);
    const lastActivityAt = Math.max(0, ...verifiedTimes, t.deploymentTime ?? 0) || null;
    return {
      rank: null,
      teamCode: t.code,
      teamName: t.name ?? "",
      members: t.members,
      missionsCompleted,
      deploymentTime: t.deploymentTime,
      lastActivityAt,
      finalStatus: t.m4VerifiedAt ? "DEPLOYED" : missionsCompleted > 0 ? "IN PROGRESS" : "PENDING",
      award: t.award,
      overrideRank: t.overrideRank,
      sortKey: [t.deploymentTime ?? Number.MAX_SAFE_INTEGER, -missionsCompleted],
    };
  });

  const overridden = entries.filter((e) => e.overrideRank !== null);
  const rest = entries.filter((e) => e.overrideRank === null);

  // Non-overridden: deployed teams by time asc, then others by missions desc, earliest activity asc.
  const deployed = rest.filter((e) => e.deploymentTime !== null).sort((a, b) => a.deploymentTime! - b.deploymentTime!);
  const notDeployed = rest
    .filter((e) => e.deploymentTime === null)
    .sort((a, b) => b.missionsCompleted - a.missionsCompleted || (a.lastActivityAt ?? Infinity) - (b.lastActivityAt ?? Infinity) || a.teamCode.localeCompare(b.teamCode));

  const ordered = [...deployed, ...notDeployed];
  // Assign ranks, skipping numbers taken by overrides.
  const takenRanks = new Set(overridden.map((e) => e.overrideRank as number));
  let nextRank = 1;
  for (const e of ordered) {
    while (takenRanks.has(nextRank)) nextRank++;
    e.rank = nextRank;
    nextRank++;
  }
  for (const e of overridden) e.rank = e.overrideRank;

  const all = [...overridden, ...ordered];
  all.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  return all.map((e) => ({ rank: e.rank, teamCode: e.teamCode, teamName: e.teamName, members: e.members, missionsCompleted: e.missionsCompleted, deploymentTime: e.deploymentTime, lastActivityAt: e.lastActivityAt, finalStatus: e.finalStatus, award: e.award }));
}
