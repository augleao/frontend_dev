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
// Use the application's shared DB pool. The routes file is located in `routes/` so
// the correct relative path to the project's `db` is `../db`.
const pool = require('../db');

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
    console.info('[uploads.prepare] body', { filename: filename ? String(filename).slice(0,200) : null, contentType, folder, ip: req.ip });
    if (!filename) return res.status(400).json({ error: 'filename required' });

    const clean = sanitizeFilename(filename);
    const key = `${folder ? folder.replace(/\/$/, '') + '/' : ''}${Date.now()}-${uuidv4()}-${clean}`;

    // Try to insert an uploads row if table exists. If it fails just continue.
    try {
      const insertSql = `INSERT INTO public.uploads ("key", stored_name, original_name, bucket, content_type, status, metadata, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id`;
      const storedName = key.split('/').pop();
      const vals = [key, storedName, filename, BB_BUCKET_NAME, contentType, 'prepared', JSON.stringify({ preparedAt: new Date().toISOString() })];
      let r = null;
      try {
        r = await pool.query(insertSql, vals);
        console.info('[uploads.prepare] inserted uploads row', { rowCount: r.rowCount, id: r.rows && r.rows[0] && r.rows[0].id });
      } catch (dbErr) {
        console.warn('[uploads.prepare] uploads insert failed (continuing)', dbErr && dbErr.message ? dbErr.message : dbErr);
      }
    } catch (e) {
      console.warn('[uploads.prepare] unexpected error in insert attempt', e && e.message ? e.message : e);
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
    console.info('[uploads.complete] incoming', { key: key ? maskKey(key) : null, metadata: metadata ? metadata : null, ip: req.ip, body: req.body });
    if (!key) return res.status(400).json({ error: 'key required' });

    // Verify object exists
    try {
      console.info('[uploads.complete] checking HeadObject', { bucket: BB_BUCKET_NAME, key: maskKey(key) });
      const head = await s3.send(new HeadObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
      console.info('[uploads.complete] HeadObject OK', { contentLength: head.ContentLength, contentType: head.ContentType, lastModified: head.LastModified });

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
        // If the caller provided an averbacao id, set it on the uploads row so
        // the upload is linked even if the averbacao's schema doesn't have
        // dedicated pdf/anexo columns.
        const averbacaoIdFromBody = req.body && (req.body.averbacaoId || req.body.averbacao_id || (metadata && (metadata.averbacaoId || metadata.averbacao_id)));
        let averbacaoId = averbacaoIdFromBody ? parseInt(String(averbacaoIdFromBody), 10) : null;
        if (Number.isNaN(averbacaoId)) averbacaoId = null;
        const updateSql = `UPDATE public.uploads SET size=$1, content_type=$2, status=$3, metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb, averbacao_id = $5, updated_at=now() WHERE "key" = $6 RETURNING id, stored_name, original_name, averbacao_id`;
        const updateVals = [size, contentType, 'complete', JSON.stringify(metadata || {}), averbacaoId, key];
        let ures = null;
        try {
          ures = await pool.query(updateSql, updateVals);
          console.info('[uploads.complete] uploads table update result', { rowCount: ures.rowCount, rows: ures.rows });
        } catch (updErr) {
          console.warn('[uploads.complete] failed to update uploads table', updErr && updErr.message ? updErr.message : updErr);
        }
        if (!ures || ures.rowCount === 0) {
          console.info('[uploads.complete] no uploads record found for key', { key: maskKey(key) });
        }
      } catch (e) {
        console.warn('[uploads.complete] unexpected error updating uploads row', e && e.message ? e.message : e);
      }

      // If caller provided an averbacao id, attach the public URL to that averbacao.
      // Try several possible schema shapes in order, performing sequential
      // attempts on the same table before falling back to another table. This
      // prevents aborting the chain when a single missing column causes an
      // exception (e.g. `column "pdf" of relation "averbacoes_gratuitas" does not exist`).
      let attachedAverbacaoId = null;
      try {
        const averbacaoIdFromBody = req.body && (req.body.averbacaoId || req.body.averbacao_id || (metadata && (metadata.averbacaoId || metadata.averbacao_id)));
        const averbacaoId = averbacaoIdFromBody ? parseInt(String(averbacaoIdFromBody), 10) : NaN;
        if (!Number.isNaN(averbacaoId)) {
          console.info('[uploads.complete] attempting to attach upload to averbacao', { averbacaoId, publicUrl });
          const pdfMeta = { url: publicUrl, key, metadata };

          // First, attempt updates on `public.averbacoes_gratuitas` using
          // multiple column strategies. Each attempt catches its own errors so
          // a missing column won't abort subsequent attempts.
          try {
            const updPdf = await pool.query('UPDATE public.averbacoes_gratuitas SET pdf = $1 WHERE id = $2 RETURNING id', [pdfMeta, averbacaoId]);
            console.info('[uploads.complete] update averbacoes_gratuitas(pdf) result', { rowCount: updPdf && updPdf.rowCount });
            if (updPdf && updPdf.rowCount > 0) attachedAverbacaoId = updPdf.rows[0].id;
          } catch (ePdf) {
            console.warn('[uploads.complete] averbacoes_gratuitas(pdf) failed', ePdf && ePdf.message ? ePdf.message : ePdf);
          }

          if (!attachedAverbacaoId) {
            try {
              const updAnexo = await pool.query('UPDATE public.averbacoes_gratuitas SET anexo_url = $1, anexo_metadata = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [publicUrl, metadata || null, averbacaoId]);
              console.info('[uploads.complete] update averbacoes_gratuitas(anexo) result', { rowCount: updAnexo && updAnexo.rowCount });
              if (updAnexo && updAnexo.rowCount > 0) attachedAverbacaoId = updAnexo.rows[0].id;
            } catch (eAnexo) {
              console.warn('[uploads.complete] averbacoes_gratuitas(anexo) failed', eAnexo && eAnexo.message ? eAnexo.message : eAnexo);
            }
          }

          if (!attachedAverbacaoId) {
            try {
              const filenameToWrite = metadata && (metadata.originalName || metadata.original_name || metadata.filename) ? (metadata.originalName || metadata.original_name || metadata.filename) : key.split('/').pop();
              const updLegacy = await pool.query('UPDATE public.averbacoes_gratuitas SET pdf_filename = $1, pdf_url = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [filenameToWrite, publicUrl, averbacaoId]);
              console.info('[uploads.complete] update averbacoes_gratuitas(legacy pdf) result', { rowCount: updLegacy && updLegacy.rowCount });
              if (updLegacy && updLegacy.rowCount > 0) attachedAverbacaoId = updLegacy.rows[0].id;
            } catch (eLegacy) {
              console.warn('[uploads.complete] averbacoes_gratuitas(legacy) failed', eLegacy && eLegacy.message ? eLegacy.message : eLegacy);
            }
          }

          // If none of the attempts on `averbacoes_gratuitas` succeeded, try
          // the alternate table `public.averbacoes` using the same strategies.
          if (!attachedAverbacaoId) {
            try {
              const updPdfA = await pool.query('UPDATE public.averbacoes SET pdf = $1 WHERE id = $2 RETURNING id', [pdfMeta, averbacaoId]);
              console.info('[uploads.complete] update averbacoes(pdf) result', { rowCount: updPdfA && updPdfA.rowCount });
              if (updPdfA && updPdfA.rowCount > 0) attachedAverbacaoId = updPdfA.rows[0].id;
            } catch (ePdfA) {
              console.warn('[uploads.complete] averbacoes(pdf) failed', ePdfA && ePdfA.message ? ePdfA.message : ePdfA);
            }
          }

          if (!attachedAverbacaoId) {
            try {
              const updAnexoA = await pool.query('UPDATE public.averbacoes SET anexo_url = $1, anexo_metadata = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [publicUrl, metadata || null, averbacaoId]);
              console.info('[uploads.complete] update averbacoes(anexo) result', { rowCount: updAnexoA && updAnexoA.rowCount });
              if (updAnexoA && updAnexoA.rowCount > 0) attachedAverbacaoId = updAnexoA.rows[0].id;
            } catch (eAnexoA) {
              console.warn('[uploads.complete] averbacoes(anexo) failed', eAnexoA && eAnexoA.message ? eAnexoA.message : eAnexoA);
            }
          }

          if (!attachedAverbacaoId) {
            try {
              const filenameToWrite = metadata && (metadata.originalName || metadata.original_name || metadata.filename) ? (metadata.originalName || metadata.original_name || metadata.filename) : key.split('/').pop();
              const updLegacyA = await pool.query('UPDATE public.averbacoes SET pdf_filename = $1, pdf_url = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [filenameToWrite, publicUrl, averbacaoId]);
              console.info('[uploads.complete] update averbacoes(legacy pdf) result', { rowCount: updLegacyA && updLegacyA.rowCount });
              if (updLegacyA && updLegacyA.rowCount > 0) attachedAverbacaoId = updLegacyA.rows[0].id;
            } catch (eLegacyA) {
              console.warn('[uploads.complete] averbacoes(legacy) failed', eLegacyA && eLegacyA.message ? eLegacyA.message : eLegacyA);
            }
          }
        }
      } catch (err) {
        console.warn('[uploads.complete] failed to attach to averbacao', err && err.message ? err.message : err);
      }

      // If we attempted to attach to an averbacao, fetch and return the
      // current averbacao row so the frontend can update immediately.
      let averbacaoRow = null;
      try {
        const averbacaoIdFromBody2 = req.body && (req.body.averbacaoId || req.body.averbacao_id || (metadata && (metadata.averbacaoId || metadata.averbacao_id)));
        const averbacaoId2 = averbacaoIdFromBody2 ? parseInt(String(averbacaoIdFromBody2), 10) : NaN;
        if (!Number.isNaN(averbacaoId2)) {
          try {
            const sel = await pool.query('SELECT * FROM public.averbacoes_gratuitas WHERE id = $1 LIMIT 1', [averbacaoId2]);
            if (sel && sel.rowCount > 0) {
              averbacaoRow = sel.rows[0];
            } else {
              // try alternate table
              const selA = await pool.query('SELECT * FROM public.averbacoes WHERE id = $1 LIMIT 1', [averbacaoId2]).catch(() => null);
              if (selA && selA.rowCount > 0) averbacaoRow = selA.rows[0];
            }
            console.info('[uploads.complete] fetched averbacao row', { found: !!averbacaoRow, id: averbacaoId2 });
          } catch (eSel) {
            console.warn('[uploads.complete] failed to select averbacao', eSel && eSel.message ? eSel.message : eSel);
          }
        }
      } catch (e) {
        console.warn('[uploads.complete] unexpected error while fetching averbacao', e && e.message ? e.message : e);
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

      return res.json({ ok: true, storedName: key.split('/').pop(), url: publicUrl, downloadUrl, attachedAverbacaoId, averbacao: averbacaoRow });
    } catch (headErr) {
      console.warn('[uploads.complete] HeadObject error', headErr && headErr.message ? headErr.message : headErr);
      return res.status(404).json({ error: 'object not found in storage or not yet available' });
    }
  } catch (err) {
    console.error('uploads.complete error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'failed to confirm upload', details: err && err.message ? err.message : String(err) });
  }
});

// Export a register function so the main server can call `registerUploads(app)`
// (this matches how `server.js` expects to mount the routes).
function registerUploads(app) {
  app.use('/api/uploads', router);
}

module.exports = { registerUploads };
