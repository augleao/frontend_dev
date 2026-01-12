// Simple tracker endpoint: POST /api/tracker/events
// - Pseudonimiza `uid` com HMAC-SHA256 usando TRACKER_SALT
// - Persiste eventos em Postgres (tabela tracker_events)

const express = require('express');
const crypto = require('crypto');

// Try to reuse existing DB pool if available, otherwise create one from DATABASE_URL
let pool = null;
try {
  // prefer app's common db module if present
  pool = require('./db');
} catch (e) {
  try {
    pool = require('../db');
  } catch (e2) {
    // fallback to creating our own pool when DATABASE_URL is provided
    try {
      const { Pool } = require('pg');
      const DATABASE_URL = process.env.DATABASE_URL || null;
      if (DATABASE_URL) {
        pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
      }
    } catch (pgErr) {
      // pg not available or no DATABASE_URL; pool remains null
      pool = null;
    }
  }
}

const router = express.Router();

const SALT = process.env.TRACKER_SALT || 'please-change-this-salt';

function pseudonymize(uid) {
  if (!uid) return null;
  try {
    return crypto.createHmac('sha256', SALT).update(String(uid)).digest('hex');
  } catch (e) {
    return null;
  }
}

function normalizeData(data) {
  if (data === undefined || data === null) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data;
  return { value: data };
}

function clientIp(req) {
  const forwarded = req && req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return req && req.ip ? req.ip : null;
}

async function ensureTable() {
  if (!pool || ensureTable._done) return;
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS tracker_events (
        id BIGSERIAL PRIMARY KEY,
        hashed_uid TEXT NULL,
        event TEXT NOT NULL,
        path TEXT NULL,
        ts TIMESTAMPTZ NULL,
        data JSONB NULL,
        ip TEXT NULL,
        ua TEXT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tracker_hashed_uid ON tracker_events(hashed_uid);
    `;
    await pool.query(ddl);
    ensureTable._done = true;
  } catch (e) {
  }
}

  async function processTrackerEventsBatch(pool, events, req) {
    if (!Array.isArray(events)) {
      return { status: 400, body: { ok: false, error: 'events must be an array' } };
    }
    const results = [];
    let inserted = 0;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i] || {};
      try {
        // Reuse single-event processor; it returns {status, body}
        const r = await processTrackerEvent(pool, ev, req);
        results.push({ index: i, status: r.status, body: r.body });
        if (r.status === 200 || r.status === 202) inserted += 1;
      } catch (e) {
        results.push({ index: i, status: 500, body: { ok: false, error: 'processing error', details: e && e.message ? e.message : String(e) } });
      }
    }
    return { status: 200, body: { ok: true, inserted, total: events.length, results } };
  }

  async function processTrackerEvent(pool, body, req) {
    const salt = process.env.TRACKER_SALT || SALT;
    const allowAnonymous = String(process.env.TRACKER_ALLOW_ANONYMOUS || '') === '1';

    // Determine tracking identifier: check body.uid, body.data.uid, then cookie track_uid
    let rawUid = null;
    if (body && body.uid) rawUid = body.uid;
    else if (body && body.data && body.data.uid) rawUid = body.data.uid;
    else if (req && req.cookies && req.cookies.track_uid) rawUid = req.cookies.track_uid;
    const hashed = pseudonymize(rawUid);

    // Try to obtain authenticated user id if Authorization header present (lenient)
    let userId = null;
    try {
      const authHeader = req && req.headers && req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || null;
        if (JWT_SECRET) {
          const payload = jwt.verify(token, JWT_SECRET);
          if (payload && payload.id) userId = payload.id;
        }
      }
    } catch (e) {
      // ignore invalid token
    }

    const eventName = body && body.event ? String(body.event) : 'unknown';
    const path = (body && (body.path || body.pathname)) || null;
    const ts = (body && body.ts) || new Date().toISOString();
    const data = normalizeData(body && body.data);
    const ip = req ? clientIp(req) : null;
    const ua = req && req.get ? req.get('User-Agent') : null;

    if (!hashed && !userId && !allowAnonymous) {
      return { status: 400, body: { ok: false, error: 'missing tracking identifier or authenticated user' } };
    }

    if (pool) {
      await ensureTable(pool);
      try {
        await pool.query(
          'INSERT INTO public.tracker_events (user_id, hashed_uid, event, path, ts, data, ip, ua) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [userId, hashed, eventName, path, ts, data, ip, ua]
        );
        return { status: 200, body: { ok: true } };
      } catch (err) {
        return { status: 500, body: { ok: false, error: 'db error', details: err && err.message ? err.message : String(err) } };
      }
    }

    return { status: 202, body: { ok: true, warning: 'no db configured; event accepted but not persisted' } };
  }

// POST /api/tracker/events
router.post('/events', express.json(), async (req, res) => {
  try {
    const body = req.body || {};

    // Batch request: { events: [ {...}, ... ] }
    if (body && Array.isArray(body.events)) {
      const batchResult = await processTrackerEventsBatch(pool, body.events, req);
      return res.status(batchResult.status).json(batchResult.body);
    }

    // Single event
    const result = await processTrackerEvent(pool, body, req);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

function registerTracker(app) {
  app.use('/api/tracker', router);
}

module.exports = { registerTracker };
