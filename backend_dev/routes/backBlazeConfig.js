// routes/backblazeConfig.js
// Simple CRUD storing config in a JSON file or DB.
// IMPORTANT: avoid storing secrets in public repos; this is for example only.

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'backblaze.config.json');

// Helper: read/write file (adapt to DB)
async function readConfig() {
  try {
    const text = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}
async function writeConfig(obj) {
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

// GET /config/backblaze
router.get('/', async (req, res) => {
  try {
    const cfg = await readConfig();
    return res.json(cfg || {});
  } catch (err) {
    console.error('config.get err', err);
    return res.status(500).json({ error: 'failed to read config' });
  }
});

// POST /config/backblaze (create or update)
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    // Minimal validation
    if (!payload.keyId || !payload.appKey || !payload.bucket) {
      return res.status(400).json({ error: 'keyId, appKey and bucket required' });
    }
    const saved = {
      keyId: payload.keyId,
      appKey: payload.appKey,
      bucket: payload.bucket,
      endpoint: payload.endpoint || '',
      region: payload.region || '',
      cors_origins: payload.cors_origins || payload.corsOrigins || []
    };
    await writeConfig(saved);
    return res.json(saved);
  } catch (err) {
    console.error('config.save err', err);
    return res.status(500).json({ error: 'failed to save config' });
  }
});

// DELETE /config/backblaze
router.delete('/', async (req, res) => {
  try {
    await fs.unlink(CONFIG_FILE).catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('config.delete err', err);
    return res.status(500).json({ error: 'failed to delete config' });
  }
});

module.exports = router;