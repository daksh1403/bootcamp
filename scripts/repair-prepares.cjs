const fs = require("fs");

const FILES = [
  "src/app/admin/audit/page.tsx",
  "src/app/api/admin/audit/route.ts",
  "src/app/api/admin/users/route.ts",
  "src/app/api/quiz/standings/route.ts",
  "src/lib/auth.ts",
  "src/lib/bootstrap.ts",
  "src/lib/excel.ts",
  "src/lib/services/event-ops.ts",
  "src/lib/services/leaderboard-service.ts",
  "src/lib/services/missions-service.ts",
  "src/lib/services/participants.ts",
  "src/lib/services/stats.ts",
  "src/lib/services/teams.ts",
  "tests/platform.test.ts",
  "tests/registration.test.ts",
  "tests/token-leaderboard.test.ts",
];

function matchParen(src, openIdx) {
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      else if (inStr === "`" && c === "$" && src[i + 1] === "{") inStr = "tpl";
      continue;
    }
    if (inStr === "tpl") {
      if (c === "}") inStr = "`";
      else if (c === "`") inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

for (const file of FILES) {
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8");
  let guard = 0;
  for (;;) {
    if (guard++ > 50) break;
    const re = /\(await\s*\n?\s*\.prepare\(/;
    const m = src.match(re);
    if (!m) break;
    const p = m.index;
    const q = matchParen(src, p);
    if (q < 0) break;
    // undo: remove the wrapping parens and the stray await
    let inner = src.slice(p + 1, q);
    inner = inner.replace(/^await\s*\n?\s*/, "");
    src = src.slice(0, p) + inner + src.slice(q + 1);
    // now the chain begins at p with `.prepare(`; find receiver expression start by scanning back
    let start = p;
    const back = src.slice(0, p);
    const receiverMatch = back.match(/(=\s*(?:new\s+)?|[=(]\s*|\breturn\s+|\bawait\s+)([\w$]+\s*(\(\)\s*)?)$/);
    if (receiverMatch) {
      start = p - receiverMatch[2].length;
      // include getDb() fully if receiver is getDb()
      if (receiverMatch[2].trim() === "getDb" || receiverMatch[2].trim() === "getDb()") {
        start = p - receiverMatch[2].length;
      }
      // if what precedes the receiver is "=", we wrap from there; if "(", outer paren exists already
      const preChar = src.slice(0, start).trimEnd().slice(-1);
      const chainEnd = p + (inner.length - inner.replace(/^\s*/, "").length === 0 ? inner.length : inner.length);
      // chain end in new coords: p + inner.trimStart().length is end of chain (since we cut at q)
      const endPos = p + inner.trimStart().length;
      if (preChar === "=" || src.slice(0, start).trimEnd().endsWith("return")) {
        src = src.slice(0, start) + "(await " + src.slice(start, endPos) + ")" + src.slice(endPos);
      }
      // if preChar === "(" the expression was already wrapped in (await ...) by an earlier fix — nothing to do
    }
  }
  fs.writeFileSync(file, src);
  console.log("repaired", file);
}
