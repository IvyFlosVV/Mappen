# Mappen

A geographic journal phone app for iOS and Android. Pin memories to the places they happened — privately, or shared with friends.

> *Where things happen, mapped.*

Built for CMU 15-113 Project 3 with Expo, React Native, Express, and Supabase.

---

## What it does

Mappen is a journal where every entry is anchored to a physical location. When you create an entry, the app captures your current GPS coordinates and locks them in — you can edit the photo, title, body, and timestamp later, but **not** the location. This design choice keeps the map honest: an "I was here" pin always means you were actually there.

The app has two complementary views of the same data:

- **Map view** — spatial. Pins scattered across the world, each one a memory.
- **Journal view** — chronological. A reverse-time list of everything you've pinned.

Entries can be empty ("I was here" pins with no photo or text), photo-only, text-only, or full. Each entry has a visibility setting: **private** (only you) or **friends-only** (you and your accepted friends). There is no public feed — no moderation, no strangers, no algorithm.

Friends are added via **invite codes**. Each user gets a short unique code on signup; you exchange codes to send/accept friend requests. Accepted friends' entries appear as pins of a different color on your map.

---

## Features

- Sign up / sign in with email (Supabase Auth)
- Create an entry at your current GPS location with optional photo + title + body
- Private or friends-only visibility, set per entry
- Map view with own pins and friend pins (color-coded)
- Chronological journal view with edit and delete
- Friends system: invite code display, incoming request queue, accept/reject, accepted friends list
- Works end-to-end on a physical iPhone via Expo Go

---

## Architecture

```
┌──────────────────────────┐
│  Expo / React Native app │   ← runs on physical phone via Expo Go
│  (app/)                  │
└────────────┬─────────────┘
             │
             │  HTTPS (JWT in Authorization header)
             │
             ▼
┌──────────────────────────┐
│  Express + TypeScript    │   ← deployed on Render
│  (server/)               │
└────────────┬─────────────┘
             │
             │  Supabase service key
             │
             ▼
┌──────────────────────────┐
│  Supabase                │
│  • Postgres (+ RLS)      │
│  • Storage (photos)      │
│  • Auth (email/password) │
└──────────────────────────┘
```

**Project 3 requirements hit (≥ 2 required):**

1. Frontend ↔ backend communication (Expo app → Express on Render)
2. Thoughtful third-party API usage with secure keys (Supabase, Expo Location, Expo Image Picker)
3. Use of a database (Postgres via Supabase, with row-level security)
4. Runs on a physical phone (Expo SDK 54, tested on iPhone via Expo Go)

### Data model

Three tables in Supabase Postgres:

- **`profiles`** — `id`, `username`, `invite_code`. Row created automatically on signup via a `handle_new_user()` trigger.
- **`entries`** — `id`, `user_id`, `latitude`, `longitude`, `location_name`, `photo_url`, `title`, `body`, `visibility ('private' | 'friends')`, `created_at` (editable), `updated_at`.
- **`friendships`** — `user_a`, `user_b`, `status ('pending' | 'accepted')`. Enforces the invariant `user_a < user_b` to prevent duplicate rows for the same pair.

### Design choices worth calling out

- **Visibility is enforced at the database layer via Row-Level Security**, not in application code. Even if a bug slipped into the Express server, Postgres itself would refuse to return entries the user isn't authorized to see. Defense in depth.
- **GPS is locked at creation, not editable.** Editing the location would break the app's core promise. Text and photos represent what *happened*; coordinates represent *where* — and "where" shouldn't be rewritable.
- **Entry creation runs on a hand-written finite state machine** (9 states, 14 action types) rather than a tangle of `useState` booleans. It makes impossible states unrepresentable — you cannot be simultaneously `uploading_photo` and `submit_failed`, for example — and it's the substantial hand-written core of the codebase.
- **The `user_a < user_b` friendship convention** means the pair {Alice, Bob} is stored as exactly one row regardless of who initiated, avoiding duplicate-row bugs in both writes and reads.
- **Dual views of the same data (map + journal)** treat location as a first-class axis alongside time. Apple Photos and WeChat Moments are chronological-only; Mappen's map view exists because "where you were" is sometimes more memorable than "when."

---

## Repo layout

