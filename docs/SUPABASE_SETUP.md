# Supabase Setup Guide

> **Do not run any SQL here until you have completed the Prerequisites.**
> All SQL in this doc is meant to be pasted into the Supabase SQL Editor, not executed by any script.

---

## Prerequisites

Before touching the SQL Editor, confirm the following:

1. **Supabase project created** — you have a project in [supabase.com/dashboard](https://supabase.com/dashboard) and it is in the "Active" (green) state.
2. **API keys saved** — from **Project Settings → API**, copy and keep in a secure place:
   - `SUPABASE_URL` (looks like `https://<ref>.supabase.co`)
   - **Publishable key** (`anon`, `public`) → goes in `app/.env` as `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`service_role`) → goes in `server/.env` as `SUPABASE_SECRET_KEY`. **Never expose this on the client.**
3. **`citext` extension enabled** — the schema below uses `citext` for case-insensitive usernames. Enable it first:
   - Go to **Database → Extensions**, search for `citext`, and toggle it on.
   - Or run `CREATE EXTENSION IF NOT EXISTS citext;` at the very top of the Step 1 SQL block before pasting the rest. The block below already includes this line.

---

## Step 1: Schema

> Paste this entire block into **SQL Editor → New query** and click **Run**.
> The `citext` extension line is idempotent — safe to run more than once.

```sql
-- ============================================================
-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- 1. profiles
--    One row per auth user, auto-created by trigger below.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    citext      NOT NULL UNIQUE,
  invite_code text        NOT NULL UNIQUE CHECK (char_length(invite_code) = 8),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. entries
--    A journal entry pinned to a GPS location.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entries (
  id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude      double precision  NOT NULL,
  longitude     double precision  NOT NULL,
  location_name text,
  photo_url     text,
  title         text,
  body          text,
  visibility    text              NOT NULL DEFAULT 'private'
                                  CHECK (visibility IN ('private', 'friends')),
  created_at    timestamptz       NOT NULL DEFAULT now(),
  updated_at    timestamptz       NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS entries_user_created_idx
  ON public.entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS entries_latlon_idx
  ON public.entries (latitude, longitude);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entries_set_updated_at ON public.entries;
CREATE TRIGGER entries_set_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. friendships
--    Canonical row always has user_a < user_b (uuid ordering).
--    This eliminates duplicate-direction rows at the DB level.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friendships (
  user_a     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)   -- enforce canonical ordering
);

-- ============================================================
-- 4. Auto-create a profiles row when a new auth user signs up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, invite_code)
  VALUES (
    NEW.id,
    'user_' || substr(NEW.id::text, 1, 8) || '_' || substr(md5(random()::text), 1, 4),
    substr(md5(random()::text), 1, 8)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Step 2: RLS Policies

> Open a **new** SQL Editor tab, paste this block, and click **Run**.
> Do **not** combine this with Step 1 — running them separately makes it easier to debug if one fails.

```sql
-- ============================================================
-- Enable RLS on all three tables
-- ============================================================
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles policies
-- ============================================================

-- Any authenticated user can look up any profile.
-- Needed so users can find each other by invite code.
CREATE POLICY "profiles: authenticated users can read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- A user can only update their own profile row.
CREATE POLICY "profiles: users update own row"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- entries policies
-- ============================================================

-- SELECT: own entries, or friends-only entries where a
-- confirmed friendship exists (respecting user_a < user_b).
CREATE POLICY "entries: read own or accepted-friend entries"
  ON public.entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'accepted'
          AND f.user_a = LEAST(public.entries.user_id, auth.uid())
          AND f.user_b = GREATEST(public.entries.user_id, auth.uid())
      )
    )
  );

-- INSERT: the new row's user_id must match the signed-in user.
CREATE POLICY "entries: insert own"
  ON public.entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: only the owner can edit their entry.
CREATE POLICY "entries: update own"
  ON public.entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: only the owner can delete their entry.
CREATE POLICY "entries: delete own"
  ON public.entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- friendships policies
-- ============================================================

-- SELECT: visible to either party in the friendship.
CREATE POLICY "friendships: parties can read"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() IN (user_a, user_b));

-- INSERT: the requesting user must be one of the two parties.
-- The CHECK (user_a < user_b) table constraint still enforces
-- canonical ordering — the app is responsible for sorting before insert.
CREATE POLICY "friendships: parties can insert"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (user_a, user_b));

-- UPDATE: either party can update (e.g., accepting a request).
CREATE POLICY "friendships: parties can update"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (user_a, user_b))
  WITH CHECK (auth.uid() IN (user_a, user_b));
```

---

## Step 3: Verification Queries

Run these in the SQL Editor to confirm the setup is working. They are read-only checks except for the test user creation.

**3a — Confirm tables and RLS exist**
```sql
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'entries', 'friendships')
ORDER BY tablename;
-- Expected: 3 rows, rowsecurity = true for all
```

**3b — Confirm the profiles trigger exists**
```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
   OR event_object_schema = 'auth'
ORDER BY trigger_name;
-- Expected: on_auth_user_created on auth.users (AFTER INSERT)
--           entries_set_updated_at on public.entries (BEFORE UPDATE)
```

**3c — Sign up a test user and check that a profiles row was auto-created**
> Do this via the Supabase **Authentication → Users → Invite / Add user** UI, or via your app's sign-up flow.
> Then verify with:
```sql
SELECT id, username, invite_code, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;
-- Expected: the new user appears with a generated username like 'user_a1b2c3d4'
-- and an 8-character invite_code
```

**3d — Confirm RLS blocks anonymous access**
```sql
-- Switch the SQL Editor's "Role" dropdown (top right) to "anon", then run:
SELECT * FROM public.profiles;
-- Expected: 0 rows (RLS blocks anon reads on profiles)

SELECT * FROM public.entries;
-- Expected: 0 rows

SELECT * FROM public.friendships;
-- Expected: 0 rows
```
> Switch the Role back to `postgres` (service role) after verifying.

---

## Why These Design Choices

*(For oral exam prep — written by the developer, not the AI.)*

**Why RLS instead of filtering in the client?**
Client-side filtering is untrustworthy: a malicious or buggy client can simply omit the `WHERE user_id = ...` clause and read data it shouldn't. RLS enforces access rules inside Postgres itself, so no matter what query the client sends, the database engine silently filters rows before returning them. The secret key used by the server can bypass RLS when needed (e.g., admin operations), but the publishable key used by the app cannot.

**Why the `user_a < user_b` convention on friendships?**
Without it, a friendship between Alice and Bob could be stored as `(alice, bob)` or `(bob, alice)` — two logically identical relationships requiring two rows and a `UNION` on every lookup. The `CHECK (user_a < user_b)` constraint collapses that ambiguity: there is exactly one canonical row per pair, UUIDs are totally ordered, and lookups only need `LEAST()/GREATEST()` rather than `OR`-branching queries.

**Why `invite_code` lives on `profiles`?**
An invite code is an attribute of the user, not of a specific friendship request. Storing it on `profiles` lets a user share one persistent code with anyone; the recipient can look up the profile by code and initiate a friend request. If the code lived on a separate invite table, you'd need to manage expiry, single-use logic, and cleanup — unnecessary complexity for a social graph at this scale.
