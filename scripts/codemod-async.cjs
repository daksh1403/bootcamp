const fs = require("fs");
const path = require("path");

const ROOTS = ["src", "scripts", "tests"];
const SKIP_FILES = new Set(["src/lib/db.ts"]);
const EXT = new Set([".ts", ".tsx"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p, out);
    } else if (EXT.has(path.extname(e.name)) && !SKIP_FILES.has(p)) {
      out.push(p);
    }
  }
  return out;
}

function scan(src) {
  const states = [];
  let inStr = null;
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    if (inStr) {
      if (inStr === "`" && c === "\\") { i++; continue; }
      if (inStr === "`" && c === "$" && src[i + 1] === "{") { states.push("`"); inStr = null; i++; continue; }
      if (c === inStr && (inStr !== "'" || prev !== "\\")) {
        if (inStr === "'" && prev === "\\") continue;
        inStr = null;
      } else if (inStr === "'" && c === "\\") { i++; }
      continue;
    }
    const top = states[states.length - 1];
    if (top === "`" && c === "}") { inStr = "`"; states.pop(); continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i++; continue; }
    if (c === "(" || c === "[" || c === "{") states.push(c);
    else if (c === ")" || c === "]" || c === "}") states.pop();
    else if ((c === "d" && src.slice(i, i + 11) === "db.prepare(") || (c === "(" && src.slice(i, i + 15) === "().prepare(")) {
      out.push(i);
    }
  }
  return out;
}

function matchParen(src, openIdx) {
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === inStr) inStr = null;
      else if (inStr === "`" && c === "$" && src[i + 1] === "{") { inStr = "tpl"; }
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

function transformFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const hits = scan(src);
  if (hits.length === 0) return 0;
  let edits = 0;
  const spans = [];
  for (const start of hits) {
    const prepareParen = src.indexOf("(", start);
    const prepareClose = matchParen(src, prepareParen);
    if (prepareClose < 0) continue;
    const afterPrepare = src.slice(prepareClose + 1);
    const m = afterPrepare.match(STMT);
    if (!m) continue;
    const stmtOpen = prepareClose + 1 + m[0].length - 1;
    const stmtClose = matchParen(src, stmtOpen);
    if (stmtClose < 0) continue;
    // consume trailing member access chain: .foo, ?.foo, [expr], !
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
    if (/^\s*!/.test(tail)) { bang = true; end = end + tail.match(/^\s*!/)[0].length; }
    // find expression start: walk back over receiver id (db / getDb())
    let exprStart = start;
    if (src.slice(start, start + 11) === "db.prepare(") {
      exprStart = start;
    } else {
      exprStart = start; // begins at "(" of "().prepare(" — receiver is getDb() call; include it
      exprStart = src.lastIndexOf("getDb", start);
      if (exprStart < 0) exprStart = start;
    }
    // check already awaited / returned-await
    const before = src.slice(Math.max(0, exprStart - 30), exprStart);
    if (/\bawait\s+$/.test(before)) continue;
    spans.push({ exprStart, end, bang });
  }
  spans.sort((a, b) => b.exprStart - a.exprStart);
  for (const s of spans) {
    const before = src.slice(Math.max(0, s.exprStart - 12), s.exprStart);
    const isReturn = /\breturn\s+$/.test(before);
    const ins = isReturn ? "await " : s.bang ? "(await " : "(await ";
    if (s.bang) {
      src = src.slice(0, s.exprStart) + "(await " + src.slice(s.exprStart, s.end - 1) + ")!" + src.slice(s.end);
    } else if (isReturn) {
      src = src.slice(0, s.exprStart) + "await " + src.slice(s.exprStart, s.end) + src.slice(s.end);
    } else {
      const needsWrap = true;
      if (needsWrap) src = src.slice(0, s.exprStart) + "(await " + src.slice(s.exprStart, s.end) + ")" + src.slice(s.end);
      else src = src.slice(0, s.exprStart) + "await " + src.slice(s.exprStart, s.end) + src.slice(s.end);
    }
    edits++;
  }
  // exec: await db.exec( / await getDb().exec(
  src = src.replace(/(?<!await )(?:return )?db\.exec\(/g, (mm) => (mm.startsWith("return") ? "return await db.exec(" : "await db.exec("));
  fs.writeFileSync(file, src);
  return edits;
}

let total = 0;
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) total += transformFile(f);
}
console.log("await insertions:", total);
