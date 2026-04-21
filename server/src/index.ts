import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const app = express();

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Supabase setup
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

// Create a user-scoped Supabase client that respects the caller's RLS context.
function makeUserClient(token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

interface AuthRequest extends express.Request {
  userId?: string;
  accessToken?: string;
}

async function requireAuth(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  const raw = req.headers.authorization;
  const token = raw?.startsWith('Bearer ') ? raw.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  // Verify the JWT by asking Supabase Auth who this token belongs to.
  const verifier = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  const { data: { user }, error } = await verifier.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.userId = user.id;
  req.accessToken = token;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/friends  — accepted friends (with username + invite_code)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/friends', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const client = makeUserClient(req.accessToken!);

  const { data: friendships, error: fErr } = await client
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('status', 'accepted');

  if (fErr) {
    res.status(500).json({ error: fErr.message });
    return;
  }

  const friendIds = (friendships ?? []).map((f) =>
    f.user_a === userId ? f.user_b : f.user_a,
  );

  if (friendIds.length === 0) {
    res.json([]);
    return;
  }

  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, username, invite_code')
    .in('id', friendIds);

  if (pErr) {
    res.status(500).json({ error: pErr.message });
    return;
  }

  res.json(profiles ?? []);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/friends/request  — body: { invite_code }
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/friends/request', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { invite_code } = req.body as { invite_code?: string };

  if (!invite_code) {
    res.status(400).json({ error: 'invite_code is required' });
    return;
  }

  const client = makeUserClient(req.accessToken!);

  // Find target user by invite code.
  const { data: target, error: tErr } = await client
    .from('profiles')
    .select('id, username')
    .eq('invite_code', invite_code.trim())
    .maybeSingle();

  if (tErr) {
    res.status(500).json({ error: tErr.message });
    return;
  }
  if (!target) {
    res.status(404).json({ error: 'Invite code not found' });
    return;
  }
  if (target.id === userId) {
    res.status(400).json({ error: 'Cannot add yourself' });
    return;
  }

  // Canonical ordering: user_a < user_b.
  const user_a = userId < target.id ? userId : target.id;
  const user_b = userId < target.id ? target.id : userId;

  // Check if a friendship row already exists.
  const { data: existing } = await client
    .from('friendships')
    .select('status')
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .maybeSingle();

  if (existing) {
    res.status(409).json({
      error:
        existing.status === 'accepted'
          ? 'Already friends'
          : 'Friend request already sent',
    });
    return;
  }

  const { error: iErr } = await client
    .from('friendships')
    .insert({ user_a, user_b, status: 'pending', requester_id: userId });

  if (iErr) {
    res.status(500).json({ error: iErr.message });
    return;
  }

  res.json({ ok: true, message: `Friend request sent to ${target.username}` });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/friends/accept  — body: { user_id }  (the requester's user_id)
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/friends/accept', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { user_id: requesterId } = req.body as { user_id?: string };

  if (!requesterId) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }

  const client = makeUserClient(req.accessToken!);

  const user_a = userId < requesterId ? userId : requesterId;
  const user_b = userId < requesterId ? requesterId : userId;

  const { data, error } = await client
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .eq('status', 'pending')
    .eq('requester_id', requesterId)
    .select();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data || data.length === 0) {
    res.status(404).json({ error: 'Pending request not found' });
    return;
  }

  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/friends/pending  — incoming requests (sent to me, not yet accepted)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/friends/pending', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const client = makeUserClient(req.accessToken!);

  const { data: pending, error: fErr } = await client
    .from('friendships')
    .select('requester_id')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('status', 'pending')
    .neq('requester_id', userId);

  if (fErr) {
    res.status(500).json({ error: fErr.message });
    return;
  }

  if (!pending || pending.length === 0) {
    res.json([]);
    return;
  }

  const requesterIds = pending.map((f) => f.requester_id);

  const { data: profiles, error: pErr } = await client
    .from('profiles')
    .select('id, username')
    .in('id', requesterIds);

  if (pErr) {
    res.status(500).json({ error: pErr.message });
    return;
  }

  res.json(profiles ?? []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
