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
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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

// GET /?averbacaoId=123
// List uploads linked to an averbacao
router.get('/', async (req, res) => {
  try {
    const averbacaoId = req.query && (req.query.averbacaoId || req.query.averbacao_id) ? parseInt(String(req.query.averbacaoId || req.query.averbacao_id), 10) : NaN;
    if (Number.isNaN(averbacaoId)) return res.status(400).json({ error: 'averbacaoId query parameter required' });
    const rows = await pool.query(`SELECT id, "key", stored_name, original_name, bucket, content_type, size, status, metadata, created_at, updated_at FROM public.uploads WHERE averbacao_id = $1 ORDER BY created_at DESC`, [averbacaoId]);
    const list = (rows && rows.rows || []).map(r => {
      const key = r.key || r['key'];
      const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
      const url = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;
      return { ...r, url };
    });
    return res.json({ ok: true, uploads: list });
  } catch (e) {
    console.error('[uploads.list] error', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'failed to list uploads' });
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
            try {
              const id = parseInt(String(req.params && req.params.id || ''), 10);
              if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });

              // Find the uploads row
              const sel = await pool.query('SELECT id, "key", bucket, status, averbacao_id, stored_name, metadata FROM public.uploads WHERE id = $1 LIMIT 1', [id]);
              if (!sel || sel.rowCount === 0) return res.status(404).json({ error: 'upload not found' });
              const row = sel.rows[0];
              const key = row.key;
              const storedName = row.stored_name || null;
              const linkedAverbacaoId = row.averbacao_id ? parseInt(String(row.averbacao_id), 10) : null;

              // Attempt to delete from storage (best-effort)
              let storageDeleted = false;
              let storageDeleteError = null;
              try {
                if (key && BB_BUCKET_NAME) {
                  const delResp = await s3.send(new DeleteObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
                  console.info('[uploads.delete] S3 DeleteObject attempted', { id, key, delResp });
                  // Verify deletion by attempting HeadObject; if it throws, assume deleted
                  try {
                    await s3.send(new HeadObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
                    // If HeadObject succeeds, object still exists
                    console.info('[uploads.delete] HeadObject after delete: object still exists', { id, key });
                    storageDeleted = false;
                  } catch (eHead) {
                    // Typically a NotFound error indicates deletion succeeded
                    console.info('[uploads.delete] HeadObject after delete: not found (assume deleted)', { id, key, err: eHead && eHead.message ? eHead.message : eHead });
                    storageDeleted = true;
                  }
                }
              } catch (eDel) {
                storageDeleteError = eDel && eDel.message ? eDel.message : String(eDel);
                console.warn('[uploads.delete] failed to delete object from storage (continuing)', storageDeleteError);
              }

              // Mark uploads row as deleted (soft-delete)
              let uploadsRowUpdated = 0;
              try {
                const up = await pool.query('UPDATE public.uploads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', ['deleted', id]);
                uploadsRowUpdated = up && up.rowCount ? up.rowCount : 0;
                console.info('[uploads.delete] uploads row updated', { rowCount: uploadsRowUpdated });
              } catch (eUp) {
                console.warn('[uploads.delete] failed to update uploads row status', eUp && eUp.message ? eUp.message : eUp);
              }

              // If this upload was linked to an averbacao, attempt to remove references
              let detachedCount = 0;
              if (linkedAverbacaoId) {
                try {
                  // Build public URL used elsewhere
                  const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
                  const publicUrl = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;

                  // Attempt to nullify json/pdf fields or legacy url fields on averbacoes_gratuitas
                  try {
                    const r = await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 ) RETURNING id`, [linkedAverbacaoId, key, publicUrl]);
                    if (r && r.rowCount) detachedCount += r.rowCount;
                  } catch (e) { console.warn('[uploads.delete] clearing pdf json failed', e && e.message ? e.message : e); }

                  try {
                    const r2 = await pool.query(`UPDATE public.averbacoes_gratuitas SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3) RETURNING id`, [linkedAverbacaoId, publicUrl, publicUrl]);
                    if (r2 && r2.rowCount) detachedCount += r2.rowCount;
                  } catch (e) { console.warn('[uploads.delete] clearing anexo_url failed', e && e.message ? e.message : e); }

                  try {
                    const r3 = await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3 OR pdf_filename = $4) RETURNING id`, [linkedAverbacaoId, publicUrl, storedName, storedName]);
                    if (r3 && r3.rowCount) detachedCount += r3.rowCount;
                  } catch (e) { console.warn('[uploads.delete] clearing legacy pdf fields failed', e && e.message ? e.message : e); }

                  // Repeat for alternate table
                  try {
                    const r4 = await pool.query(`UPDATE public.averacoes SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 ) RETURNING id`, [linkedAverbacaoId, key, publicUrl]);
                    if (r4 && r4.rowCount) detachedCount += r4.rowCount;
                  } catch (e) { console.warn('[uploads.delete] clearing averbacoes.pdf json failed', e && e.message ? e.message : e); }

                  try {
                    const r5 = await pool.query(`UPDATE public.averacoes SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3) RETURNING id`, [linkedAverbacaoId, publicUrl, publicUrl]);
                    if (r5 && r5.rowCount) detachedCount += r5.rowCount;
                  } catch (e) { console.warn('[uploads.delete] clearing averbacoes.anexo_url failed', e && e.message ? e.message : e); }

                  try {
                    const r6 = await pool.query(`UPDATE public.averacoes SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3) RETURNING id`, [linkedAverbacaoId, publicUrl, storedName]);
                    if (r6 && r6.rowCount) detachedCount += r6.rowCount;
                  } catch (e) { /* some schemas may not exist; ignore */ }
                } catch (e) {
                  console.warn('[uploads.delete] error while detaching from averbacao', e && e.message ? e.message : e);
                }
                console.info('[uploads.delete] detached references count', { detachedCount });
              }

              return res.json({ ok: true, deletedId: id, storageDeleted, storageDeleteError, uploadsRowUpdated, detachedCount });
            } catch (err) {
              console.error('[uploads.delete] error', err && err.stack ? err.stack : err);
              return res.status(500).json({ error: 'failed to delete upload' });
            }

            // Also fetch uploads linked to this averbacao so frontend can list all files
            try {
              const ul = await pool.query(`SELECT id, "key", stored_name, original_name, bucket, content_type, size, status, metadata, created_at, updated_at FROM public.uploads WHERE averbacao_id = $1 ORDER BY created_at DESC`, [averbacaoId2]);
              if (ul && ul.rowCount > 0) {
                const uploadsList = ul.rows.map(r => {
                  const key = r.key || r['key'];
                  const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
                  const url = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;
                  return { ...r, url };
                });
                // attach uploads list to the averbacaoRow for convenience
                averbacaoRow.uploads = uploadsList;
              }
            } catch (eUl) {
              console.warn('[uploads.complete] failed to fetch linked uploads', eUl && eUl.message ? eUl.message : eUl);
            }
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

