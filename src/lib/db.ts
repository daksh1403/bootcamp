import type { Client, InValue } from "@libsql/client";
import path from "path";
import fs from "fs";

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface Stmt<T = Record<string, unknown>> {
  run(...args: InValue[]): Promise<RunResult>;
  get(...args: InValue[]): Promise<T | undefined>;
  all(...args: InValue[]): Promise<T[]>;
}

export interface Db {
  prepare<T = Record<string, unknown>>(sql: string): Stmt<T>;
  exec(sql: string): Promise<void>;
}

let ready: Promise<Client> | null = null;

function resolveTarget(): { url: string; authToken?: string } {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) return { url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN || undefined };
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "bootcamp.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return { url: `file:${dbPath}` };
}

function init(): Promise<Client> {
  if (!ready) ready = doInit();
  return ready;
}

async function doInit(): Promise<Client> {
  const target = resolveTarget();
  // Lazy import: @libsql/client is only needed on Node (local dev / Netlify).
  // On Cloudflare Workers the D1 adapter is used and this never executes, so the
  // package stays out of the worker bundle (its workerd export is broken anyway).
  const { createClient } = await import("@libsql/client");
  const client = createClient(target);
  if (!target.authToken) {
    try {
      await client.execute("PRAGMA journal_mode = WAL");
      await client.execute("PRAGMA busy_timeout = 5000");
    } catch {
      // pragma best-effort on local embedded engine
    }
  }
  try {
    await client.execute("PRAGMA foreign_keys = ON");
  } catch {
    // remote engines manage FK enforcement themselves
  }
  await client.executeMultiple(SCHEMA);
  return client;
}

// ---- Cloudflare D1 adapter ----
// The schema is applied lazily on first request (CREATE TABLE IF NOT EXISTS),
// so the first hit may be slightly slower on a brand-new D1 database.

type D1Result = {
  success: boolean;
  meta: { changes?: number; last_row_id?: number };
  results?: Record<string, unknown>[];
};

interface D1Prepared {
  bind(...args: InValue[]): D1Prepared;
  run(...args: InValue[]): Promise<D1Result>;
  get(...args: InValue[]): Promise<Record<string, unknown> | null>;
  all(...args: InValue[]): Promise<{ results: Record<string, unknown>[] }>;
  first<T = Record<string, unknown>>(...args: InValue[]): Promise<T | null>;
  raw(...args: InValue[]): Promise<unknown[][]>;
}

interface D1Like {
  prepare(sql: string): D1Prepared;
  exec(sql: string): Promise<{ count: number }>;
  batch(statements: D1Prepared[]): Promise<D1Result[]>;
}

let d1SchemaReady: Promise<void> | null = null;

function isD1Like(db: unknown): db is D1Like {
  return !!db && typeof (db as D1Like).prepare === "function" && typeof (db as D1Like).exec === "function";
}

function getD1(): D1Like | null {
  // The OpenNext Cloudflare worker entrypoint sets a context symbol on the
  // global scope (Symbol.for("__cloudflare-context__")) for the duration of a
  // request. When it's absent (local dev, Netlify, build) we use libsql below.
  const context = (globalThis as Record<PropertyKey, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: Record<string, unknown> }
    | undefined;
  const db = context?.env?.DB;
  if (isD1Like(db)) return db;
  return null;
}

async function ensureD1Schema(db: D1Like): Promise<void> {
  if (!d1SchemaReady) {
    d1SchemaReady = (async () => {
      // D1 enforces foreign keys by default. db.exec() chokes on the
      // multi-statement SCHEMA string, so split it and run each statement via
      // batch(). CREATE TABLE IF NOT EXISTS keeps this idempotent on warm
      // instances and against an already-migrated database.
      const statements = SCHEMA
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => `${s};`);
      await db.batch(statements.map((sql) => db.prepare(sql)));
    })().catch((e) => {
      d1SchemaReady = null;
      throw e;
    });
  }
  return d1SchemaReady;
}