```
Mappen/
├── app/                 # Expo / React Native frontend
│   ├── app/             # Expo Router screens (map, new, detail, journal, friends, auth)
│   ├── components/
│   ├── utils/supabase.ts
│   └── .env             # EXPO_PUBLIC_* (gitignored)
├── server/              # Express + TypeScript backend
│   ├── src/index.ts     # entry point
│   └── .env             # SUPABASE_URL, SUPABASE_SECRET_KEY (gitignored)
├── docs/
│   └── SUPABASE_SETUP.md
├── README.md            # you are here
├── PROMPT_LOG.md        # verbatim Cursor prompts + outcomes
└── REFLECTION.md        # process reflection (written by hand, no AI)
```

---

## Running it locally

### Prerequisites

- Node 20+
- Expo Go on a physical iPhone (iOS) or Android device
- A Supabase project (free tier is fine)
- Phone and laptop on the same Wi-Fi network

### 1. Clone and install

```bash
git clone https://github.com/IvyFlosVV/Mappen.git
cd Mappen
cd app && npm install
cd ../server && npm install
```

### 2. Set up Supabase

Follow `docs/SUPABASE_SETUP.md` — it contains the full schema, RLS policies, and the `handle_new_user()` trigger as a single SQL block to paste into the Supabase SQL Editor.

Make sure you:

- Disable email confirmation under **Authentication → Providers → Email** (otherwise sign-up flow blocks on an email that never arrives)
- Grab your project's **publishable key** and **secret key** — these go in the `.env` files below

### 3. Create `.env` files

**`app/.env`** (frontend — `EXPO_PUBLIC_` is an Expo convention that exposes vars to the client bundle):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_API_URL=http://localhost:3000
```

For testing on a physical phone, replace `localhost` with your laptop's LAN IP (e.g. `http://192.168.1.42:3000`) or with the deployed Render URL (see Deployment below).

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

You should see `listening on :3000`. Verify with:

```bash
curl http://localhost:3000/health
# → {"ok":true,"ts":"..."}
```

In a second terminal:

```bash
cd app && npx expo start
```

Scan the QR code with the Expo Go app on your phone.

---

## Deployment

### Backend (Render)

- **Root Directory:** `server`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variables:** `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (Render injects `PORT` automatically)

The `build` script runs `tsc` to compile TypeScript into `dist/`, which `start` then runs with plain Node. Render's free tier spins down after 15 minutes of inactivity — the first request after spin-down takes ~30 seconds.

### Frontend

The Expo app isn't "deployed" in the web sense. It runs on a physical phone via Expo Go. To share it with someone else's phone, either publish with `eas update` or have them scan your Expo Go QR code.

---

## Secrets

Secrets are never committed. Three kinds exist:

| Secret | Lives in | Safe to commit? |
|---|---|---|
| Supabase **publishable key** (`sb_publishable_…`) | `app/.env` | No — it's designed to be safe in client code, but still gitignored to avoid churn on rotation |
| Supabase **secret key** (`sb_secret_…`) | `server/.env` (local) + Render dashboard | **Absolutely not** — full admin access to the database |
| `EXPO_PUBLIC_API_URL` | `app/.env` | No — it's not sensitive but lives alongside the keys |

Both `.env` files are listed in `.gitignore`. Example templates are in `app/.env.example` and `server/.env.example`.

---

## What I wrote vs. what AI helped with

I used **Cursor Pro in agent mode** (Claude Sonnet 4) for scaffolding, JSX render functions, and styling. I **hand-wrote** the core logic I need to be able to defend in an oral exam:

- The entry-creation finite state machine (reducer + types) in `app/app/new.tsx`
- The two `useEffect` hooks that wire the reducer to GPS fetch and Supabase writes
- The Supabase schema and RLS policies

Details — including verbatim Cursor prompts, decisions that were revisited, and bugs fixed — are in `PROMPT_LOG.md`. My personal reflection on the process (written entirely by hand) is in `REFLECTION.md`.

---

## Acknowledgments

- **CMU 15-113 Effective Coding with AI** — project framing and the constraint to write substantial code by hand
- **Supabase** — auth, Postgres, storage, and RLS all in one
- **Expo** — the only reason a solo ~8-hour project can ship to a real phone
