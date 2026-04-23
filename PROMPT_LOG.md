# PROMPT_LOG.md — Mappen

Used tools: Cursor & Claude
Agentic Build

## Phase 1 — Scaffold + Supabase schema + RLS

### Beginning Prompt

```
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

3. A "Step 2: RLS policies" section with a SECOND SQL code block that enables RLS on all three tables with appropriate policies.

4. A "Step 3: Verification queries" section with 3-4 SQL snippets I can run to verify the setup works.

5. At the bottom, a "Why these design choices" section briefly explaining (for my oral exam prep):
   - Why RLS instead of filtering in the client
   - Why the user_a < user_b convention on friendships
   - Why invite_code lives on profiles

DO NOT execute any of this SQL. Just write the doc.

CHECKPOINT 1C — STOP. Tell me:
- Path to the doc you created.
- Any SQL gotchas I should watch for when pasting.

Wait for my "continue 1D" before proceeding.

---

# Phase 1D — Stub root docs

Create (or overwrite if they exist — but leave README.md alone):
- `PROMPT_LOG.md` with a header, a "Phase 1 scaffold" section, and placeholder text.
- `REFLECTION.md` with a header and an explicit `<!-- I (Ivy) write this myself without AI, per assignment rules. Do not edit. -->` comment at the top.

CHECKPOINT 1D — STOP. Final report:
- Tree of everything you created (max 3 levels deep, exclude node_modules).
- The 3-4 commands I need to run right now, in order.
- A list of things you did NOT do that I asked about earlier in this prompt.

Do not continue past this checkpoint. Wait for my instructions.
```

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
- `invite_code` generation doesn't retry on collision (8-char hex, ~4B possibilities, acceptable at project scale).
- `entries` RLS policy does a per-row EXISTS subquery on `friendships`; fine at current scale, would need JOIN-based rewrite past 100k entries.

### Execution

- Ran Step 1 (schema) — Supabase linter flagged "destructive operations" (from `DROP TRIGGER IF EXISTS` idempotent pattern) and "tables without RLS" (intentional, separated for debuggability). Chose "Run without RLS".
- Ran Step 2 (RLS + policies) in separate tab — no warnings.

### Verification

- 3a: `pg_tables.rowsecurity = true` on all 3 tables ✓
- 3b: `on_auth_user_created` (AFTER INSERT on auth.users) and `entries_set_updated_at` (BEFORE UPDATE on entries) both present ✓
- 3c: Created test user `test1@mappen.local` via Auth UI; profiles row auto-generated with username `user_<uuid8>_<rand4>` and 8-char invite_code ✓
- 3d: Curled REST API with publishable (anon) key — returned `[]` as expected ✓ (Note: used browser URL query-param variant after curl shell escaping issues with multi-header command; functional equivalent.)

## Phase 2 — Design decisions (before build)

### Switched from Mapbox to react-native-maps

Originally planned `@rnmapbox/maps` for the map layer. Reversed this decision before Phase 2 because:
- `@rnmapbox/maps` requires a dev build (`eas build`) — incompatible with Expo Go, which I'm using for fast iteration.
- Adds another third-party API key to manage.
- Apple/Google native maps (via react-native-maps) are adequate for the visual requirement of this project.

Trade-off: less visual polish, no custom map styling. Acceptable at this scope.

### Auth: hand-rolled email/password form, not Supabase Auth UI

Using `supabase.auth.signInWithPassword()` and `signUp()` directly with custom input components, so every step of the auth flow is code I can read, explain, and modify. Rejected the Supabase Auth UI component library because its behavior would be opaque during the oral exam.

## Phase 2 — Auth + Map screen

### Prompt

```
I'm continuing work on Mappen, a geographic journal mobile app for a CMU 15-113 project. Phase 1 (scaffold + Supabase schema + RLS) is already complete. This is Phase 2.

Repo root: /Users/ivyweng/Documents/GitHub/Mappen

# Current state (already working, do not rebuild)

- Expo SDK 52 + React Native + TypeScript + Expo Router in `app/`
- Express backend in `server/` (used later; Phase 2 doesn't touch it)
- Supabase client wired up in `app/src/lib/supabase.ts`
- `.env` is populated with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- Supabase has 3 tables (profiles, entries, friendships), RLS enabled, handle_new_user trigger working
- `app/(tabs)/` currently has the default Expo welcome template — we'll replace it

# Phase 2 scope

Deliver three things:
1. Auth flow — email/password sign up and sign in, session persistence, sign out. Hand-rolled UI (no Supabase Auth UI component library).
2. Map screen — replaces the Home tab. Shows a map centered on the user's current location (or Pittsburgh as fallback), with pins for the signed-in user's own entries. Read-only.
3. Auth gate — unauthenticated users see the login screen; authenticated users see the map.

[...phases 2A, 2B, 2C as specified...]
```

### Phase 2B — disabled email confirmation for project

