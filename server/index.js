import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const app = express();
const PORT = process.env.API_PORT || 3001;
// Ensure JSON bodies are parsed for all routes (must come before route definitions)
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(cookieParser());

// Basic error handler for payload too large
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'file_too_large', max: '10MB' });
  }
  return next(err);
});

// (moved ensure table logic below, after pool is defined)

// Voting lock helpers
function isVotingLockedNow() {
  const flag = String(process.env.VOTING_LOCKED || '').toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  const deadline = process.env.VOTING_DEADLINE ? Date.parse(process.env.VOTING_DEADLINE) : NaN;
  if (!Number.isNaN(deadline)) return Date.now() >= deadline;
  return false;
}

// ===== MySQL Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fantasy_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

// Data URL (base64) upload endpoint: { email, dataUrl }
app.post('/api/profile-avatars/from-dataurl', async (req, res) => {
  try {
    const { email, dataUrl } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_email' });
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: 'invalid_data_url' });
    }
    const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'invalid_base64' });
    const mime = match[1] || 'image/png';
    const b64 = match[2] || '';
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'empty_image' });
    if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'file_too_large', max: '10MB' });
    const user = await ensureUserByEmail(email);
    if (!user?.id) return res.status(500).json({ error: 'user_create_failed' });
    let ext = 'png';
    if (/jpeg/.test(mime)) ext = 'jpg';
    else if (/png/.test(mime)) ext = 'png';
    else if (/webp/.test(mime)) ext = 'webp';
    const fileName = `${Date.now()}_${user.id}.${ext}`;
    const filePath = path.join(avatarsDir, fileName);
    fs.writeFileSync(filePath, buf);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/avatars/${fileName}`;
    try {
      await pool.query('UPDATE profile_avatars SET is_active = 0 WHERE user_id = ?', [user.id]);
      const [ins] = await pool.query(
        'INSERT INTO profile_avatars (user_id, url, storage_path, is_active) VALUES (?, ?, ?, 1)',
        [user.id, url, `local:${fileName}`]
      );
      return res.status(201).json({ success: true, url, id: ins.insertId });
    } catch (dbErr) {
      console.error('avatar upload-form: DB insert failed, returning URL anyway', dbErr);
      return res.status(201).json({ success: true, url, warning: 'db_insert_failed' });
    }
  } catch (e) {
    console.error('POST /api/profile-avatars/from-dataurl error', e);
    return res.status(500).json({ error: 'avatar_upload_error', message: e?.message || e?.code || 'unknown' });
  }
});

// Utility: ensure user exists by email, returns { id, email, username }
async function ensureUserByEmail(email, usernameFallback) {
  if (!email) return null;
  const [rows] = await pool.query('SELECT id, email, username FROM users WHERE email = ? LIMIT 1', [email]);
  if (Array.isArray(rows) && rows.length > 0) return rows[0];
  const safeNameBase = (usernameFallback ?? email.split('@')[0] ?? 'user').toString().trim() || 'user';
  const safeUsername = safeNameBase.slice(0, 50);
  const hashed = await bcrypt.hash(Math.random().toString(36).slice(2) + Date.now(), 10);
  const [ins] = await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [safeUsername, email, hashed]);
  return { id: ins.insertId, email, username: safeUsername };
}

// Fallback: upload audio via JSON base64
app.post('/api/groups/:id/messages/audio-b64', authMiddleware, express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const { data, ext: rawExt } = req.body || {};
    const ext = String(rawExt || 'webm').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'webm';
    if (!groupId || !data || typeof data !== 'string') return res.status(400).json({ error: 'missing_audio' });
    // only members can post
    const [m2] = await pool.query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, req.user.id]);
    if (!Array.isArray(m2) || m2.length === 0) return res.status(403).json({ error: 'not_group_member' });
    // support data URLs and raw base64
    const commaIdx = data.indexOf(',');
    const base64Str = commaIdx >= 0 ? data.slice(commaIdx + 1) : data;
    const buf = Buffer.from(base64Str, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'empty_audio' });
    const fileName = `${Date.now()}_${req.user.id}.${ext}`;
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, buf);
    console.log('[audio-b64] saved', { fileName, bytes: buf.length });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/audio/${fileName}`;
    await pool.query('INSERT INTO messages (group_id, user_id, content) VALUES (?, ?, ?)', [groupId, req.user.id, url]);
    return res.status(201).json({ success: true, url });
  } catch (e) {
    console.error('POST /api/groups/:id/messages/audio-b64 error', e);
    return res.status(500).json({ error: 'audio_upload_error', message: e?.message });
  }
});

