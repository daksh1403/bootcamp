import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";
import os from "os";

// Isolate every test run in its own throwaway SQLite DB so tests can NEVER
// touch the real event database at ./data/bootcamp.db.
const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyg-vitest-"));

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    hookTimeout: 30000,
    env: {
      TEST_DB_PATH: path.join(testDbDir, "test.db"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