// DELETE /:id
// Soft-delete an upload record and attempt to delete the object from the bucket.
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params && req.params.id || ''), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });

    // Find the uploads row
    const sel = await pool.query('SELECT id, "key", bucket, status, averbacao_id, stored_name, metadata FROM public.uploads WHERE id = $1 LIMIT 1', [id]);
    if (!sel || sel.rowCount === 0) return res.status(404).json({ error: 'upload not found' });
    const row = sel.rows[0];
    const key = row.key;
    const storedName = row.stored_name || null;
    const linkedAverbacaoId = row.averbacao_id ? parseInt(String(row.averbacao_id), 10) : null;

    // Attempt to delete from storage (best-effort)
    try {
      if (key && BB_BUCKET_NAME) {
        await s3.send(new DeleteObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
        console.info('[uploads.delete] S3 DeleteObject attempted', { id, key });
      }
    } catch (eDel) {
      console.warn('[uploads.delete] failed to delete object from storage (continuing)', eDel && eDel.message ? eDel.message : eDel);
    }

    // Mark uploads row as deleted (soft-delete)
    try {
      const up = await pool.query('UPDATE public.uploads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', ['deleted', id]);
      console.info('[uploads.delete] uploads row updated', { rowCount: up && up.rowCount });
    } catch (eUp) {
      console.warn('[uploads.delete] failed to update uploads row status', eUp && eUp.message ? eUp.message : eUp);
    }

    // If this upload was linked to an averbacao, attempt to remove references
    if (linkedAverbacaoId) {
      try {
        // Build public URL used elsewhere
        const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
        const publicUrl = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;

        // Attempt to nullify json/pdf fields or legacy url fields on averbacoes_gratuitas
        try {
          await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 )`, [linkedAverbacaoId, key, publicUrl]);
        } catch (e) { console.warn('[uploads.delete] clearing pdf json failed', e && e.message ? e.message : e); }

        try {
          await pool.query(`UPDATE public.averbacoes_gratuitas SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3)`, [linkedAverbacaoId, publicUrl, publicUrl]);
        } catch (e) { console.warn('[uploads.delete] clearing anexo_url failed', e && e.message ? e.message : e); }

        try {
          await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3 OR pdf_filename = $4)`, [linkedAverbacaoId, publicUrl, storedName, storedName]);
        } catch (e) { console.warn('[uploads.delete] clearing legacy pdf fields failed', e && e.message ? e.message : e); }

        // Repeat for alternate table
        try {
          await pool.query(`UPDATE public.averbacoes SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 )`, [linkedAverbacaoId, key, publicUrl]);
        } catch (e) { console.warn('[uploads.delete] clearing averbacoes.pdf json failed', e && e.message ? e.message : e); }

        try {
          await pool.query(`UPDATE public.averbacoes SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3)`, [linkedAverbacaoId, publicUrl, publicUrl]);
        } catch (e) { console.warn('[uploads.delete] clearing averbacoes.anexo_url failed', e && e.message ? e.message : e); }

        try {
          await pool.query(`UPDATE public.averbacoes SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3)`, [linkedAverbacaoId, publicUrl, storedName]);
        } catch (e) { /* some schemas may not exist; ignore */ }
      } catch (e) {
        console.warn('[uploads.delete] error while detaching from averbacao', e && e.message ? e.message : e);
      }
    }

    return res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error('[uploads.delete] error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'failed to delete upload' });
  }
});

// Export a register function so the main server can call `registerUploads(app)`
// (this matches how `server.js` expects to mount the routes).
function registerUploads(app) {
  app.use('/api/uploads', router);
}

module.exports = { registerUploads };
