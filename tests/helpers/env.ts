/**
 * Shared test bootstrap: point the app at a throwaway SQLite DB per test file.
 * Call useTempDb(label) BEFORE importing anything that opens src/lib/db.
 */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export function makeTempDbPath(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cyg-${label}-`));
  return path.join(dir, "test.db");
}

export function randomEmail(): string {
  return `t-${crypto.randomBytes(4).toString("hex")}@vitstudent.ac.in`;
}
