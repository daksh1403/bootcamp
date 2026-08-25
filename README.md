# Docker × Jenkins Bootcamp — The DevOps Deployment Mission

**Code{Y}Gen, VIT Chennai** · Monday, 31 August 2026 · AB1-404B Lab

A production-grade event platform that runs the entire bootcamp end-to-end for ~50 participants:
registration → approval → check-in → M1 CONTAINERIZE → M2 BUILD → M3 AUTOMATE → M4 SHIP IT →
token-verified deployment → live leaderboard → awards → certificates → Excel master record.

```
CODE. CONTAINERIZE. AUTOMATE. DEPLOY.
NO SPECTATORS. EVERYONE SHIPS.
```

---

## Architecture

| Layer      | Choice | Why |
|------------|--------|-----|
| Framework  | Next.js 15 (App Router) + React 19 + TypeScript | Server components read the DB directly (no HTTP hop), API routes for mutations |
| Styling    | Tailwind CSS v4, dark terminal/mission-control theme | Fast, consistent, projector-readable |
| Database   | SQLite via `better-sqlite3` (WAL mode) | Zero-config, single-file, comfortably handles 50 concurrent participants; trivially backupable |
| Auth       | Custom sessions: bcryptjs password hashing + SHA-256-hashed session tokens in httpOnly SameSite cookies | No external dependency; server-side authorization on every route |
| Excel      | `exceljs` — real multi-sheet `.xlsx` export/import | The organizer's official master record |
| Validation | `zod` at every trust boundary | Never trust client input |
| Tests      | Vitest (33 tests across 5 suites) | Core business logic is covered |

```
src/
├── app/
│   ├── page.tsx                 # Landing (mission-control aesthetic)
│   ├── event-info/ timeline/ setup/ health-check/
│   ├── register/ login/         # Public flows
│   ├── leaderboard/ announcements/ quiz/ results/
│   ├── event/live/              # Projector mode (fullscreen, auto-refresh)
│   ├── dashboard/               # Participant mission control (+ m1..m4)
│   ├── admin/                   # Control center, live status, check-in desk,
│   │                            # teams, verifications, Ship It control,
│   │                            # leaderboard override, announcements,
│   │                            # certificates, awards, excel, settings, audit
│   └── api/                     # All mutations (see Security)
├── lib/                         # db, auth, rbac, missions state machine,
│                                # leaderboard ranking, excel builder, audit…
└── components/                  # Digital Mission Card, tables, forms
scripts/                         # bootstrap / seed / reset
tests/                           # vitest suites
```

## Quick start (development)

```bash
pnpm install
pnpm bootstrap            # creates the first super admin from env vars
ADMIN_EMAIL=lead@codeygen.dev ADMIN_PASSWORD=supersecret1 pnpm bootstrap

pnpm seed:demo            # OPTIONAL dev-only: 10 teams / 20 participants with varied progress
                          # demo login: seed1@vitstudent.ac.in / demo1234

pnpm dev                  # http://localhost:3000
```

## Environment variables