Auth flow relies on Supabase auto-signing-in new users immediately. Email confirmation turned off in Supabase → Authentication → Email provider (would otherwise block signUp flow since I'm using fake test emails).
In production this would be enabled + the app would show a "check your inbox" state after signup.

### Phase 2 — AsyncStorage native module error

After Phase 2B, testing on device produced 6 console errors all tracing to:
`AsyncStorageError: Native module is null, cannot access legacy storage`

Root cause: Phase 1 scaffold installed `@react-native-async-storage/async-storage` via `npm install`, which pulled the latest version rather than the version compatible with the current Expo SDK. The package's native module and JS bindings didn't line up.

Fix: `npx expo install @react-native-async-storage/async-storage` + `--clear` to rebuild Metro bundle.

Lesson: in Expo projects, Expo-managed deps (anything with a native module) must go through `npx expo install`, not plain `npm install`. This is a real tradeoff of the managed workflow — you trade raw dep control for version-compatibility guarantees.

## Phase 3 — New Entry screen (state machine scaffold)

### Prompt

```
Context: Mappen — Expo Router + TypeScript + Supabase geographic journal app. Phase 2 is complete: auth works, map screen shows pins from the `entries` table. Now building Phase 3 Step 1: the New Entry screen.

I've designed the state machine myself (6 states: idle, fetching_gps, gps_error, ready, submitting, submit_error, success). I will HAND-WRITE the state machine logic myself — do NOT write the reducer, the state transitions, or the effect that fetches GPS. I need that part for my oral exam.

Your job: write everything AROUND the state machine. Specifically:

1. Create `app/(tabs)/new-entry.tsx` as a new Expo Router route. Register it in the tab layout so it shows up as a tab between Map and (placeholder for Journal). Use a "plus.circle.fill" SF symbol for the icon with a MaterialIcons fallback for Android (follow the existing pattern in `icon-symbol.tsx`).

2. In `new-entry.tsx`, set up the file structure like this:
[...state machine scaffold as specified, with STATE MACHINE section explicitly marked as hand-written by me...]

3. Write a `renderScreen(state, dispatch)` function that handles ALL 7 state variants.
[...full render spec...]

4. For the submit logic stub, make sure the `entries` insert will include: user_id, latitude, longitude, title (null if empty string), body (null if empty string), visibility: 'private'.

5. Do NOT add photo upload, visibility picker, or friends-visibility option.

6. After writing the file, tell me:
  - The exact path of every file you created or modified
  - Any new package installs needed
  - Any TypeScript errors you see

Do not run the app — I'll do that after I fill in the state machine.
```

## Phase 3 — UI fixes and feature additions

### Prompt: Pin icon, confetti, detail bottom sheet, duplicate location warning

```
##Fixes
1. Even if i uploaded a picture the icon is still just a pin, i want something like apple album default (second picture) + name.
2. You see how after adding there is only a back to map option? I want another that says add another pin. I also want confetti after successfully adding a place.
3. The main page of 'map' currently only have that map and pins, I want 1/3 space at the bottom to be a pop up window after the user clicks on a pin, showing the name and text and the uploaded picture (that can be clicked and saved), working as a journal.
4. I want to add a warning note after submission at entry page if a user is at the same exact place (you can allow a difference range) where a previous entry have already been recorded. could be: ⚠️ Seems like you have already pinned this place...still proceed? y/n
5. Put a refresh location button on new entry page next to Longitude and latitude.
```

### Prompt: Photo upload bug fix

```
##Photo uploading bug
somehow I cannot seem to load the photos in map...and clicking on those places does not cause the details window to pop up either.
I can see the uploads in supabase, but they are all 0 bytes.
for an entry that does not have pictures, still give it a name and a red pin like in your previous version. the current version is only a blue dot, not friendly for users
```

### Prompt: Multiple image uploads + cover photo

```
##Image numbers
the current app only allow one image upload at a time--I would like it to enable multiple image uploads.
for the map pin front cover used image, default is the first picture uploaded, however enable user to edit cover image in the details tab
```

## Phase 4 — UI Redesign: Retro Constructivist

### Prompt

```
#UI Redesign (Artistic step)
Refine the current blue and white UI into a systematic, polished 'Retro Constructivist' design. The entire layout must be re-organized to feel deliberate, precise, and archivist-focused, balancing structured logic with high-character visuals.
Palette: Shift from the current palette to a rich, textured array of 'archivist' colors. Primary background should be warm beiges and natural cream. Accents must use deep hunter greens, rich ink reds, and precise graphite greys, all with slightly aged, high-quality print textures.
Typography: Use a combination of rigid, geometric sans-serif fonts for titles and interface elements (e.g., modern interpretations of Futura or Erbar Grotesk), and structured, readable serifs for the journaling content.
Layout: The entire UI must feel systematic and engineered. Prioritize a clear, stable grid. Break up standard container layouts with intersecting vertical and horizontal lines of precise width.
Visuals: Replace standard icons with schematic, blueprint-like illustrations. Any drawings (like maps or pin icons) must use clean lines with flat or simplified geometric coloring.
```

### Prompt: Keyboard avoiding view & header polish

```
##Technical Fix: Keyboard Avoiding View & Header Polish

Keyboard Handling:
Implement a KeyboardAvoidingView for the "Field Entry" sheet.
When the keyboard is active, the entire content area (Title, Notes, Photos) must be scrollable.
Ensure the text input being edited is automatically scrolled into view above the keyboard.

Header Button Consistency:
SAVE Button: solid Deep Green block with Beige text.
CANCEL Button: solid Red block with Beige text.
Alignment: Both buttons same height, aligned to far edges of top bar, 1px charcoal grid line underneath.

Input Field Refinement:
Title Field: underline thicker (2px), Charcoal color.
Notes Area: clear 1px Charcoal border.
Photo Grid: scrollable to "ADD PHOTO" section when keyboard is open.
```

## Phase 5 — Friends feature

### Prompt

```
Implement the Friends feature for Mappen. Here is the full spec:
Data model:
- profiles table has invite_code (unique, generated at signup)
- friendships table: (user_a uuid, user_b uuid, status text) with convention user_a < user_b to avoid duplicate rows

Backend (Express):
Add these endpoints:
- GET /api/friends — return accepted friends for current user
- POST /api/friends/request — body: { invite_code } — look up the user with that invite code, create a friendship row with status 'pending'
- POST /api/friends/accept — body: { user_id } — update friendship status to 'accepted'
- GET /api/friends/pending — return incoming pending requests

Frontend — Friends screen:
Match the existing app's 复古构成主义 visual style (cream background, dark green + dark red accents, monospaced uppercase labels).
Sections: "YOUR CODE", "ADD FRIEND", "PENDING", "FRIENDS"

Map integration:
When fetching entries for the map, also fetch accepted friends' entries where visibility = 'friends'. Show friend pins in a different color from own pins (own: dark green, friends: dark red).
All endpoints verify the JWT from the Authorization header. Do not change any existing screens or styling.
```

### Debug: FriendsScreen network request failed

```
[FriendsScreen] is throwing "Network request failed" on fetchFriendsData (friends.tsx:95). This is a network-level failure, not an HTTP error. Debug in this order:
1. Log the exact URL being fetched in fetchFriendsData right before the fetch call
2. Check that the base URL in the API config points to the correct Render backend URL (not localhost) when running on a physical device
3. Check that the /api/friends endpoint exists in the Express router and is mounted correctly
4. Check that the JWT from Supabase session is being attached as Authorization: Bearer <token>
Fix whichever of these is the root cause. Do not change any other behavior.
```

### Prompt: Visibility toggle + friend pins

```
#friend pins:
I need a visibility toggle on entry creation (and editing) — add a "Visible to friends / Private" control in new-entry.tsx so entries can be saved with visibility: 'friends'. Same in the edit sheet in index.tsx.
```

### Prompt: Remove Explore tab

```
#remove default Explore tab
Remove the Explore tab entirely from the bottom navigation. Delete or repurpose app/(tabs)/explore.tsx. The tab bar should now have 3 tabs: Map, New Entry, Friends. Do not change anything else.
```

## Phase 6 — Profile page + avatar system

### Prompt

```
#adding profile page
Create a Profile screen for Mappen. Add it as a 4th tab in the bottom nav with a person icon.
Avatar system:
- User picks one emoji from a preset list and one background color from a preset palette
- Avatar = colored circle with emoji centered inside
- Save avatar_emoji and avatar_color to the profiles table in Supabase via PATCH /api/profile
- Load on mount via GET /api/profile

Profile screen layout (match existing 复古构成主义 style):
- Large avatar display at top, tap to edit
- Username display (read-only, set at signup)
- Emoji picker row (horizontally scrollable)
- Color picker row (color swatches)
- SAVE button
- SIGN OUT button (move it here from the map screen)

Friends page integration:
- Each friend row should show their avatar (colored circle + emoji) and username
- If a friend has no avatar set yet, show a grey circle with a ?

Backend: Add avatar_emoji and avatar_color columns to profiles, then add GET /api/profile and PATCH /api/profile endpoints.
```

### Prompt: Color palette update

```
##Colors modification
Replace the avatar color palette in the Profile screen with these pastel colors:
#F2A7BB, #B8D0E8, #A8DDD1, #E8A48C, #5B8F8A, #9B7BBF, #2E5490, #7D2340, #E87878, #8DC56A, #9E8880, #8B6BAE, #F0EFA0, #9B9BC8, #C47890
Replace the existing color array with exactly these 15 values. Do not change anything else.
```

## Phase 7 — Detail tab modifications

### Prompt

```
##Detail tab modification
A couple of fixes focusing on map page details tab:
1. Remove the Cover indicator on the photo in a friend's tab.
2. Add friend's Avatar and name in the detail tab if they are the owner of it.
3. Currently, for a user's own pin, If you edit and add a photo you wouldn't be able to directly set it as the cover (SET indicator is not there) and it would appear if the user save one time and reopen edit. I would like the SET indicator to appear as soon as a picture is added.
```
