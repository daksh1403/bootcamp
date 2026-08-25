#!/usr/bin/env node
/**
 * PRODUCTION RESET — wipes the event database and recreates the schema.
 * Requires CONFIRM=WIPE-ALL-EVENT-DATA to run. Refuses silently otherwise.
 */
const fs = require("fs");
const path = require("path");

if (process.env.CONFIRM !== "WIPE-ALL-EVENT-DATA") {
  console.error("Refusing to wipe. Run with CONFIRM=WIPE-ALL-EVENT-DATA if you are absolutely sure.");
  console.error("Tip: export a JSON backup first via /api/admin/export/json.");
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "bootcamp.db");

for (const suffix of ["", "-wal", "-shm"]) {
  const f = dbPath + suffix;
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log("removed", f);
  }
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
console.log("✓ Database wiped. Schema will be recreated on next server start.");