// ===== User score history: GET /api/user/scores?email=...&group_id=optional
app.get('/api/user/scores', async (req, res) => {
  try {
    const email = req.query.email;
    const groupId = req.query.group_id ? Number(req.query.group_id) : null;
    if (!email) return res.status(400).json({ error: 'missing_email' });
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const userId = rows[0].id;
    let sql = 'SELECT us.id, us.group_id, us.round_number, us.round_points, us.total_points, us.created_at, g.name AS group_name FROM user_scores us LEFT JOIN `groups` g ON g.id = us.group_id WHERE us.user_id = ?';
    const params = [userId];
    if (groupId) { sql += ' AND us.group_id = ?'; params.push(groupId); }
    sql += ' ORDER BY us.round_number ASC, us.created_at ASC';
    const [scores] = await pool.query(sql, params);
    return res.json({ scores });
  } catch (e) {
    console.error('GET /api/user/scores error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// ===== League Winner Votes (MySQL REST) — matches fantasy_db.sql schema
// Get vote by email
app.get('/api/votes/league-winner', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'missing_email' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const userId = rows[0].id;
    const [votes] = await pool.query('SELECT id, team_name, voted_at FROM league_winner_votes WHERE user_id = ? LIMIT 1', [userId]);
    if (!Array.isArray(votes) || votes.length === 0) return res.json({ vote: null });
    return res.json({ vote: votes[0] });
  } catch (e) {
    console.error('GET /api/votes/league-winner error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// Create vote once per user (unique user_id)
app.post('/api/votes/league-winner', async (req, res) => {
  const { email, team_name } = req.body || {};
  if (!email || !team_name) return res.status(400).json({ error: 'missing_fields' });
  try {
    // Ensure user exists (auto-create if not)
    const user = await ensureUserByEmail(email);
    if (!user?.id) return res.status(500).json({ error: 'user_create_failed' });
    // One vote per user
    const [exists] = await pool.query('SELECT id FROM league_winner_votes WHERE user_id = ? LIMIT 1', [user.id]);
    if (Array.isArray(exists) && exists.length > 0) {
      // Ensure profile mirrors the chosen team
      await pool.query('UPDATE users SET chosen_team = COALESCE(chosen_team, ?) WHERE id = ?', [team_name, user.id]);
      return res.status(409).json({ error: 'vote_exists' });
    }
    // Enforce lock if configured and user has no prior vote
    if (isVotingLockedNow()) {
      return res.status(423).json({ error: 'voting_locked' });
    }
    await pool.query('INSERT INTO league_winner_votes (user_id, team_name) VALUES (?, ?)', [user.id, team_name]);
    // Mirror into profile for display
    await pool.query('UPDATE users SET chosen_team = ? WHERE id = ?', [team_name, user.id]);
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('POST /api/votes/league-winner error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// Voting status endpoint
app.get('/api/votes/status', async (req, res) => {
  try {
    const email = req.query.email;
    const locked = isVotingLockedNow();
    let has_vote = false;
    let team_name = null;
    if (email) {
      const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (Array.isArray(rows) && rows.length > 0) {
        const uid = rows[0].id;
        const [v] = await pool.query('SELECT team_name FROM league_winner_votes WHERE user_id = ? LIMIT 1', [uid]);
        if (Array.isArray(v) && v.length > 0) {
          has_vote = true; team_name = v[0].team_name;
        }
      }
    }
    const deadline = process.env.VOTING_DEADLINE || null;
    return res.json({ locked, deadline, has_vote, team_name });
  } catch (e) {
    return res.status(500).json({ error: 'status_error', message: e?.message });
  }
});

// === Storage: Ensure bucket exists (uses Service Role Key; server-side only) ===
app.post('/api/storage/ensure-bucket', async (req, res) => {
  const { name, public: isPublic } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_bucket_name' });
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'missing_server_supabase_keys' });
  }
  try {
    // 1) Check if bucket exists
    const listResp = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    if (!listResp.ok) {
      const txt = await listResp.text();
      return res.status(502).json({ error: 'list_buckets_failed', details: txt });
    }
    const buckets = await listResp.json();
    const exists = Array.isArray(buckets) && buckets.some((b) => b?.name === name);
    if (exists) return res.json({ created: false, exists: true });

    // 2) Create bucket
    const createResp = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ name, public: Boolean(isPublic) }),
    });
    if (!createResp.ok) {
      const txt = await createResp.text();
      return res.status(502).json({ error: 'create_bucket_failed', details: txt });
    }
    return res.status(201).json({ created: true });
  } catch (e) {
    console.error('ensure-bucket error:', e);
    return res.status(500).json({ error: 'ensure_bucket_exception', message: e?.message });
  }
});

// CORS: allow localhost and 127.0.0.1 (any port) and null origin for file:// during dev
const allowedOrigins = new Set([
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CORS_ORIGIN || ''
].filter(Boolean));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow same-origin/no origin
    try {
      const o = new URL(origin);
      const base = `${o.protocol}//${o.hostname}` + (o.port ? `:${o.port}` : '');
      if (allowedOrigins.has(base)) return callback(null, true);
    } catch {}
    // allow during dev if it's localhost/127.0.0.1 any port
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    // allow null origin explicitly for file://
    if (origin === 'null') return callback(null, true);
    return callback(new Error('CORS not allowed for origin: ' + origin));
  },
  credentials: true,
}));
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Static uploads for media (audio messages, avatars)
const uploadsRoot = path.join(process.cwd(), 'uploads');
const audioDir = path.join(uploadsRoot, 'audio');
const avatarsDir = path.join(uploadsRoot, 'avatars');
fs.mkdirSync(audioDir, { recursive: true });
fs.mkdirSync(avatarsDir, { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

// Ensure profile_avatars table exists
async function ensureProfileAvatarsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_avatars (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        url VARCHAR(1024) NOT NULL,
        storage_path VARCHAR(512) DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Ensured profile_avatars table');
  } catch (e) {
    console.warn('Failed ensuring profile_avatars table', e?.message);
  }
}
ensureProfileAvatarsTable();

// ===== Auth middleware: verifies Bearer token and attaches req.user { id, email }
function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'no_token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token', message: e?.message });
  }
}

