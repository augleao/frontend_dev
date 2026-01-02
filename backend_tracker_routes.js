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
    console.warn('[tracker] failed to ensure table exists', e && e.message ? e.message : e);
  }
}

// POST /api/tracker/events
router.post('/events', express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const uid = body.uid || null;
    const event = body.event || 'unknown';
    const pathName = body.path || (body.pathname || null);
    const ts = body.ts || new Date().toISOString();
    const data = body.data || null;

    const hashed = pseudonymize(uid);

    // If pool available, insert into DB; otherwise respond 202 and drop
    if (pool) {
      await ensureTable();
      const insertSql = `INSERT INTO tracker_events (hashed_uid, event, path, ts, data, ip, ua) VALUES ($1,$2,$3,$4,$5,$6,$7)`;
      try {
        await pool.query(insertSql, [hashed, event, pathName, ts, data ? data : null, req.ip || null, (req.get && req.get('User-Agent')) || null]);
        return res.json({ ok: true });
      } catch (dbErr) {
        console.error('[tracker] db insert error', dbErr && dbErr.message ? dbErr.message : dbErr);
        return res.status(500).json({ ok: false, error: 'db error' });
      }
    }

    // no db configured: accept but do not persist permanently
    return res.status(202).json({ ok: true, warning: 'no db configured; event accepted but not persisted' });
  } catch (err) {
    console.error('[tracker] unexpected error', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

function registerTracker(app) {
  app.use('/api/tracker', router);
}

module.exports = { registerTracker };
