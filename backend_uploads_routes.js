/*
Express router for presigned uploads (prepare/complete) using S3-compatible Backblaze B2.
Mount: app.use('/api/uploads', uploadsRouter);

This file is a self-contained router that:
- POST /prepare  -> returns a presigned PUT URL for the client
- POST /complete -> verifies object exists, updates uploads table (if present)
  and attempts to attach the public URL/metadata to an averbacao record.

Environment vars required: BB_ENDPOINT, BB_REGION, BB_KEY_ID, BB_APP_KEY, BB_BUCKET_NAME
Database: expects ./db to export a `pool`-like object (pg Pool). If you don't have
an `uploads` table the code will still work but will skip inserting upload metadata.

Do NOT put secrets into code. This file uses environment variables only.
*/

const express = require('express');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');

const router = express.Router();

// Env / config
const BB_ENDPOINT = process.env.BB_ENDPOINT; // e.g. https://s3.us-east-005.backblazeb2.com
const BB_REGION = process.env.BB_REGION || 'us-east-1';
const BB_KEY_ID = process.env.BB_KEY_ID;
const BB_APP_KEY = process.env.BB_APP_KEY;
const BB_BUCKET_NAME = process.env.BB_BUCKET_NAME;

if (!BB_ENDPOINT || !BB_KEY_ID || !BB_APP_KEY || !BB_BUCKET_NAME) {
  console.warn('Backblaze upload routes: missing BB_* env variables. Ensure BB_ENDPOINT, BB_KEY_ID, BB_APP_KEY, BB_BUCKET_NAME are set.');
}

const normalizedEndpoint = (BB_ENDPOINT && !/^https?:\/\//i.test(BB_ENDPOINT)) ? `https://${BB_ENDPOINT}` : BB_ENDPOINT;

const s3 = new S3Client({
  region: BB_REGION,
  endpoint: normalizedEndpoint || undefined,
  credentials: BB_KEY_ID && BB_APP_KEY ? { accessKeyId: BB_KEY_ID, secretAccessKey: BB_APP_KEY } : undefined,
  forcePathStyle: false
});

function maskKey(s) {
  if (!s) return s;
  if (s.length <= 12) return s;
  return s.slice(0,6) + '...' + s.slice(-6);
}

function sanitizeFilename(name) {
  if (!name) return 'file';
  return String(name).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-._]/g, '').slice(0, 200);
}

// POST /prepare
// body: { filename, contentType, folder }
// returns: { url, key, expiresIn }
router.post('/prepare', async (req, res) => {
  try {
    if (!BB_ENDPOINT || !BB_KEY_ID || !BB_APP_KEY || !BB_BUCKET_NAME) {
      console.error('uploads.prepare error: missing Backblaze configuration (BB_*)');
      return res.status(500).json({ error: 'server misconfigured: missing Backblaze (BB_*) environment variables' });
    }

    const { filename, contentType = 'application/pdf', folder = '' } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });

    const clean = sanitizeFilename(filename);
    const key = `${folder ? folder.replace(/\/$/, '') + '/' : ''}${Date.now()}-${uuidv4()}-${clean}`;

    // Try to insert an uploads row if table exists. If it fails just continue.
    try {
      const insertSql = `INSERT INTO public.uploads ("key", stored_name, original_name, bucket, content_type, status, metadata, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id`;
      const storedName = key.split('/').pop();
      const vals = [key, storedName, filename, BB_BUCKET_NAME, contentType, 'prepared', JSON.stringify({ preparedAt: new Date().toISOString() })];
      const r = await pool.query(insertSql, vals).catch(() => null);
      if (r && r.rows && r.rows[0]) {
        // we could return uploadId if frontend needs it
      }
    } catch (e) {
      // ignore DB errors here
    }

    const putParams = { Bucket: BB_BUCKET_NAME, Key: key, ContentType: contentType };
    const putCmd = new PutObjectCommand(putParams);
    const expiresIn = parseInt(process.env.UPLOAD_URL_EXPIRES || '600', 10);
    const url = await getSignedUrl(s3, putCmd, { expiresIn });

    // Log host only
    try { const u = new URL(url); console.info('[uploads.prepare] signedUrl host:', u.host); } catch (e) {}

    return res.json({ ok: true, url, key, expiresIn });
  } catch (err) {
    console.error('uploads.prepare error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'failed to prepare upload', details: err && err.message ? err.message : String(err) });
  }
});

