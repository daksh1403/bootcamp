const fs = require("fs");
const path = require("path");

const ROOTS = ["src", "scripts", "tests"];
const SKIP = new Set(["src/lib/db.ts", "scripts/codemod-async.cjs", "scripts/audit-awaits.cjs", "scripts/fix-awaits.cjs"]);
const EXT = new Set([".ts", ".tsx"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, out);
    } else if (EXT.has(path.extname(e.name)) && !SKIP.has(p)) out.push(p);
  }
  return out;
}

function scanPrepares(src) {
  const hits = [];
  let inStr = null;
  const st = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (inStr === "`" && c === "$" && src[i + 1] === "{") { st.push("`"); inStr = null; i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    const top = st[st.length - 1];
    if (top === "`" && c === "}") { inStr = "`"; st.pop(); continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i++; continue; }
    if (c === "(" || c === "[" || c === "{") st.push(c);
    else if (c === ")" || c === "]" || c === "}") st.pop();
    else if (src.slice(i, i + 9) === ".prepare(") hits.push(i);
  }
  return hits;
}

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

const STMT = /^\s*\.\s*(run|get|all)\s*\(/;

let fixed = 0;
const manual = [];
for (const file of ROOTS.flatMap((r) => (fs.existsSync(r) ? walk(r) : []))) {
  let src = fs.readFileSync(file, "utf8");
  const hits = scanPrepares(src);
  const spans = [];
  for (const dotIdx of hits) {
    const openIdx = src.indexOf("(", dotIdx);
    const closeIdx = matchParen(src, openIdx);
    if (closeIdx < 0) continue;
    const m = src.slice(closeIdx + 1).match(STMT);
    if (!m) continue;
    const stmtOpen = closeIdx + 1 + m[0].length - 1;
    const stmtClose = matchParen(src, stmtOpen);
    if (stmtClose < 0) continue;

    // find expression start: receiver before .prepare — walk back over identifier or getDb() call
    let exprStart = dotIdx;
    const before = src.slice(0, dotIdx);
    const idm = before.match(/([A-Za-z_$][\w$]*)\s*$/);
    if (idm) {
      exprStart = dotIdx - idm[1].length;
      // getDb().prepare — include getDb()
      const gb = src.slice(0, exprStart);
      const gbm = gb.match(/\bgetDb\(\)\s*$/);
      if (gbm) exprStart = exprStart - gbm[0].length;
    }

    // already awaited? look back for await (allow whitespace, return await, (await handled by paren check below)
    const beforeExpr = src.slice(Math.max(0, exprStart - 40), exprStart);
    if (/\bawait\s+$/.test(beforeExpr)) continue;
    // `(await ...)` wrapping from earlier codemod: check if exprStart-1 is "(" and matching close is followed by stmt... simpler: if beforeExpr ends with "(" and there is "await" within 10 chars before that
    if (/\(\s*$/.test(beforeExpr) && /\bawait\s+\($/.test(src.slice(Math.max(0, exprStart - 60), exprStart - 1) + "(")) continue;

    // consume trailing member chain after stmt call
    let end = stmtClose + 1;
    let bang = false;
    for (;;) {
      const rest = src.slice(end);
      const mm = rest.match(/^\s*(\??)\.\s*[A-Za-z_$][\w$]*/);
      const im = rest.match(/^\s*\[/);
      if (mm) {
        let e2 = end + mm[0].length;
        const cm = src.slice(e2).match(/^\s*\(/);
        if (cm) {
          const cp = matchParen(src, e2 + cm[0].length - 1);
          if (cp < 0) break;
          e2 = cp + 1;
        }
        end = e2;
      } else if (im) {
        const cp = matchParen(src, end + im[0].length - 1);
        if (cp < 0) break;
        end = cp + 1;
      } else break;
    }
    const tail = src.slice(end);
    const bm = tail.match(/^\s*!/) || tail.match(/^\s*as\s/);
    if (/^\s*!/.test(tail)) { bang = true; end = end + tail.match(/^\s*!/)[0].length; }
    spans.push({ exprStart, end, bang, hasAs: /^\s*as\s/.test(tail) });
  }
  if (spans.length === 0) continue;
  spans.sort((a, b) => b.exprStart - a.exprStart);
  for (const s of spans) {
    const before = src.slice(Math.max(0, s.exprStart - 12), s.exprStart);
    const isReturn = /\breturn\s+$/.test(before);
    if (s.bang) {
      src = src.slice(0, s.exprStart) + "(await " + src.slice(s.exprStart, s.end - 1) + ")!" + src.slice(s.end);
    } else if (isReturn && !s.hasAs) {
      src = src.slice(0, s.exprStart) + "await " + src.slice(s.exprStart, s.end) + src.slice(s.end);
    } else {
      src = src.slice(0, s.exprStart) + "(await " + src.slice(s.exprStart, s.end) + ")" + src.slice(s.end);
    }
    fixed++;
  }
  fs.writeFileSync(file, src);
  manual.push(file);
}
console.log("fixed:", fixed, "in", manual.length, "files");
console.log(manual.join("\n"));