See `.env.example`. Everything has safe defaults for local dev.

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` / `DATA_DIR` | SQLite location (default `./data/bootcamp.db`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | First super admin (`pnpm bootstrap`) |
| `OPS_EMAIL`, `OPS_NAME`, `OPS_PASSWORD` | Optional second organizer account |
| `ALLOWED_ORIGINS` | Extra origins allowed for mutating APIs in production |
| `ALLOW_DEMO_SEED=1` | Override the production guard if you *really* want demo data |

## Production deployment

```bash
pnpm install --frozen-lockfile
ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm bootstrap   # once
pnpm build
pnpm start          # or run behind your process manager / container
```

- Health check: `GET /api/health`
- Back up by downloading `/api/admin/export/json`, plus a file copy of `data/bootcamp.db`.
- **Production reset:** `CONFIRM=WIPE-ALL-EVENT-DATA node scripts/reset-prod.cjs`

## Roles

| Role | Powers |
|---|---|
| **Participant** | Register, dashboard, Digital Mission Card, M1–M4 briefings + submissions, token submission, leaderboard, quiz. **Can never verify anything.** |
| **Organizer** | Approve/reject registrations, check-in, team management, verification queue (verify/reject/retry+note), challenge control, announcements, certificates, awards, exports, settings, audit log. |
| **Super Admin** | Everything above + crew account management, progress reset (emergency recovery), participant deletion. |

## The mission chain (server-enforced)

```
M1 available → submit → SUBMITTED → organizer VERIFY → verified ─┐
M2 locked ────────────────────────────────── unlocks ◀───────────┘
… same for M2→M3 and M3→M4 …
M4 SHIP IT: organizer generates per-team secret token → starts timer →
team deploys their fresh app → app exposes token → team submits token →
SHA-256 checked server-side → deployment time stamped →
(auto-verified by default, organizer retains reject authority) → leaderboard updates
```

- Wrong tokens are rejected, logged as failed attempts, and rate-limited (configurable max).
- Token plaintext is shown exactly once to the organizer; only its hash is stored.
- Participants can only ever move a mission to `submitted` — never to `verified`.

## Excel workflow (organizer's master record)

**Export** (Excel/Backup Center in admin):
- `.xlsx` — five sheets with exact columns: **Participants, Missions, Ship It, Leaderboard, Certificates**
- `.csv` — results export
- `.json` — full reconstructable event backup (never includes password hashes/session tokens)

**Import**: upload an `.xlsx` containing a Participants sheet (same format as export).
Rows merge by Registration Number / Email — useful for bulk intake before approvals open.

Event-day drill: keep the Excel tab pinned; export after each verification wave.
The workbook always reflects live state, so verification records stay exportable at any moment.

## Event-day operating instructions

1. **08:30** — Open `/admin/checkin` on the door laptop; participants arrive with their Participant ID.
2. **Before labs** — Admin → Settings: turn **EVENT MODE** on (minimal nav, live banner).
3. **During labs** — Watch **Control Center → Needs Attention** and **Live Status** ("idle 25+ min" panel finds stuck teams automatically). Verify submissions from **Verifications** queue as they land.
4. **13:00 lunch** — Publish "Ship It is LIVE" style announcements (presets included); students play `/quiz`.
5. **15:15 Ship It** — Admin → Ship It Control: generate each team's token (shown once), fire START (individually or START ALL). Teams deploy and submit tokens; correct tokens stamp deployment time instantly.
6. **16:00** — Leaderboard Control for any dispute overrides (PIN rank, audit-logged). Assign awards (system suggests candidates from data; you decide). Generate certificate records, mark issued.
7. **After** — Export XLSX + JSON backup. Switch **POST-EVENT MODE** on: landing shows winners, `/results` goes public.

Projector feed: `/event/live` — fullscreen, self-refreshing every 5s, readable from the back of the lab.

## Testing

```bash
pnpm test          # 33 tests: registration, duplicates, RBAC-guarded flows,
                   # mission unlock chain, token verification incl. lockout,
                   # leaderboard rules, Excel round-trip, rate limiting,
                   # sessions, audit log immutability, certificates idempotency
```

Manual E2E scenarios A–L (register → approve → check-in → M1..M4 → verify → leaderboard → export → certificate) are exercised end-to-end against a running server; see the walkthrough below:

```bash
# terminal 1
DATABASE_PATH=$(mktemp -d)/e2e.db ADMIN_EMAIL=a@b.dev ADMIN_PASSWORD=password1 pnpm bootstrap
DATABASE_PATH=$(mktemp -d)/e2e.db pnpm dev
```

Then walk: `/register` → admin approve → check-in → dashboard M1 submit → admin verify →
M2 unlocks → … → Ship It Control token flow → `/leaderboard` → `/admin/excel`.

## Security model

- Passwords: bcrypt (cost 10). Sessions: 256-bit random tokens, SHA-256 hashed at rest, httpOnly/SameSite=Lax cookies, 7-day expiry.
- Every mutation route: session + role check server-side, zod validation, same-origin (CSRF) enforcement, parameterized SQL (no string-built queries), output length caps.
- Rate limits: login (per-account & per-IP), registration, mission submissions, token attempts, quiz.
- Deployment tokens: random Crockford base32, stored only as SHA-256; plaintext displayed once.
- Audit log records actor, action, target, old/new values, IP for every critical operation; unknown action names throw rather than pass silently.
- No client-side trust anywhere: the browser can never mark a mission complete, verify a token, or alter the leaderboard.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login says invalid credentials but account exists | Registrations start `pending`; login works, but missions need approval + check-in. Reset password via Super Admin (recreate user) if forgotten. |
| Team sees "not checked in" | Use Check-In Desk; undo button exists for mistakes. |
| Token always rejected | Confirm challenge started for that team; confirm exact token (copy-paste); check attempt lockout in Ship It Control (REGEN issues a fresh token). |
| Excel download empty rows | Data appears after teams/participants exist; seed demo data in dev to preview. |
| DB locked errors | WAL mode + busy_timeout are set; avoid two servers sharing one file. |

## Backup & recovery

- Live: `/api/admin/export/json` (full), `/api/admin/export/xlsx` (master record), file copy of `data/bootcamp.db` while stopped.
- Recover: restore `bootcamp.db`, restart server. Or import the Participants sheet into a fresh instance and re-run the event record rebuild via exports.
- Nuclear option (new event): `CONFIRM=WIPE-ALL-EVENT-DATA node scripts/reset-prod.cjs`.