// POST /complete
// body: { key, metadata, averbacaoId }
// verifies object exists and persists metadata if desired
router.post('/complete', async (req, res) => {
  try {
    const { key, metadata } = req.body || {};
    console.info('[uploads.complete] incoming', { key: key ? maskKey(key) : null, metadata: metadata ? '[present]' : null, ip: req.ip });
    if (!key) return res.status(400).json({ error: 'key required' });

    // Verify object exists
    try {
      console.info('[uploads.complete] checking HeadObject', { bucket: BB_BUCKET_NAME, key: maskKey(key) });
      const head = await s3.send(new HeadObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
      console.info('[uploads.complete] HeadObject OK');

      // Build a public URL (best-effort). If your bucket is private you should return a signed GET instead.
      const publicUrl = (() => {
        try {
          const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
          if (host) return `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}`;
        } catch (e) { }
        return `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;
      })();

      // Update uploads row if exists
      try {
        const size = head.ContentLength || head.ContentLength === 0 ? Number(head.ContentLength) : null;
        const contentType = head.ContentType || null;
        const updateSql = `UPDATE public.uploads SET size=$1, content_type=$2, status=$3, metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb, updated_at=now() WHERE "key" = $5 RETURNING id, stored_name, original_name`;
        const updateVals = [size, contentType, 'complete', JSON.stringify(metadata || {}), key];
        await pool.query(updateSql, updateVals).catch(() => null);
      } catch (e) {
        // ignore
      }

      // If caller provided an averbacao id, attach the public URL to that averbacao
      let attachedAverbacaoId = null;
      try {
        const averbacaoIdFromBody = req.body && (req.body.averbacaoId || req.body.averbacao_id || (metadata && (metadata.averbacaoId || metadata.averbacao_id)));
        const averbacaoId = averbacaoIdFromBody ? parseInt(String(averbacaoIdFromBody), 10) : NaN;
        if (!Number.isNaN(averbacaoId)) {
          const pdfMeta = { url: publicUrl, key, metadata };
          // Try jsonb `pdf` column first
          try {
            const upd1 = await pool.query('UPDATE public.averbacoes_gratuitas SET pdf = $1 WHERE id = $2 RETURNING id', [pdfMeta, averbacaoId]);
            if (upd1 && upd1.rowCount > 0) attachedAverbacaoId = upd1.rows[0].id;
            else {
              // fallback to anexo_url/anexo_metadata
              const upd2 = await pool.query('UPDATE public.averbacoes_gratuitas SET anexo_url = $1, anexo_metadata = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [publicUrl, metadata || null, averbacaoId]);
              if (upd2 && upd2.rowCount > 0) attachedAverbacaoId = upd2.rows[0].id;
              else {
                // another legacy schema: pdf_filename / pdf_url
                const upd3 = await pool.query('UPDATE public.averbacoes_gratuitas SET pdf_filename = $1, pdf_url = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [metadata && (metadata.originalName || metadata.original_name || metadata.filename) ? (metadata.originalName || metadata.original_name || metadata.filename) : key.split('/').pop(), publicUrl, averbacaoId]).catch(() => null);
                if (upd3 && upd3.rowCount > 0) attachedAverbacaoId = upd3.rows[0].id;
              }
            }
          } catch (inner) {
            // If the `averbacoes_gratuitas` table/column doesn't exist, try the alternate table
            try {
              const updA = await pool.query('UPDATE public.averbacoes SET pdf = $1 WHERE id = $2 RETURNING id', [pdfMeta, averbacaoId]);
              if (updA && updA.rowCount > 0) attachedAverbacaoId = updA.rows[0].id;
              else {
                await pool.query('UPDATE public.averbacoes SET anexo_url = $1, anexo_metadata = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [publicUrl, metadata || null, averbacaoId]).catch(() => null);
                // legacy fields on `averbacoes`
                await pool.query('UPDATE public.averbacoes SET pdf_filename = $1, pdf_url = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [metadata && (metadata.originalName || metadata.original_name || metadata.filename) ? (metadata.originalName || metadata.original_name || metadata.filename) : key.split('/').pop(), publicUrl, averbacaoId]).catch(() => null);
              }
            } catch (inner2) {
              console.warn('[uploads.complete] attach fallback failed', inner2 && inner2.message ? inner2.message : inner2);
            }
          }
        }
      } catch (err) {
        console.warn('[uploads.complete] failed to attach to averbacao', err && err.message ? err.message : err);
      }

      // Optionally provide a signed GET as a safer download mechanism
      let downloadUrl = null;
      try {
        const getExpires = parseInt(process.env.DOWNLOAD_URL_EXPIRES || '300', 10);
        const getCmd = new GetObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key });
        downloadUrl = await getSignedUrl(s3, getCmd, { expiresIn: getExpires });
      } catch (e) {
        // ignore signed GET generation errors
      }

      return res.json({ ok: true, storedName: key.split('/').pop(), url: publicUrl, downloadUrl, attachedAverbacaoId });
    } catch (headErr) {
      console.warn('[uploads.complete] HeadObject error', headErr && headErr.message ? headErr.message : headErr);
      return res.status(404).json({ error: 'object not found in storage or not yet available' });
    }
  } catch (err) {
    console.error('uploads.complete error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'failed to confirm upload', details: err && err.message ? err.message : String(err) });
  }
});

module.exports = router;
