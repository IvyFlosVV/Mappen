Used tools: Cursor & Claude
Agentic Build

Beginning Prompt:
I'm building Mappen, a geographic journal mobile app. This is Phase 1 of the build. Work through the phases IN ORDER and STOP at each CHECKPOINT for me to verify before continuing. Do not skip checkpoints even if you think the next step is obvious.

# Context

Mappen lets users create journal "entries" pinned to their current GPS location. Each entry optionally has a photo, title, and body — only location is required. Visibility is private or friends-only (no public tier). Friends are added via invite codes. Two main views: map (spatial) and journal (chronological list).

# Stack — do not deviate

- Frontend: Expo SDK 52 (managed workflow) + React Native + TypeScript + Expo Router
- Backend: Express + TypeScript (Node 20), will deploy to Render later
- Database / Auth / Storage: Supabase
- Maps (later phase): Mapbox via @rnmapbox/maps — do NOT install this in Phase 1

# Current repo state

Root is `/Users/ivyweng/Documents/GitHub/Mappen`. It currently contains:
- README.md (empty, leave it alone for now)
- .gitignore (already configured — do NOT modify)
- .git/

Monorepo layout to create:

Mappen/
├── README.md            (leave alone)
├── .gitignore           (leave alone)
├── PROMPT_LOG.md        (create stub)
├── REFLECTION.md        (create stub with a note that I write this myself without AI)
├── docs/
│   └── SUPABASE_SETUP.md (you'll create in Phase 1C)
├── app/                 (Expo frontend)
└── server/              (Express backend)

# Non-negotiables

- NEVER hardcode API keys. Use process.env and commit only .env.example files with placeholders.
- TypeScript strict mode on both sides.
- Do not install @rnmapbox/maps, expo-camera, or expo-location yet — those are later phases.
- Do not create any Supabase tables or write SQL files yet — Phase 1C handles that.

---

# Phase 1A — Frontend scaffold (app/)

1. `cd` into repo root, then create Expo app with: `npx create-expo-app@latest app --template default`. Pick the TypeScript default template.
2. Inside `app/`:
   - Confirm Expo Router is set up (it is by default in SDK 52+).
   - Install runtime deps: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`.
   - Create `app/.env.example` with these keys (blank values):
EXPO_PUBLIC_SUPABASE_URL=
 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
- Create `app/src/lib/supabase.ts` that exports a configured Supabase client using AsyncStorage, autoRefreshToken, persistSession, detectSessionInUrl: false. Import `react-native-url-polyfill/auto` at the top.
   - Do NOT modify the default `app/(tabs)/` routes yet. Just ensure the app boots.
3. Verify tsconfig has `"strict": true`.

CHECKPOINT 1A — STOP. Tell me:
- Exact command I run from the repo root to start the Expo dev server.
- Whether there were any warnings during install I should know about.
- Confirm .env.example was created but .env was NOT (I create .env myself).

Wait for my "continue 1B" before proceeding.

---

# Phase 1B — Backend scaffold (server/)

1. `cd` into repo root, then `mkdir server && cd server`.
2. `npm init -y`, then install: `express`, `cors`, `dotenv`, `@supabase/supabase-js`. Dev deps: `typescript`, `@types/node`, `@types/express`, `@types/cors`, `tsx`, `nodemon`.
3. Create `server/tsconfig.json` with strict mode, target ES2022, moduleResolution node, outDir ./dist, rootDir ./src.
4. Create `server/.env.example`:
PORT=3000
SUPABASE_URL=
SUPABASE_SECRET_KEY=
5. Create `server/src/index.ts`:
   - Load dotenv
   - Express app with CORS enabled (allow all origins in dev — I'll tighten this later)
   - GET /health returns `{ ok: true, ts: <iso string> }`
   - Listen on process.env.PORT or 3000
6. Add npm scripts to `server/package.json`:
   - `"dev": "nodemon --exec tsx src/index.ts"`
   - `"build": "tsc"`
   - `"start": "node dist/index.js"`

CHECKPOINT 1B — STOP. Tell me:
- Exact command to start the backend dev server from the repo root.
- The curl command to verify /health works.

Wait for my "continue 1C" before proceeding.

---

# Phase 1C — Supabase setup docs (no execution)

I have NOT created any Supabase tables yet. I have a Supabase project but it's empty. Create `docs/SUPABASE_SETUP.md` containing:

1. A "Prerequisites" section listing what I should have already done (Supabase project created, publishable + secret keys rotated and saved).

2. A "Step 1: Schema" section with ONE SQL code block I can paste into the Supabase SQL Editor. This SQL creates:
   - `profiles` table: id (uuid, PK, references auth.users on delete cascade), username (text, unique, not null, citext if possible), invite_code (text, unique, not null, 8 chars), created_at (timestamptz default now())
   - `entries` table: id (uuid PK default gen_random_uuid()), user_id (uuid, FK profiles, not null), latitude (double precision, not null), longitude (double precision, not null), location_name (text, nullable), photo_url (text, nullable), title (text, nullable), body (text, nullable), visibility (text, not null, default 'private', CHECK in ('private','friends')), created_at (timestamptz, default now(), but editable by user), updated_at (timestamptz, default now())
   - `friendships` table: user_a (uuid, FK profiles), user_b (uuid, FK profiles), status (text, CHECK in ('pending','accepted'), default 'pending'), created_at (timestamptz default now()), PRIMARY KEY (user_a, user_b), CHECK (user_a < user_b)
   - Indexes: entries(user_id, created_at desc), entries(latitude, longitude)
   - An `updated_at` trigger on `entries` that auto-updates the column
   - A `handle_new_user()` trigger on auth.users that auto-inserts a profiles row with a random 8-char invite_code (use substr(md5(random()::text), 1, 8) or similar) and username defaulting to 'user_' || substr(id::text, 1, 8)

3. A "Step 2: RLS policies" section with a SECOND SQL code block that:
   - Enables RLS on all three tables
   - profiles: SELECT allowed for authenticated users (any row — needed for friend lookup by invite code); UPDATE only where id = auth.uid()
   - entries SELECT: row visible if user_id = auth.uid() OR (visibility = 'friends' AND there exists a friendship row with status='accepted' between the row's user_id and auth.uid(), respecting the user_a < user_b convention — use a USING clause that checks both orderings via LEAST/GREATEST or UNION)
   - entries INSERT: WITH CHECK user_id = auth.uid()
   - entries UPDATE / DELETE: USING user_id = auth.uid()
   - friendships SELECT: auth.uid() IN (user_a, user_b)
   - friendships INSERT: WITH CHECK auth.uid() IN (user_a, user_b)
   - friendships UPDATE: USING auth.uid() IN (user_a, user_b) — for accepting requests

4. A "Step 3: Verification queries" section with 3-4 SQL snippets I can run to verify the setup works (e.g., signing up a test user, checking the profiles row was auto-created, checking RLS blocks anon access).

5. At the bottom, a "Why these design choices" section briefly explaining (for my oral exam prep):
   - Why RLS instead of filtering in the client
   - Why the user_a < user_b convention on friendships
   - Why invite_code lives on profiles

DO NOT execute any of this SQL. Just write the doc.

CHECKPOINT 1C — STOP. Tell me:
- Path to the doc you created.
- Any SQL gotchas I should watch for when pasting (e.g., citext extension needs to be enabled first — include that in the doc if so).

Wait for my "continue 1D" before proceeding.

---

# Phase 1D — Stub root docs

Create (or overwrite if they exist — but leave README.md alone):
- `PROMPT_LOG.md` with a header, a "Phase 1 scaffold" section, and placeholder text `<this will be filled with verbatim prompts from Cursor agent sessions as we go>`.
- `REFLECTION.md` with a header and an explicit `<!-- I (Ivy) write this myself without AI, per assignment rules. Do not edit. -->` comment at the top.

CHECKPOINT 1D — STOP. Final report:
- Tree of everything you created (max 3 levels deep, exclude node_modules).
- The 3-4 commands I need to run right now, in order, to: (a) install frontend deps if not auto-installed, (b) start backend, (c) start frontend, (d) verify /health.
- A list of things you did NOT do that I asked about earlier in this prompt (e.g., Mapbox install, Supabase SQL execution, .env population) — so I can confirm you respected the non-negotiables.

Do not continue past this checkpoint. Wait for my instructions.

### Notable deviation in 1B
Cursor installed TypeScript 6 (latest), which deprecated `moduleResolution: "node"`. 
It autonomously updated tsconfig to `module: "node16"` + `moduleResolution: "node16"`. 
Verified with `tsc --noEmit`. 
Side effect to watch: node16 resolution requires `.js` extensions in relative imports.


## Phase 1C — Supabase schema & RLS

### Root prompt
(Continuing the Phase 1 agent prompt — see Phase 1A block above for full text.
This phase invoked the `Phase 1C — Supabase setup docs (no execution)` section.)

### Pre-execution SQL review
Reviewed `docs/SUPABASE_SETUP.md` before running any SQL. Changed:
- `handle_new_user()` username default from `'user_' || substr(NEW.id::text, 1, 8)`
  to `'user_' || substr(NEW.id::text, 1, 8) || '_' || substr(md5(random()::text), 1, 4)`
  — the original risked UNIQUE constraint violations on username collision.

Accepted with logged tradeoffs:
- `invite_code` generation doesn't retry on collision (8-char hex, ~4B possibilities,
  acceptable at project scale).
- `entries` RLS policy does a per-row EXISTS subquery on `friendships`; fine at
  current scale, would need JOIN-based rewrite past 100k entries.

### Execution
- Ran Step 1 (schema) — Supabase linter flagged "destructive operations"
  (from `DROP TRIGGER IF EXISTS` idempotent pattern) and "tables without RLS"
  (intentional, separated for debuggability). Chose "Run without RLS".
- Ran Step 2 (RLS + policies) in separate tab — no warnings.

### Verification
- 3a: `pg_tables.rowsecurity = true` on all 3 tables ✓
- 3b: `on_auth_user_created` (AFTER INSERT on auth.users) and
      `entries_set_updated_at` (BEFORE UPDATE on entries) both present ✓
- 3c: Created test user `test1@mappen.local` via Auth UI; profiles row
      auto-generated with username `user_<uuid8>_<rand4>` and 8-char invite_code ✓
- 3d: Curled REST API with publishable (anon) key — returned `[]` as expected ✓
      (Note: used browser URL query-param variant after curl shell escaping
      issues with multi-header command; functional equivalent.)