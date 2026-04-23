# Mappen

A geographic journal phone app for iOS and Android. Pin memories to the places they happened — privately, or shared with friends.

> *Where things happen, mapped.*

**Author:** Ivy Weng
**Course:** Carnegie Mellon 15-113, Effective Coding with AI — Project 3
**Stack:** Expo / React Native · Express · Supabase · react-native-maps

---

## Table of contents

1. [What the project does](#what-the-project-does)
2. [How to use it](#how-to-use-it)
3. [Features I'm most proud of](#features-im-most-proud-of)
4. [How to run it locally](#how-to-run-it-locally)
5. [How secrets are handled](#how-secrets-are-handled)
6. [Architecture](#architecture)
7. [What I wrote vs. what AI helped with](#what-i-wrote-vs-what-ai-helped-with)
8. [Project 3 requirements](#project-3-requirements)

---

## What the project does

Mappen is a journal where every entry is anchored to a physical location. When you create an entry, the app captures your current GPS coordinates and **locks** them in — you can edit the photo, title, body, and timestamp later, but **not** the location. This keeps the map honest: an "I was here" pin always means you were actually there.

The app has two complementary views of the same data:

- **Map view** — spatial. Pins scattered across the world, each one a memory.
- **Journal view** — chronological. A reverse-time list of everything you've pinned.

Entries can be blank ("I was here" pins with no photo or text), photo-only, text-only, or full. Each entry has a visibility setting: **private** (only you) or **friends-only** (you and your accepted friends). There is no public feed — no moderation, no strangers, no algorithm.

Friends are added via **invite codes**. Each user gets a short unique code on signup; friends exchange codes to send and accept friend requests. Accepted friends' friends-only entries appear as pins of a different color on your map.

---

## How to use it

1. Sign up with an email and password. A profile with a unique invite code is created automatically.
2. Open the **map** tab. Tap the floating **+** to create an entry at your current location.
3. On the new-entry screen, optionally attach a photo and/or a title and body. Pick **private** or **friends-only**. Submit.
4. Tap any pin on the map to view the entry. You can edit or delete your own entries.
5. Use the **journal** tab to read your entries chronologically.
6. Open the **friends** tab to find your invite code and paste a friend's code to send a request. Pending requests appear on the recipient's friends tab; once accepted, the friend's friends-only pins appear on your map (in a different color from your own).

---

## Features I'm most proud of

**GPS-locked entries.** When an entry is created, coordinates are captured and never allowed to change — not by the user, not by the edit screen, not by any client code. Editing the location would break the app's core promise, so the schema and UI simply don't expose that path.

**Visibility enforced at the database layer.** Private/friends-only filtering is implemented as Supabase **row-level security policies** — so the Postgres layer itself refuses to return entries the viewer isn't authorized to see. The Express server couldn't leak data even if a buggy query tried. Defense in depth, not application-layer hope.

**Hand-written finite state machine for entry creation.** The new-entry flow has nine distinct states (`idle`, `fetching_gps`, `gps_failed`, `ready`, `picking_photo`, `uploading_photo`, `submitting`, `submit_failed`, `done`) and fourteen action types, all in a discriminated-union TypeScript reducer I wrote and debugged by hand. This prevents the whole class of "impossible UI" bugs you get when you try to model a workflow like this with five or six `useState` booleans.

**Dual map + journal views.** Apple Photos and WeChat Moments both have location metadata but are chronological-only. Mappen treats *where* as a first-class axis alongside *when*, on the premise that place is sometimes more memorable than time.

**Friendship schema invariant.** The `friendships` table enforces `user_a < user_b` as a rule, so the pair {Alice, Bob} is stored as exactly one row regardless of who initiated the request. This makes both writes and lookups duplicate-free without any application-level deduplication.

---

## How to run it locally

### Prerequisites

- Node 20+
- **Expo Go** installed on a physical iPhone or Android device
- A Supabase project (free tier is sufficient)
- Phone and laptop on the same Wi-Fi network (for local dev) — or skip this and use the deployed Render backend

### 1. Clone and install

```bash
git clone https://github.com/IvyFlosVV/Mappen.git
cd Mappen
cd app && npm install
cd ../server && npm install
```

### 2. Set up Supabase

Follow [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md). It contains the full schema, RLS policies, and the `handle_new_user()` trigger as a single SQL block to paste into the Supabase SQL Editor.

Also, in the Supabase dashboard:

- **Authentication → Providers → Email**: disable the email-confirmation requirement. Otherwise sign-up blocks on an email that never arrives.

### 3. Create `.env` files

**`app/.env`** (frontend — `EXPO_PUBLIC_` is the Expo convention for client-bundled vars):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:3000
```

For testing on a physical phone, `localhost` won't work — use your laptop's LAN IP (e.g. `http://192.168.1.42:3000`) or the deployed Render URL.

**`server/.env`** (backend — never prefixed with `EXPO_PUBLIC_`, never bundled into the client):

```
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxx
```

### 4. Start both services

In one terminal:

```bash
cd server && npm run dev
```

You should see the server listening on port 3000. Verify:

```bash
curl http://localhost:3000/health
# → {"ok":true,"ts":"..."}
```

In a second terminal:

```bash
cd app && npx expo start
```

Scan the QR code with Expo Go on your phone.

### Deployment

The backend is deployed on Render (free tier):

- **Root Directory:** `server`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variables:** `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (Render injects `PORT` automatically)

Render's free tier spins down after 15 minutes of inactivity — the first request after spin-down takes ~30 seconds to wake the dyno.

The frontend isn't "deployed" in the web sense — Expo/React Native apps run on a physical phone via Expo Go. To test on someone else's phone, they install Expo Go and scan my dev server's QR code.

---

## How secrets are handled

No secret is ever committed to the repo. Three kinds exist:

| Secret | Lives in | Committed? | Why |
|---|---|---|---|
| Supabase **publishable key** (`sb_publishable_…`) | `app/.env` | No | Designed to be safe in client code, but gitignored so rotation doesn't churn the repo |
| Supabase **secret key** (`sb_secret_…`) | `server/.env` locally, Render dashboard in production | **Never** | Grants full admin access to the database, bypassing RLS |
| `EXPO_PUBLIC_API_URL` | `app/.env` | No | Not sensitive, but lives alongside the keys |

Both `.env` files are listed in `.gitignore`. Example templates with blank values are committed as `app/.env.example` and `server/.env.example`.

The publishable key was accidentally exposed once in a chat during development and was rotated immediately via the Supabase dashboard. That incident is documented in `PROMPT_LOG.md`.

---

## Architecture

```
┌──────────────────────────┐
│  Expo / React Native app │   ← runs on a physical phone via Expo Go
│  (app/)                  │
└────────────┬─────────────┘
             │
             │  HTTPS (Supabase JWT in Authorization header)
             │
             ▼
┌──────────────────────────┐
│  Express + TypeScript    │   ← deployed on Render
│  (server/)               │
└────────────┬─────────────┘
             │
             │  Supabase service-role key (never leaves the server)
             │
             ▼
┌──────────────────────────┐
│  Supabase                │
│  • Postgres (+ RLS)      │
│  • Storage (photos)      │
│  • Auth (email/password) │
└──────────────────────────┘
```

### Data model

Three tables in Supabase Postgres:

- **`profiles`** — `id`, `username`, `invite_code`. A row is created automatically on signup by the `handle_new_user()` trigger, which appends a 4-character random suffix to avoid username collisions.
- **`entries`** — `id`, `user_id`, `latitude`, `longitude`, `location_name`, `photo_url`, `title`, `body`, `visibility ('private' | 'friends')`, `created_at` (editable), `updated_at`.
- **`friendships`** — `user_a`, `user_b`, `status ('pending' | 'accepted')`. Enforces `user_a < user_b` so each pair is stored exactly once regardless of who initiated the request.

### Repo layout

```
Mappen/
├── app/                 # Expo / React Native frontend
│   ├── app/             # Expo Router screens (map, new, detail, journal, friends, auth)
│   ├── components/
│   ├── utils/supabase.ts
│   └── .env.example
├── server/              # Express + TypeScript backend
│   ├── src/index.ts     # entry point; routes live here
│   └── .env.example
├── docs/
│   └── SUPABASE_SETUP.md
├── README.md            # you are here
├── PROMPT_LOG.md        # verbatim Cursor prompts + outcomes
└── REFLECTION.md        # process reflection, hand-written (no AI)
```

---

## What I wrote vs. what AI helped with

Per the assignment's requirement that I *"substantially modify or write from scratch"* at least one meaningful part of the code, this section names the split explicitly.

**AI-assisted (Cursor Pro agent mode, Claude Sonnet 4):**
- Initial Expo scaffolding and Expo Router setup
- JSX render functions and React Native stylesheets
- Express route handlers for friend-request flow and entry CRUD (after I specified the endpoints)
- Deployment troubleshooting (Render build config, TypeScript → JS compilation)

**Written by hand:**
- The entry-creation **finite state machine**: reducer + TypeScript discriminated-union action types in `app/app/new.tsx`. 9 states, 14 actions. Debugged several TypeScript narrowing bugs (spread syntax is invalid when changing the discriminant `status` field — fields must be listed explicitly).
- The two `useEffect` hooks that subscribe to the reducer state and perform side effects (GPS fetch on mount, Supabase insert on `status === 'submitting'`). The reducer declares intent; the effects execute it. Navigation side effects like `router.back()` live in the effect, never in the reducer.
- The Supabase **schema and RLS policies**, including the `handle_new_user()` trigger and the `user_a < user_b` friendship invariant.

The rationale behind each of these hand-written pieces — and the bugs I introduced and fixed along the way — is documented in [`PROMPT_LOG.md`](./PROMPT_LOG.md) (for Cursor sessions) and [`REFLECTION.md`](./REFLECTION.md) (for my personal write-up).

---

## Project 3 requirements

The project satisfies four of the "at least two" technical requirements from the assignment brief:

1. **Frontend ↔ backend communication** — Expo app talks to Express on Render over HTTPS with JWT auth.
2. **Thoughtful third-party API usage with secure keys** — Supabase (with the secret key held server-side only), Expo Location, Expo Image Picker.
3. **Use of a database** — Postgres via Supabase, with row-level security policies as the authoritative visibility filter.
4. **Runs on a physical phone** — Expo SDK 54, tested end-to-end on iPhone via Expo Go.

Deliverables (all in repo root):

- `README.md` — this file
- `PROMPT_LOG.md` — verbatim Cursor prompts used during development, with outcomes
- `REFLECTION.md` — hand-written process reflection

A short demo video and portfolio link are submitted separately via the Project 3 Google form.

---

## Acknowledgments

- **CMU 15-113 Effective Coding with AI** — project framing and the constraint to write substantial code by hand
- **Supabase** — auth, Postgres, storage, and RLS in one service
- **Expo** — the reason a solo ~8-hour project can ship to a real phone at all
