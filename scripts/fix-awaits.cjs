const fs = require("fs");
const { execSync } = require("child_process");

// reuse the audit to get flagged lines
const out = execSync("node scripts/audit-awaits.cjs 2>&1", { encoding: "utf8" }).split("\n");
const flags = out.filter((l) => /:\d+: /.test(l)).map((l) => {
  const [file, lineNo] = l.split(":");
  return { file, lineNo: Number(lineNo), text: l.split(": ").slice(1).join(": ") };
});

const byFile = new Map();
for (const f of flags) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f.lineNo);
}

let fixed = 0;
for (const [file, lineNos] of byFile) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (const ln of lineNos) {
    const line = lines[ln - 1];
    if (!line || /\bawait\b/.test(line)) continue;
    // insert await before the first async-fn call on the line
    const m = line.match(/^(\s*)(?:for\s*\([^)]*\)\s*)?([A-Za-z_$][\w$]*)\(/);
    if (m && !["if", "while", "switch", "catch", "return", "const", "let", "var", "new", "function"].includes(m[2])) {
      const insertAt = line.indexOf(m[2] + "(", m[0].length - m[2].length - 1);
      lines[ln - 1] = line.slice(0, insertAt) + "await " + line.slice(insertAt);
      fixed++;
      continue;
    }
    // const x = FN( / return ok({ x: FN( / newValue: FN( / for(...) FN(
    const callRe = /([A-Za-z_$][\w$]*)\((?!.*\bawait\b)/;
    let done = false;
    lines[ln - 1] = line.replace(/([=:{(,]\s*|\)\s+)(listParticipants|setParticipantStatus|getParticipantById|getParticipantByUserId|findParticipantByEmail|findParticipantByRegNo|detectDuplicate|registerParticipant|createTeam|autoAssignTeams|addMember|moveMember|removeMember|mergeTeams|listTeams|getTeamById|getTeamByParticipantId|generateToken|startChallenge|ensureProgressRows|getProgress|getAllProgress|submitMission|verifyMission|rejectMission|submitDeploymentToken|getSettings|setSetting|getEventStats|getLeaderboardInput|getLeaderboardCached|listAnnouncements|createAnnouncement|setAnnouncementActive|generateCertificates|listCertificates|getAwardSuggestions|assignAward|removeAward|audit|ensureSuperAdmin|ensureOrganizer|buildExportBundle|buildWorkbook|logEvent|recomputeUnlocks)\(/, (mm, pre, fn) => {
      if (!done) { done = true; fixed++; }
      return pre + "await " + fn + "(";
    });
    if (!done) console.log("MANUAL:", file, ln, line.trim().slice(0, 100));
  }
  fs.writeFileSync(file, lines.join("\n"));
}
console.log("await fixes:", fixed);