// Health endpoint to verify server and DB connection
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as ok');
    return res.json({ ok: true, db: rows[0]?.ok === 1 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message });
  }
});
app.post('/api/auth', async (req, res) => {
  const { email, password, username, type } = req.body || {};
  if (!email || !password || !type) return res.status(400).json({ error: 'missing_fields' });
  try {
    if (type === 'register') {
      const [existing] = await pool.query('SELECT id, email, username FROM users WHERE email = ? LIMIT 1', [email]);
      if (Array.isArray(existing) && existing.length > 0) {
        // If already registered, issue a token so client can proceed
        const u = existing[0];
        const token = jwt.sign({ id: u.id, email: u.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
        return res.status(200).json({ success: true, already: true, token, user: { id: u.id, email: u.email, username: u.username } });
      }
      const hashed = await bcrypt.hash(password, 10);
      // Ensure username is not NULL and fits schema constraints
      const safeNameBase = (username ?? '').toString().trim() || (email?.split?.('@')[0] ?? 'user');
      const safeUsername = safeNameBase.slice(0, 50);
      const [result] = await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [safeUsername, email, hashed]);
      // Issue token directly after registration
      const newId = result.insertId;
      const token = jwt.sign({ id: newId, email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      return res.status(201).json({ success: true, token, user: { id: newId, email, username: safeUsername } });
    }
    if (type === 'login') {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'not_found' });
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(400).json({ error: 'bad_password' });
      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      return res.json({ success: true, token, user: { id: user.id, email: user.email, username: user.username } });
    }
    return res.status(400).json({ error: 'bad_type' });
  } catch (e) {
    console.error('DB error:', e);
    return res.status(500).json({ error: 'db_error', code: e?.code, message: e?.message });
  }
});

// Auth: me endpoint (JWT)
app.get('/api/auth/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'no_token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const userId = payload.id;
    const [rows] = await pool.query('SELECT id, email, username FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    return res.json({ user: rows[0] });
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token', message: e?.message });
  }
});