function makeD1Db(db: D1Like): Db {
  const schemaReady = ensureD1Schema(db);
  return {
    prepare<T = Record<string, unknown>>(sql: string): Stmt<T> {
      const stmt = db.prepare(sql);
      return {
        run: async (...args: InValue[]): Promise<RunResult> => {
          await schemaReady;
          const r = await stmt.bind(...args).run();
          return { changes: r.meta.changes ?? 0, lastInsertRowid: r.meta.last_row_id ?? 0 };
        },
        get: async (...args: InValue[]): Promise<T | undefined> => {
          await schemaReady;
          const row = await stmt.bind(...args).first<T>();
          return row ?? undefined;
        },
        all: async (...args: InValue[]): Promise<T[]> => {
          await schemaReady;
          const r = await stmt.bind(...args).all();
          return (r.results as T[]) ?? [];
        },
      };
    },
    exec: async (sql: string) => {
      await schemaReady;
      await db.exec(sql);
    },
  };
}

export function getDb(): Db {
  // Cloudflare Workers: the OpenNext entrypoint exposes env.DB via the context
  // symbol. When present, use D1; otherwise (local dev, Netlify) use libsql.
  const d1 = getD1();
  if (d1) return makeD1Db(d1);

  // Local dev + Netlify (Turso / local SQLite file): libsql client.
  return {
    prepare<T = Record<string, unknown>>(sql: string): Stmt<T> {
      return {
        run: async (...args: InValue[]): Promise<RunResult> => {
          const c = await init();
          const r = await c.execute({ sql, args: args as InValue[] });
          return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid ?? 0 };
        },
        get: async (...args: InValue[]): Promise<T | undefined> => {
          const c = await init();
          const r = await c.execute({ sql, args: args as InValue[] });
          return (r.rows[0] ?? undefined) as T | undefined;
        },
        all: async (...args: InValue[]): Promise<T[]> => {
          const c = await init();
          const r = await c.execute({ sql, args: args as InValue[] });
          return r.rows as unknown as T[];
        },
      };
    },
    exec: async (sql: string) => {
      const c = await init();
      await c.executeMultiple(sql);
    },
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK(role IN ('participant','organizer','super_admin')),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  reg_no TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  branch TEXT NOT NULL,
  year TEXT NOT NULL,
  ram TEXT NOT NULL,
  os TEXT NOT NULL,
  docker_installed TEXT NOT NULL DEFAULT 'no',
  github_username TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','checked_in')),
  checked_in_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  token_hash TEXT,
  token_hint TEXT,
  token_generated_at INTEGER,
  token_generated_by TEXT,
  challenge_started_at INTEGER,
  deployment_time INTEGER,
  deployment_url TEXT,
  m4_verified_at INTEGER,
  award TEXT,
  leaderboard_override INTEGER,
  override_note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

CREATE TABLE IF NOT EXISTS mission_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  mission_code TEXT NOT NULL CHECK(mission_code IN ('M1','M2','M3','M4')),
  status TEXT NOT NULL DEFAULT 'locked' CHECK(status IN ('locked','available','in_progress','submitted','verified','failed')),
  submitted_payload TEXT,
  submitted_at INTEGER,
  verified_at INTEGER,
  verified_by TEXT,
  verifier_note TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(team_id, mission_code)
);
CREATE INDEX IF NOT EXISTS idx_mp_team ON mission_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_mp_status ON mission_progress(status);

CREATE TABLE IF NOT EXISTS verification_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  mission_code TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('submit','verify','reject','retry','token_success','token_fail','start')),
  actor_label TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ve_team ON verification_events(team_id, mission_code);

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token_submitted_hash TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('success','fail')),
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ca_team ON challenge_attempts(team_id);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
  active INTEGER NOT NULL DEFAULT 1,
  countdown_to INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_code TEXT NOT NULL UNIQUE,
  participant_id INTEGER NOT NULL UNIQUE REFERENCES participants(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  completion_status TEXT NOT NULL CHECK(completion_status IN ('attended','completed','excellence')),
  issued INTEGER NOT NULL DEFAULT 0,
  awarded_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  award_key TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
  assigned_by TEXT,
  assigned_at INTEGER NOT NULL,
  UNIQUE(award_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  actor_label TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS event_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer_idx INTEGER NOT NULL,
  category TEXT DEFAULT 'devops'
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_s INTEGER,
  answers TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(participant_id)
);
`;

export type DbClient = Db;

export function now(): number {
  return Date.now();
}
