const { execSync } = require("child_process");
const fs = require("fs");
const fns = ["listParticipants","setParticipantStatus","getParticipantById","getParticipantByUserId","findParticipantByEmail","findParticipantByRegNo","detectDuplicate","registerParticipant","createTeam","autoAssignTeams","addMember","moveMember","removeMember","mergeTeams","listTeams","getTeamById","getTeamByParticipantId","generateToken","startChallenge","ensureProgressRows","getProgress","getAllProgress","submitMission","verifyMission","rejectMission","submitDeploymentToken","getSettings","setSetting","getEventStats","getLeaderboardInput","getLeaderboardCached","listAnnouncements","createAnnouncement","setAnnouncementActive","generateCertificates","listCertificates","getAwardSuggestions","assignAward","removeAward","audit","ensureSuperAdmin","ensureOrganizer","buildExportBundle","buildWorkbook","logEvent","recomputeUnlocks"];
const files = execSync(`grep -rl "getDb\\|@/lib/services\\|@/lib/audit\\|@/lib/settings\\|@/lib/excel" src scripts --include="*.ts" --include="*.tsx"`, { encoding: "utf8" }).trim().split("\n");
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    for (const fn of fns) {
      const needle = fn + "(";
      let idx = line.indexOf(needle);
      while (idx !== -1) {
        const before = line.slice(0, idx);
        const wordBefore = before.slice(before.lastIndexOf(fn) - 1, before.lastIndexOf(fn));
        if (/function\s/.test(before.slice(-10)) || /import/.test(before) || /export\s+async\s+function|export\s+function/.test(before) || /async\s+function\s+\w+$/.test(before)) break;
        if (/\bawait\s*$/.test(before)) break;
        if (/return\s+(await\s+)?$/.test(before)) break;
        if (/=>\s*$/.test(before) && !/\bawait\b/.test(before) && needle === "audit(") break;
        const after = line.slice(idx + needle.length);
        const looksLikeCallSite = !/^\s*$/.test(after) || /;\s*$/.test(line);
        if (looksLikeCallSite) {
          const firstWord = trimmed.split(/[\s(]/)[0];
          const statementStartsClean = ["await","return","const","let","var","if","for","while","throw","void","yield","new"].includes(firstWord) || firstWord.endsWith(".") || firstWord.startsWith("(");
          const hasAwait = /\bawait\b/.test(line);
          if (!hasAwait) {
            console.log(`${f}:${i + 1}: ${trimmed.slice(0, 140)}`);
            bad++;
          }
        }
        idx = line.indexOf(needle, idx + 1);
      }
    }
  });
}
console.log("---", bad, "lines calling async fns without await");