// Profile read/update (added previously)
app.get('/api/profile', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'missing_email' });
  try {
    const [rows] = await pool.query('SELECT id, username, email, chosen_team FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    return res.json({ user: rows[0] });
  } catch (e) {
    console.error('GET /api/profile error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

app.post('/api/profile', async (req, res) => {
  const { email, username, chosen_team, new_email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'missing_email' });
  try {
    const user = await ensureUserByEmail(email, username || email);
    if (!user?.id) return res.status(500).json({ error: 'user_create_failed' });
    // If new_email provided and different, check uniqueness then update
    if (new_email && typeof new_email === 'string' && new_email.trim() && new_email.trim() !== email.trim()) {
      const cand = new_email.trim();
      const [exists] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [cand]);
      if (Array.isArray(exists) && exists.length > 0) {
        return res.status(409).json({ error: 'email_taken' });
      }
      await pool.query('UPDATE users SET email = ? WHERE id = ?', [cand, user.id]);
    }
    await pool.query('UPDATE users SET username = COALESCE(?, username), chosen_team = COALESCE(?, chosen_team) WHERE id = ?', [username ?? null, chosen_team ?? null, user.id]);
    return res.json({ success: true });
  } catch (e) {
    console.error('POST /api/profile error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// Latest group for user by email
app.get('/api/profile/groups/latest', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'missing_email' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const userId = rows[0].id;
    const [gm] = await pool.query(
      'SELECT gm.group_id, gm.joined_at, g.name FROM group_members gm JOIN `groups` g ON g.id = gm.group_id WHERE gm.user_id = ? ORDER BY gm.joined_at DESC LIMIT 1',
      [userId]
    );
    if (!Array.isArray(gm) || gm.length === 0) return res.json({ group: null });
    return res.json({ group: gm[0] });
  } catch (e) {
    console.error('GET /api/profile/groups/latest error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// === Profile Avatars (MySQL) ===
// Insert/activate avatar by email
app.post('/api/profile-avatars', async (req, res) => {
  const { email, url, storagePath } = req.body || {};
  if (!email || !url || !storagePath) return res.status(400).json({ error: 'missing_fields' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const userId = rows[0].id;
    // Optional: single active handled by trigger; also ensure manual deactivation for safety
    await pool.query('UPDATE profile_avatars SET is_active = 0 WHERE user_id = ?', [userId]);
    const [result] = await pool.query(
      'INSERT INTO profile_avatars (user_id, url, storage_path, is_active) VALUES (?, ?, ?, 1)',
      [userId, url, storagePath]
    );
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (e) {
    console.error('DB error: /api/profile-avatars POST', e);
    return res.status(500).json({ error: 'db_error', code: e?.code, message: e?.message });
  }
});

// Get active avatar by email
app.get('/api/profile-avatars/active', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'missing_email' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const userId = rows[0].id;
    const [avatars] = await pool.query(
      'SELECT id, url, storage_path, is_active, created_at FROM profile_avatars WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (!Array.isArray(avatars) || avatars.length === 0) return res.json({ active: null });
    return res.json({ active: avatars[0] });
  } catch (e) {
    console.error('DB error: /api/profile-avatars/active GET', e);
    return res.status(500).json({ error: 'db_error', code: e?.code, message: e?.message });
  }
});

// Deactivate active avatar by email
app.delete('/api/profile-avatars/active', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'missing_email' });
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const userId = rows[0].id;
    await pool.query('UPDATE profile_avatars SET is_active = 0 WHERE user_id = ? AND is_active = 1', [userId]);
    return res.json({ success: true });
  } catch (e) {
    console.error('DB error: /api/profile-avatars/active DELETE', e);
    return res.status(500).json({ error: 'db_error', code: e?.code, message: e?.message });
  }
});

// Local upload for avatar (fallback if Supabase not configured)
app.post('/api/profile-avatars/upload', express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }), async (req, res) => {
  try {
    const email = req.query.email;
    const extQ = (req.query.ext || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    if (!email) return res.status(400).json({ error: 'missing_email' });
    const bodyLen = req.body ? req.body.length || 0 : 0;
    if (!bodyLen) return res.status(400).json({ error: 'empty_image' });
    if (bodyLen > 10 * 1024 * 1024) return res.status(413).json({ error: 'file_too_large', max: '10MB' });
    // Ensure user exists
    const user = await ensureUserByEmail(email);
    if (!user?.id) return res.status(500).json({ error: 'user_create_failed' });
    const contentType = req.headers['content-type'] || '';
    let ext = 'png';
    if (/jpeg/.test(contentType)) ext = 'jpg';
    else if (/png/.test(contentType)) ext = 'png';
    else if (/webp/.test(contentType)) ext = 'webp';
    if (extQ) ext = extQ;
    const fileName = `${Date.now()}_${user.id}.${ext}`;
    const filePath = path.join(avatarsDir, fileName);
    fs.writeFileSync(filePath, req.body);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/avatars/${fileName}`;
    // Deactivate previous and insert new active avatar (best-effort)
    try {
      await pool.query('UPDATE profile_avatars SET is_active = 0 WHERE user_id = ?', [user.id]);
      const [ins] = await pool.query(
        'INSERT INTO profile_avatars (user_id, url, storage_path, is_active) VALUES (?, ?, ?, 1)',
        [user.id, url, `local:${fileName}`]
      );
      return res.status(201).json({ success: true, url, id: ins.insertId });
    } catch (dbErr) {
      console.error('avatar upload: DB insert failed, returning URL anyway', dbErr);
      return res.status(201).json({ success: true, url, warning: 'db_insert_failed' });
    }
  } catch (e) {
    console.error('POST /api/profile-avatars/upload error', e);
    return res.status(500).json({ error: 'avatar_upload_error', message: e?.message || e?.code || 'unknown' });
  }
});

// Multer storage for avatars
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, avatarsDir);
  },
  filename: function (req, file, cb) {
    const email = (req.query.email || '').toString();
    const ext = (file.originalname.split('.').pop() || 'png').toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
    const stamp = Date.now();
    cb(null, `${stamp}_${safeExt}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Multipart upload endpoint (form-data: file)
app.post('/api/profile-avatars/upload-form', upload.single('file'), async (req, res) => {
  try {
    const email = (req.query.email || '').toString();
    if (!email) return res.status(400).json({ error: 'missing_email' });
    if (!req.file) return res.status(400).json({ error: 'missing_file' });
    // Log file info for debugging
    console.log('[avatar upload-form]', {
      email,
      filename: req.file?.filename,
      size: req.file?.size,
      mimetype: req.file?.mimetype,
    });
    const user = await ensureUserByEmail(email);
    if (!user?.id) return res.status(500).json({ error: 'user_create_failed' });
    const fileName = req.file.filename;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/avatars/${fileName}`;
    await pool.query('UPDATE profile_avatars SET is_active = 0 WHERE user_id = ?', [user.id]);
    const [ins] = await pool.query(
      'INSERT INTO profile_avatars (user_id, url, storage_path, is_active) VALUES (?, ?, ?, 1)',
      [user.id, url, `local:${fileName}`]
    );
    return res.status(201).json({ success: true, url, id: ins.insertId });
  } catch (e) {
    console.error('POST /api/profile-avatars/upload-form error', e);
    return res.status(500).json({ error: 'avatar_upload_error', message: e?.message || e?.code || 'unknown' });
  }
});

// ===== Utility: group code generator (6 upper letters/numbers)
function generateGroupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ===== Groups: create, join, list (MySQL)
// POST /api/groups { name }
app.post('/api/groups', authMiddleware, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing_name' });
  const userId = req.user.id;
  let code = generateGroupCode();
  try {
    // ensure unique code
    for (let tries = 0; tries < 5; tries++) {
      const [exists] = await pool.query('SELECT id FROM `groups` WHERE code = ? LIMIT 1', [code]);
      if (!Array.isArray(exists) || exists.length === 0) break;
      code = generateGroupCode();
    }
    const [result] = await pool.query('INSERT INTO `groups` (name, code, created_by) VALUES (?, ?, ?)', [name, code, userId]);
    const groupId = result.insertId;
    // add creator as member
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId]);
    return res.status(201).json({ id: groupId, code });
  } catch (e) {
    console.error('POST /api/groups error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// POST /api/groups/join { code }
app.post('/api/groups/join', authMiddleware, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'missing_code' });
  const userId = req.user.id;
  try {
    const [rows] = await pool.query('SELECT id, name FROM `groups` WHERE code = ? LIMIT 1', [String(code).toUpperCase()]);
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'group_not_found' });
    const group = rows[0];
    // unique membership
    const [exists] = await pool.query('SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [group.id, userId]);
    if (Array.isArray(exists) && exists.length > 0) return res.status(409).json({ error: 'already_member' });
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [group.id, userId]);
    return res.json({ success: true, group: { id: group.id, name: group.name } });
  } catch (e) {
    console.error('POST /api/groups/join error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// GET /api/groups/mine -> list groups for current user with member_count
app.get('/api/groups/mine', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await pool.query(
      'SELECT g.id, g.name, g.code, g.created_at FROM group_members gm JOIN `groups` g ON g.id = gm.group_id WHERE gm.user_id = ?',
      [userId]
    );
    const groupIds = rows.map(r => r.id);
    let counts = [];
    if (groupIds.length) {
      const [cnt] = await pool.query(
        'SELECT group_id, COUNT(*) as member_count FROM group_members WHERE group_id IN (?) GROUP BY group_id',
        [groupIds]
      );
      counts = cnt;
    }
    const enriched = rows.map(r => ({ ...r, member_count: counts.find(c => c.group_id === r.id)?.member_count || 0 }));
    return res.json({ groups: enriched });
  } catch (e) {
    console.error('GET /api/groups/mine error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// ===== Messages: list/create for a group
// GET /api/groups/:id/messages
app.get('/api/groups/:id/messages', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  if (!groupId) return res.status(400).json({ error: 'bad_group' });
  try {
    // ensure requester is a member of the group
    const [mrows] = await pool.query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, req.user.id]);
    if (!Array.isArray(mrows) || mrows.length === 0) return res.status(403).json({ error: 'not_group_member' });

    const [rows] = await pool.query(
      'SELECT m.id, m.user_id, m.content, m.created_at, u.username FROM messages m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.created_at ASC',
      [groupId]
    );
    return res.json({ messages: rows });
  } catch (e) {
    console.error('GET /api/groups/:id/messages error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// POST /api/groups/:id/messages { content }
app.post('/api/groups/:id/messages', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const { content } = req.body || {};
  if (!groupId || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    const userId = req.user.id;
    // only members can post
    const [m2] = await pool.query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, userId]);
    if (!Array.isArray(m2) || m2.length === 0) return res.status(403).json({ error: 'not_group_member' });
    await pool.query('INSERT INTO messages (group_id, user_id, content) VALUES (?, ?, ?)', [groupId, userId, content.trim()]);
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('POST /api/groups/:id/messages error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// POST raw audio -> saves file and creates a message with absolute URL
// Preflight for audio uploads
app.options('/api/groups/:id/messages/audio', cors());
app.post('/api/groups/:id/messages/audio', authMiddleware, express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }), async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const ext = (req.query.ext || 'webm').toString().replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'webm';
    const bodyLen = req.body ? req.body.length || 0 : 0;
    if (!groupId || !req.body || bodyLen === 0) {
      return res.status(400).json({ error: 'missing_audio' });
    }
    // only members can post
    const [m2] = await pool.query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, req.user.id]);
    if (!Array.isArray(m2) || m2.length === 0) return res.status(403).json({ error: 'not_group_member' });

    const fileName = `${Date.now()}_${req.user.id}.${ext}`;
    const filePath = path.join(audioDir, fileName);
    fs.writeFileSync(filePath, req.body);
    console.log('[audio] saved', { fileName, bytes: bodyLen, contentType: req.headers['content-type'] });
    const baseUrl = `${req.protocol}://${req.get('host')}`; // e.g., http://localhost:3001
    const url = `${baseUrl}/uploads/audio/${fileName}`;
    await pool.query('INSERT INTO messages (group_id, user_id, content) VALUES (?, ?, ?)', [groupId, req.user.id, url]);
    return res.status(201).json({ success: true, url });
  } catch (e) {
    console.error('POST /api/groups/:id/messages/audio error', e);
    return res.status(500).json({ error: 'audio_upload_error', message: e?.message });
  }
});

// ===== Scores: latest for user/group and insert new score
// GET /api/groups/:id/scores/latest
app.get('/api/groups/:id/scores/latest', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = req.user.id;
  if (!groupId) return res.status(400).json({ error: 'bad_group' });
  try {
    const [rows] = await pool.query(
      'SELECT round_number, total_points FROM user_scores WHERE user_id = ? AND group_id = ? ORDER BY round_number DESC LIMIT 1',
      [userId, groupId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return res.json({ latest: null });
    return res.json({ latest: rows[0] });
  } catch (e) {
    console.error('GET /api/groups/:id/scores/latest error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// POST /api/groups/:id/scores
app.post('/api/groups/:id/scores', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = req.user.id;
  const {
    round_number,
    round_points,
    total_points,
    expensive_player_name,
    expensive_player_points
  } = req.body || {};
  if (!groupId || !round_number || typeof round_points !== 'number' || typeof total_points !== 'number') {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    await pool.query(
      'INSERT INTO user_scores (user_id, group_id, round_number, round_points, total_points, expensive_player_name, expensive_player_points) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, groupId, round_number, round_points, total_points, expensive_player_name ?? null, expensive_player_points ?? null]
    );
    return res.status(201).json({ success: true });
  } catch (e) {
    console.error('POST /api/groups/:id/scores error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// GET /api/groups/:id/rankings
app.get('/api/groups/:id/rankings', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const roundQ = req.query.round ? Number(req.query.round) : null;
  if (!groupId) return res.status(400).json({ error: 'bad_group' });
  try {
    const [scores] = await pool.query(
      'SELECT us.user_id, us.total_points, us.round_number, us.round_points, u.username FROM user_scores us JOIN users u ON u.id = us.user_id WHERE us.group_id = ?',
      [groupId]
    );
    // Fetch votes once if champion is defined
    const champion = (process.env.CHAMPION_TEAM_NAME || '').toString().trim();
    let voteMap = new Map();
    if (champion) {
      const [votes] = await pool.query('SELECT user_id, team_name FROM league_winner_votes');
      for (const v of votes) voteMap.set(v.user_id, v.team_name || '');
    }
    const [[{ members } = { members: 0 }]] = await pool.query(
      'SELECT COUNT(*) as members FROM group_members WHERE group_id = ?',[groupId]
    );
    const map = new Map();
    for (const s of scores) {
      if (!map.has(s.user_id)) map.set(s.user_id, { username: s.username, total_by_round: {}, rounds: new Set() });
      const u = map.get(s.user_id);
      u.total_by_round[s.round_number] = { total: s.total_points, round: s.round_points };
      u.rounds.add(s.round_number);
    }
    const result = [];
    // Fetch chosen_team for all users in this group once
    const userIds = Array.from(map.keys()).map((id) => Number(id));
    let chosenTeamByUserId = new Map();
    let avatarByUserId = new Map();
    if (userIds.length) {
      try {
        const [urows] = await pool.query('SELECT id, chosen_team FROM users WHERE id IN (?)', [userIds]);
        for (const r of urows) chosenTeamByUserId.set(Number(r.id), r.chosen_team || null);
      } catch (e) {
        console.warn('Failed to fetch chosen_team for users', e?.message);
      }
      try {
        const [arows] = await pool.query('SELECT user_id, url FROM profile_avatars WHERE user_id IN (?) AND is_active = 1', [userIds]);
        for (const r of arows) avatarByUserId.set(Number(r.user_id), r.url || null);
      } catch (e) {
        console.warn('Failed to fetch avatars for users', e?.message);
      }
    }
    for (const [userId, u] of map.entries()) {
      const rounds = Array.from(u.rounds.values()).map(Number);
      const roundsPlayed = rounds.length;
      const lastRoundOverall = rounds.length ? Math.max(...rounds) : 0;
      const targetRound = roundQ && Number.isFinite(roundQ) ? roundQ : lastRoundOverall;
      const eligibleRounds = rounds.filter(r => r <= targetRound);
      const totalAtTarget = eligibleRounds.length ? Math.max(...eligibleRounds.map(r => u.total_by_round[r].total)) : 0;
      const avg = eligibleRounds.length > 0 ? Math.round(totalAtTarget / eligibleRounds.length) : 0;
      const latestForTarget = u.total_by_round[targetRound] || { round: 0 };
      // Apply champion bonus if configured
      let bonusApplied = false;
      let totalWithBonus = totalAtTarget;
      if (champion) {
        const voted = voteMap.get(Number(userId)) || '';
        if (voted && voted.toLowerCase() === champion.toLowerCase()) {
          totalWithBonus += 50;
          bonusApplied = true;
        }
      }
      result.push({
        user_id: userId,
        username: u.username,
        total_points: totalWithBonus,
        rounds_played: eligibleRounds.length,
        average_points: avg,
        latest_round_points: latestForTarget.round,
        chosen_team: chosenTeamByUserId.get(Number(userId)) || null,
        avatar_url: avatarByUserId.get(Number(userId)) || null,
        bonus_applied: bonusApplied,
      });
    }
    result.sort((a, b) => b.total_points - a.total_points);
    const currentRound = Math.max(0, ...scores.map(s => s.round_number || 0));
    return res.json({ rankings: result, summary: { members, currentRound } });
  } catch (e) {
    console.error('GET /api/groups/:id/rankings error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

// Per-user per-round details for a group
// GET /api/groups/:id/rankings/:userId/rounds
app.get('/api/groups/:id/rankings/:userId/rounds', authMiddleware, async (req, res) => {
  const groupId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!groupId || !userId) return res.status(400).json({ error: 'bad_params' });
  try {
    // ensure requester is a member
    const [mrows] = await pool.query('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1', [groupId, req.user.id]);
    if (!Array.isArray(mrows) || mrows.length === 0) return res.status(403).json({ error: 'not_group_member' });

    const [rows] = await pool.query(
      'SELECT round_number as round, round_points, total_points, expensive_player_name, expensive_player_points, created_at FROM user_scores WHERE group_id = ? AND user_id = ? ORDER BY round_number ASC',
      [groupId, userId]
    );
    return res.json({ rounds: rows });
  } catch (e) {
    console.error('GET /api/groups/:id/rankings/:userId/rounds error', e);
    return res.status(500).json({ error: 'db_error', message: e?.message });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
