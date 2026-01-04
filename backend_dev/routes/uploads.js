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
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
// Use the application's shared DB pool. The routes file is located in `routes/` so
// the correct relative path to the project's `db` is `../db`.
const pool = require('../db');
const { ensureAuth } = require('../middlewares/auth');

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

// Cache for table existence checks to avoid repeated warnings when a table
// (like `averbacoes`) is not present in some deployments/schemas.
const _tableExistsCache = {};
async function tableExists(tableName) {
  if (_tableExistsCache[tableName] !== undefined) return _tableExistsCache[tableName];
  try {
    const res = await pool.query("SELECT to_regclass($1) as reg", [`public.${tableName}`]);
    const exists = !!(res && res.rows && res.rows[0] && res.rows[0].reg);
    _tableExistsCache[tableName] = exists;
    return exists;
  } catch (err) {
    console.warn('[uploads.tableExists] check failed', tableName, err && err.message);
    _tableExistsCache[tableName] = false;
    return false;
  }
}

// Check if a specific column exists on a table (public schema)
async function columnExists(tableName, columnName) {
  try {
    const q = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`;
    const r = await pool.query(q, [String(tableName), String(columnName)]);
    return !!(r && r.rowCount > 0);
  } catch (err) {
    console.warn('[uploads.columnExists] check failed', tableName, columnName, err && err.message);
    return false;
  }
}

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

    const body = req.body || {};
    const filename = body.filename;
    const contentType = body.contentType || 'application/pdf';
    // If folder not provided, default to a monthly folder so counters reset monthly
    let folder = body.folder || '';
    if (!folder || String(folder).trim() === '') {
      const dNow = new Date();
      const year = String(dNow.getFullYear());
      const month = String(dNow.getMonth() + 1).padStart(2, '0');
      folder = `ATOS_GRATUITOS/${year}/${month}`;
    }

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

// DEBUG: GET /debug/tables
// Returns whether averbacao-related tables exist and a short list of public tables.
// Useful to diagnose "skipping updates on public.averbacoes (table missing)" logs.
router.get('/debug/tables', async (req, res) => {
  try {
    const hasAverbacoes = await tableExists('averbacoes');
    const hasAverbacoesGratuitas = await tableExists('averbacoes_gratuitas');
    const tbls = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const tables = (tbls && tbls.rows || []).map(r => r.tablename);
    return res.json({ ok: true, hasAverbacoes, hasAverbacoesGratuitas, tables });
  } catch (e) {
    console.warn('[uploads.debug.tables] failed', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'failed to list tables' });
  }
});

// GET /?averbacaoId=123 or /?procedimentoId=123
// List uploads linked to an averbacao or a procedimento
router.get('/', async (req, res) => {
  try {
    const atoIdRaw = req.query && (req.query.atoId || req.query.ato_id);
    const tipoRaw = req.query && (req.query.tipo || req.query.tipo);
    const procedimentoIdRaw = req.query && (req.query.procedimentoId || req.query.procedimento_id);
    const averbacaoIdRaw = req.query && (req.query.averbacaoId || req.query.averbacao_id);

    let whereClause = '';
    let params = [];

    // Prefer new canonical ato_id + ato_type if provided
    if (atoIdRaw) {
      const atoId = parseInt(String(atoIdRaw), 10);
      if (Number.isNaN(atoId)) return res.status(400).json({ error: 'atoId query parameter must be an integer' });

      const tipo = tipoRaw ? String(tipoRaw).toLowerCase() : null;
      if (!tipo) return res.status(400).json({ error: 'tipo query parameter required when querying by atoId' });
      if (tipo !== 'averbacao' && tipo !== 'procedimento') return res.status(400).json({ error: "tipo must be 'averbacao' or 'procedimento'" });

      const hasAtoId = await columnExists('uploads', 'ato_id');
      const hasAtoType = await columnExists('uploads', 'ato_type');
      if (hasAtoId && hasAtoType) {
        whereClause = 'ato_id = $1 AND ato_type = $2';
        params = [atoId, tipo];
      } else {
        // Fallback to legacy per-type columns
        if (tipo === 'procedimento') {
          const hasProc = await columnExists('uploads', 'procedimento_id');
          if (!hasProc) {
            console.info('[uploads.list] uploads.ato_id/ato_type missing and procedimento_id missing; returning empty list', { atoId, tipo });
            return res.json({ ok: true, uploads: [] });
          }
          whereClause = 'procedimento_id = $1';
          params = [atoId];
        } else {
          const hasAverb = await columnExists('uploads', 'averbacao_id');
          if (!hasAverb) {
            console.info('[uploads.list] uploads.ato_id/ato_type missing and averbacao_id missing; returning empty list', { atoId, tipo });
            return res.json({ ok: true, uploads: [] });
          }
          whereClause = 'averbacao_id = $1';
          params = [atoId];
        }
      }

    } else if (procedimentoIdRaw) {
      const procedimentoId = parseInt(String(procedimentoIdRaw), 10);
      if (Number.isNaN(procedimentoId)) return res.status(400).json({ error: 'procedimentoId query parameter must be an integer' });
      // If the uploads table doesn't have procedimento_id, gracefully return empty list
      const hasCol = await columnExists('uploads', 'procedimento_id');
      if (!hasCol) {
        console.info('[uploads.list] uploads.procedimento_id column missing; returning empty list for procedimentoId', { procedimentoId });
        return res.json({ ok: true, uploads: [] });
      }
      whereClause = 'procedimento_id = $1';
      params = [procedimentoId];
    } else if (averbacaoIdRaw) {
      const averbacaoId = parseInt(String(averbacaoIdRaw), 10);
      if (Number.isNaN(averbacaoId)) return res.status(400).json({ error: 'averbacaoId query parameter must be an integer' });
      // If the uploads table doesn't have averbacao_id, gracefully return empty list
      const hasCol = await columnExists('uploads', 'averbacao_id');
      if (!hasCol) {
        console.info('[uploads.list] uploads.averbacao_id column missing; returning empty list for averbacaoId', { averbacaoId });
        return res.json({ ok: true, uploads: [] });
      }
      whereClause = 'averbacao_id = $1';
      params = [averbacaoId];
    } else {
      return res.status(400).json({ error: 'atoId (with tipo) or averbacaoId or procedimentoId query parameter required' });
    }

    const rows = await pool.query(`SELECT id, "key", stored_name, original_name, bucket, content_type, size, status, metadata, created_at, updated_at FROM public.uploads WHERE ${whereClause} ORDER BY created_at DESC`, params);
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
router.post('/complete', async (req, res) => {
  try {
    const { key: incomingKey, metadata } = req.body || {};
    console.info('[uploads.complete] incoming', { key: incomingKey ? maskKey(incomingKey) : null, metadata: metadata ? metadata : null, ip: req.ip, body: req.body });
    if (!incomingKey) return res.status(400).json({ error: 'key required' });

    // Normalize variables we'll use and keep a mutable key variable
    let key = String(incomingKey);
    const meta = metadata || {};
    let attachedAverbacaoId = null;
    let storedName = null;

    // Verify object exists via HeadObject
    let head;
    try {
      console.info('[uploads.complete] checking HeadObject', { bucket: BB_BUCKET_NAME, key: maskKey(key) });
      head = await s3.send(new HeadObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
      console.info('[uploads.complete] HeadObject OK', { contentLength: head.ContentLength, contentType: head.ContentType, lastModified: head.LastModified });
    } catch (hErr) {
      console.error('[uploads.complete] HeadObject failed', hErr && hErr.message ? hErr.message : hErr);
      return res.status(404).json({ error: 'object not found in storage', details: hErr && hErr.message ? hErr.message : String(hErr) });
    }

    // Build public URL (best-effort)
    const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
    const publicUrl = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;

    // Update uploads row if exists (set size, content_type, metadata, status 'complete')
    try {
      const size = head.ContentLength || head.ContentLength === 0 ? Number(head.ContentLength) : null;
      const contentType = head.ContentType || null;
      const averbacaoIdFromBody = req.body && (req.body.averbacaoId || req.body.averbacao_id || (meta && (meta.averbacaoId || meta.averbacao_id)));
      const averbacaoId = averbacaoIdFromBody ? parseInt(String(averbacaoIdFromBody), 10) : null;
      const procedimentoIdFromBody = req.body && (req.body.procedimentoId || req.body.procedimento_id || (meta && (meta.procedimentoId || meta.procedimento_id)));
      const procedimentoId = procedimentoIdFromBody ? parseInt(String(procedimentoIdFromBody), 10) : null;
      const atoIdFromBody = req.body && (req.body.atoId || req.body.ato_id || (meta && (meta.atoId || meta.ato_id)));
      const atoId = atoIdFromBody ? parseInt(String(atoIdFromBody), 10) : null;
      const atoTipoFromBody = req.body && (req.body.atoTipo || req.body.ato_tipo || (meta && (meta.atoTipo || meta.ato_tipo)));
      const atoTipo = atoTipoFromBody ? String(atoTipoFromBody).toLowerCase() : null;

      try {
        // Build an update SQL that only sets columns that exist to avoid errors on older schemas
        const hasAverbacaoCol = await columnExists('uploads', 'averbacao_id');
        const hasProcedimentoCol = await columnExists('uploads', 'procedimento_id');
        const hasAtoIdCol = await columnExists('uploads', 'ato_id');
        const hasAtoTypeCol = await columnExists('uploads', 'ato_type');

        let updateSql = `UPDATE public.uploads SET size=$1, content_type=$2, status=$3, metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb`;
        const updateVals = [size, contentType, 'complete', JSON.stringify(meta || {})];
        let idx = updateVals.length; // current param index

        if (hasAverbacaoCol) {
          updateVals.push(averbacaoId);
          idx++;
          updateSql += `, averbacao_id = $${idx}`;
        }

        if (hasProcedimentoCol) {
          updateVals.push(procedimentoId);
          idx++;
          updateSql += `, procedimento_id = $${idx}`;
        }

        if (hasAtoIdCol) {
          updateVals.push(atoId);
          idx++;
          updateSql += `, ato_id = $${idx}`;
        }

        if (hasAtoTypeCol) {
          updateVals.push(atoTipo);
          idx++;
          updateSql += `, ato_type = $${idx}`;
        }

        // final WHERE key
        updateVals.push(key);
        idx++;
        updateSql += `, updated_at=now() WHERE "key" = $${idx} RETURNING id, stored_name, original_name`;
        if (hasAverbacaoCol) updateSql += ', averbacao_id';
        if (hasProcedimentoCol) updateSql += ', procedimento_id';
        if (hasAtoIdCol) updateSql += ', ato_id';
        if (hasAtoTypeCol) updateSql += ', ato_type';

        var ures = null;
        try {
          ures = await pool.query(updateSql, updateVals);
          console.info('[uploads.complete] uploads table update result', { rowCount: ures && ures.rowCount, rows: ures && ures.rows && ures.rows.length ? ures.rows.length : 0 });
          if (ures && ures.rowCount && ures.rows[0]) {
            storedName = ures.rows[0].stored_name || ures.rows[0].storedName || null;
          }
        } catch (updErr) {
          console.warn('[uploads.complete] failed to update uploads table', updErr && updErr.message ? updErr.message : updErr);
        }
      } catch (colErr) {
        console.warn('[uploads.complete] column existence checks failed (continuing without procedimento/averbacao/ato assignment)', colErr && colErr.message ? colErr.message : colErr);
        // fallback: try updating without those columns
        try {
          const fallbackSql = `UPDATE public.uploads SET size=$1, content_type=$2, status=$3, metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb, updated_at=now() WHERE "key" = $5 RETURNING id, stored_name, original_name`;
          const fallbackVals = [size, contentType, 'complete', JSON.stringify(meta || {}), key];
          const fallbackRes = await pool.query(fallbackSql, fallbackVals);
          ures = fallbackRes;
          if (ures && ures.rowCount && ures.rows[0]) storedName = ures.rows[0].stored_name || ures.rows[0].storedName || null;
        } catch (fallbackErr) {
          console.warn('[uploads.complete] fallback update also failed', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr);
        }
      }
    } catch (e) {
      console.warn('[uploads.complete] unexpected error updating uploads row', e && e.message ? e.message : e);
    }

    // --- Best-effort: rename object to structured path and sequential filename ---
    try {
      if (ures && ures.rowCount && ures.rows[0]) {
        const uploadedRow = ures.rows[0];
        const uploadId = uploadedRow.id;

        // Determine type: PROCEDIMENTO or AVERBACAO. Prefer explicit metadata.
        const rawTipo = (meta && (meta.tipo || meta.type)) || '';
        const normalizedTipo = String(rawTipo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        let typeName = 'AVERBACAO';
        if (normalizedTipo === 'procedimento' || normalizedTipo.startsWith('proced')) {
          typeName = 'PROCEDIMENTO';
        } else if (normalizedTipo === 'averbacao' || normalizedTipo.startsWith('averb')) {
          typeName = 'AVERBACAO';
        }

        // Current year/month
        const d = new Date();
        const year = String(d.getFullYear());
        const month = String(d.getMonth() + 1).padStart(2, '0');

        const folderPrefix = `ATOS_GRATUITOS/${year}/${month}`;

        // Compute next sequence number (000-999) for this type within the folder (reset each month)
        let nextSeq = 0;
        try {
          const regexCapture = `^${typeName}([0-9]{3})\\.PDF$`;
          const likeKey = `${folderPrefix}/%`;
          const seqSql = `SELECT COALESCE(MAX((regexp_matches(stored_name, $1))[1]::int), -1) as maxnum FROM public.uploads WHERE key LIKE $2`;
          const seqRes = await pool.query(seqSql, [regexCapture, likeKey]);
          const maxnum = seqRes && seqRes.rows && seqRes.rows[0] && seqRes.rows[0].maxnum !== null ? Number(seqRes.rows[0].maxnum) : -1;
          nextSeq = (maxnum + 1) % 1000;
        } catch (eSeq) {
          console.warn('[uploads.complete] failed to compute sequence number for structured filename', eSeq && eSeq.message ? eSeq.message : eSeq);
          nextSeq = Math.floor(Math.random() * 1000); // fallback
        }

        const seqStr = String(nextSeq).padStart(3, '0');
        const finalFilename = `${typeName}${seqStr}.PDF`;
        const finalKey = `${folderPrefix}/${finalFilename}`;

        const origKey = String(key || '');
        console.info('[uploads.complete] attempting structured rename in storage', { from: maskKey(origKey), to: maskKey(finalKey), type: typeName, seq: seqStr });

        try {
          // Copy to final key. Ensure CopySource is URL-encoded to avoid issues with special chars.
          const copySource = `${BB_BUCKET_NAME}/${encodeURIComponent(origKey)}`;
          await s3.send(new CopyObjectCommand({
            Bucket: BB_BUCKET_NAME,
            CopySource: copySource,
            Key: finalKey,
            ContentType: head.ContentType || 'application/pdf'
          }));

          // Attempt to delete original temporary object with retries to avoid leaving stray copies
          const deleteWithRetries = async (bucket, keyToDelete, attempts = 3, delayMs = 500) => {
            for (let i = 0; i < attempts; i++) {
              try {
                await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: keyToDelete }));
              } catch (delErr) {
                // log and continue to verification step
                console.warn('[uploads.complete] DeleteObject attempt failed', { attempt: i + 1, key: maskKey(keyToDelete), message: delErr && delErr.message ? delErr.message : delErr });
              }

              // Verify deletion
              try {
                await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: keyToDelete }));
                // If HeadObject succeeds, object still present; wait and retry
                console.info('[uploads.complete] HeadObject still present after delete attempt', { attempt: i + 1, key: maskKey(keyToDelete) });
                if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
                continue;
              } catch (headErr) {
                const status = headErr && headErr.$metadata && headErr.$metadata.httpStatusCode;
                if (status === 404 || headErr && (headErr.name === 'NotFound' || headErr.code === 'NotFound')) {
                  // deletion confirmed
                  console.info('[uploads.complete] object deletion confirmed after Copy', { key: maskKey(keyToDelete) });
                  return true;
                }
                // Unknown head error, retry
                console.warn('[uploads.complete] HeadObject check error after delete attempt', { attempt: i + 1, key: maskKey(keyToDelete), message: headErr && headErr.message ? headErr.message : headErr });
                if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
              }
            }
            return false;
          };

          const deletedConfirmedLocal = await deleteWithRetries(BB_BUCKET_NAME, origKey, 3, 500);
          if (!deletedConfirmedLocal) {
            console.warn('[uploads.complete] failed to confirm deletion of original object after copy; original may remain at old path', { origKey: maskKey(origKey), finalKey: maskKey(finalKey) });
          }

          // Update uploads row with final key/stored_name
          try {
            const up2 = await pool.query('UPDATE public.uploads SET "key" = $1, stored_name = $2, updated_at = NOW() WHERE id = $3 RETURNING id, stored_name', [finalKey, finalFilename, uploadId]);
            if (up2 && up2.rowCount) {
              console.info('[uploads.complete] uploads row updated with final structured key', { id: uploadId, storedName: finalFilename });
              // use final values for response and subsequent attach attempts
              key = finalKey;
              storedName = finalFilename;
            }
          } catch (eUpd2) {
            console.warn('[uploads.complete] failed to update uploads row after structured rename', eUpd2 && eUpd2.message ? eUpd2.message : eUpd2);
          }
        } catch (renameErr) {
          console.warn('[uploads.complete] failed to rename object in storage to structured path (continuing)', renameErr && renameErr.message ? renameErr.message : renameErr);
        }
      }
    } catch (eRename) {
      console.warn('[uploads.complete] structured rename attempt unexpected error', eRename && eRename.message ? eRename.message : eRename);
    }
    // --- end structured rename block ---

    // Rebuild publicUrl if key changed
    const host2 = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
    const publicUrlFinal = host2 ? `https://${BB_BUCKET_NAME}.${host2}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;

    // If caller provided an averbacao id, attach the public URL to that averbacao (best-effort)
    try {
      const averbacaoIdFromBody = req.body && (req.body.averbacaoId || req.body.averbacao_id || (meta && (meta.averbacaoId || meta.averbacao_id)));
      const averbacaoId = averbacaoIdFromBody ? parseInt(String(averbacaoIdFromBody), 10) : null;
      if (!Number.isNaN(averbacaoId) && averbacaoId) {
        console.info('[uploads.complete] attempting to attach upload to averbacao', { averbacaoId, publicUrl: publicUrlFinal });
        const pdfMeta = { url: publicUrlFinal, key, metadata: meta };
        try {
          const hasAverbacoesGratuitas = await tableExists('averbacoes_gratuitas');
          const hasAverbacoes = await tableExists('averbacoes');

          if (hasAverbacoesGratuitas) {
            try {
              const updPdf = await pool.query('UPDATE public.averbacoes_gratuitas SET pdf = $1 WHERE id = $2 RETURNING id', [pdfMeta, averbacaoId]);
              console.info('[uploads.complete] update averbacoes_gratuitas(pdf) result', { rowCount: updPdf && updPdf.rowCount });
              if (updPdf && updPdf.rowCount > 0) attachedAverbacaoId = updPdf.rows[0].id;
            } catch (ePdf) {
              console.warn('[uploads.complete] averbacoes_gratuitas(pdf) failed', ePdf && ePdf.message ? ePdf.message : ePdf);
            }

            if (!attachedAverbacaoId) {
              try {
                const updAnexo = await pool.query('UPDATE public.averbacoes_gratuitas SET anexo_url = $1, anexo_metadata = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [publicUrlFinal, meta || null, averbacaoId]);
                console.info('[uploads.complete] update averbacoes_gratuitas(anexo) result', { rowCount: updAnexo && updAnexo.rowCount });
                if (updAnexo && updAnexo.rowCount > 0) attachedAverbacaoId = updAnexo.rows[0].id;
              } catch (eAnexo) {
                console.warn('[uploads.complete] averbacoes_gratuitas(anexo) failed', eAnexo && eAnexo.message ? eAnexo.message : eAnexo);
              }
            }
          }

          if (!attachedAverbacaoId && hasAverbacoes) {
            try {
              const updPdfB = await pool.query('UPDATE public.averbacoes SET pdf = $1 WHERE id = $2 RETURNING id', [pdfMeta, averbacaoId]);
              console.info('[uploads.complete] update averbacoes(pdf) result', { rowCount: updPdfB && updPdfB.rowCount });
              if (updPdfB && updPdfB.rowCount > 0) attachedAverbacaoId = updPdfB.rows[0].id;
            } catch (eB) {
              console.warn('[uploads.complete] averbacoes(pdf) failed', eB && eB.message ? eB.message : eB);
            }

            if (!attachedAverbacaoId) {
              try {
                const updLegacy = await pool.query('UPDATE public.averbacoes SET pdf_url = $1, pdf_filename = $2, updated_at = NOW() WHERE id = $3 RETURNING id', [publicUrlFinal, storedName || null, averbacaoId]);
                console.info('[uploads.complete] update averbacoes(legacy) result', { rowCount: updLegacy && updLegacy.rowCount });
                if (updLegacy && updLegacy.rowCount > 0) attachedAverbacaoId = updLegacy.rows[0].id;
              } catch (eLegacy) {
                console.warn('[uploads.complete] averbacoes(legacy) failed', eLegacy && eLegacy.message ? eLegacy.message : eLegacy);
              }
            }
          }
        } catch (eAttach) {
          console.warn('[uploads.complete] averbacao attach attempt failed', eAttach && eAttach.message ? eAttach.message : eAttach);
        }
      }
    } catch (e) {
      console.warn('[uploads.complete] unexpected error while attempting attach', e && e.message ? e.message : e);
    }

    // Prepare averbacao row (if attached) so frontend can get metadata in the same response (optional)
    let averbacaoRow = null;
    if (attachedAverbacaoId) {
      try {
        const hasAverbacoesGratuitas = await tableExists('averbacoes_gratuitas');
        const hasAverbacoes = await tableExists('averbacoes');
        if (hasAverbacoesGratuitas) {
          const sel = await pool.query('SELECT * FROM public.averbacoes_gratuitas WHERE id = $1', [attachedAverbacaoId]);
          if (sel && sel.rowCount > 0) averbacaoRow = sel.rows[0];
        }
        if (!averbacaoRow && hasAverbacoes) {
          const sel2 = await pool.query('SELECT * FROM public.averbacoes WHERE id = $1', [attachedAverbacaoId]).catch(() => null);
          if (sel2 && sel2.rowCount > 0) averbacaoRow = sel2.rows[0];
        }
      } catch (e) {
        console.warn('[uploads.complete] error while fetching attached averbacao row', e && e.message ? e.message : e);
      }
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

    return res.json({
      ok: true,
      key,
      storedName: storedName || (key ? key.split('/').pop() : null),
      url: publicUrlFinal,
      downloadUrl,
      attachedAverbacaoId: attachedAverbacaoId || null,
      averbacao: averbacaoRow || null
    });
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

    // If a permanent purge is requested, require auth (Registrador) before proceeding.
    try {
      const purgeCleanupAuth = req.query && String(req.query.purge || '').toLowerCase() === 'true';
      if (purgeCleanupAuth) {
        await new Promise((resolve) => ensureAuth(req, res, resolve));
        if (res.headersSent) return; // ensureAuth already responded (401/403)

        // Require explicit confirm flag to avoid accidental purges
        const confirmCleanup = req.query && String(req.query.confirm || '').toLowerCase() === 'true';
        if (!confirmCleanup) {
          return res.status(400).json({ error: 'purge requires confirm=true to proceed' });
        }
      }
    } catch (e) {
      // ignore and continue; ensureAuth handles responses
    }

    // Attempt to delete from storage (best-effort)
    console.info('[uploads.delete] attempting DeleteObject', { id, key });
    let deletedConfirmed = false;
    try {
      if (key && BB_BUCKET_NAME) {
        await s3.send(new DeleteObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
        // Verify deletion: HeadObject should return 404 when object removed.
        try {
          await s3.send(new HeadObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
          // if HeadObject succeeds, object still present
          console.warn('[uploads.delete] HeadObject succeeded after DeleteObject - object still exists', { id, key });
        } catch (headErr) {
          const status = headErr && headErr.$metadata && headErr.$metadata.httpStatusCode;
          if (status === 404 || headErr && (headErr.name === 'NotFound' || headErr.code === 'NotFound')) {
            deletedConfirmed = true;
            console.info('[uploads.delete] object deletion confirmed (HeadObject 404)', { id, key });
          } else {
            console.warn('[uploads.delete] HeadObject check after delete failed', headErr && headErr.message ? headErr.message : headErr);
          }
        }
        console.info('[uploads.delete] S3 DeleteObject attempted', { id, key, deletedConfirmed });
      }
    } catch (eDel) {
      console.warn('[uploads.delete] failed to delete object from storage (continuing)', eDel && eDel.message ? eDel.message : eDel);
    }

    // If storage deletion was confirmed, remove the DB row automatically.
    if (deletedConfirmed) {
      console.info('[uploads.delete] storage deletion confirmed — attempting automatic DB removal', { id });
      try {
        // Insert audit log if table exists
        try {
          const hasLogs = await tableExists('uploads_cleanup_logs');
          if (hasLogs) {
            const performedBy = (req.user && (req.user.email || req.user.id || req.user.username)) || 'system-auto';
            const details = JSON.stringify({ id, key, action: 'auto-purge', at: new Date().toISOString() });
            await pool.query('INSERT INTO public.uploads_cleanup_logs (upload_id, performed_by, action, details) VALUES ($1,$2,$3,$4)', [id, performedBy, 'auto-purge', details]);
            console.info('[uploads.delete] audit log inserted for automatic purge', { id });
          } else {
            console.info('[uploads.delete] uploads_cleanup_logs missing; skipping audit log for automatic purge', { id });
          }
        } catch (eLogAuto) {
          console.warn('[uploads.delete] failed to insert audit log for automatic purge', eLogAuto && eLogAuto.message ? eLogAuto.message : eLogAuto);
        }

        const delRes = await pool.query('DELETE FROM public.uploads WHERE id = $1 RETURNING id', [id]);
        if (delRes && delRes.rowCount > 0) {
          console.info('[uploads.delete] uploads row automatically purged', { id });
          return res.json({ ok: true, deletedId: id, purged: true, auto: true });
        }
        console.warn('[uploads.delete] automatic DB delete returned no rows (falling back to soft-delete)', { id });
      } catch (eAutoDel) {
        console.warn('[uploads.delete] automatic DB deletion failed, will try soft-delete', eAutoDel && eAutoDel.message ? eAutoDel.message : eAutoDel);
      }
    }

    // Fallback: Mark uploads row as deleted (soft-delete)
    try {
      const up = await pool.query('UPDATE public.uploads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', ['deleted', id]);
      console.info('[uploads.delete] uploads row updated (soft-delete)', { rowCount: up && up.rowCount });
    } catch (eUp) {
      console.warn('[uploads.delete] failed to update uploads row status (soft-delete)', eUp && eUp.message ? eUp.message : eUp);
    }

    // Optional permanent purge: DELETE /api/uploads/:id?purge=true
    try {
      const purge = req.query && String(req.query.purge || '').toLowerCase() === 'true';
      if (purge) {
        // Require authenticated Registrador (ensureAuth) for destructive purge.
        await new Promise((resolve) => ensureAuth(req, res, resolve));
        if (res.headersSent) return; // ensureAuth already responded (401/403)

        // Require explicit confirm flag to avoid accidental purges
        const confirm = req.query && String(req.query.confirm || '').toLowerCase() === 'true';
        if (!confirm) {
          return res.status(400).json({ error: 'purge requires confirm=true to proceed' });
        }

        // Only allow permanent purge if storage deletion was confirmed
        if (!deletedConfirmed) {
          return res.status(409).json({ error: 'object deletion in storage not confirmed; aborting purge' });
        }

        try {
          // Insert audit log prior to permanent deletion when the logs table exists.
          try {
            const hasLogs = await tableExists('uploads_cleanup_logs');
            if (hasLogs) {
              const performedBy = (req.user && (req.user.email || req.user.id || req.user.username)) || 'unknown';
              const details = JSON.stringify({ id, key, action: 'purge', at: new Date().toISOString() });
              try {
                await pool.query('INSERT INTO public.uploads_cleanup_logs (upload_id, performed_by, action, details) VALUES ($1,$2,$3,$4)', [id, performedBy, 'purge', details]);
                console.info('[uploads.delete] audit log inserted for purge', { id });
              } catch (eLog) {
                console.warn('[uploads.delete] failed to insert audit log for purge', eLog && eLog.message ? eLog.message : eLog);
              }
            }
          } catch (eLogCheck) {
            console.warn('[uploads.delete] failed to check logs table existence before purge', eLogCheck && eLogCheck.message ? eLogCheck.message : eLogCheck);
          }

          const delRes = await pool.query('DELETE FROM public.uploads WHERE id = $1 RETURNING id', [id]);
          if (delRes && delRes.rowCount > 0) {
            console.info('[uploads.delete] uploads row permanently purged', { id });
            return res.json({ ok: true, deletedId: id, purged: true });
          } else {
            return res.status(404).json({ error: 'upload not found for purge' });
          }
        } catch (eP) {
          console.warn('[uploads.delete] failed to purge uploads row', eP && eP.message ? eP.message : eP);
          return res.status(500).json({ error: 'failed to purge uploads row' });
        }
      }
    } catch (e) {
      /* ignore purge errors and continue with soft-delete */
    }

    // If this upload was linked to an averbacao, attempt to remove references
    if (linkedAverbacaoId) {
      try {
        // Build public URL used elsewhere
        const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
        const publicUrl = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;

        // Check which averbacao-related tables exist and only attempt updates
        const hasAverbacoesGratuitas = await tableExists('averbacoes_gratuitas');
        const hasAverbacoes = await tableExists('averbacoes');

        if (hasAverbacoesGratuitas) {
          try {
            await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 )`, [linkedAverbacaoId, key, publicUrl]);
          } catch (e) { console.warn('[uploads.delete] clearing pdf json failed (averbacoes_gratuitas)', e && e.message ? e.message : e); }

          try {
            await pool.query(`UPDATE public.averbacoes_gratuitas SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3)`, [linkedAverbacaoId, publicUrl, publicUrl]);
          } catch (e) { console.warn('[uploads.delete] clearing anexo_url failed (averbacoes_gratuitas)', e && e.message ? e.message : e); }

          try {
            await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3 OR pdf_filename = $4)`, [linkedAverbacaoId, publicUrl, storedName, storedName]);
          } catch (e) { console.warn('[uploads.delete] clearing legacy pdf fields failed (averbacoes_gratuitas)', e && e.message ? e.message : e); }
        }

        if (hasAverbacoes) {
          try {
            await pool.query(`UPDATE public.averbacoes SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 )`, [linkedAverbacaoId, key, publicUrl]);
          } catch (e) { console.warn('[uploads.delete] clearing averbacoes.pdf json failed (averbacoes)', e && e.message ? e.message : e); }

          try {
            await pool.query(`UPDATE public.averbacoes SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3)`, [linkedAverbacaoId, publicUrl, publicUrl]);
          } catch (e) { console.warn('[uploads.delete] clearing averbacoes.anexo_url failed (averbacoes)', e && e.message ? e.message : e); }

          try {
            await pool.query(`UPDATE public.averbacoes SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3)`, [linkedAverbacaoId, publicUrl, storedName]);
          } catch (e) { /* some schemas may not have these legacy fields; ignore */ }
        }
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

// POST /:id/cleanup
// One-off endpoint to forcibly cleanup an upload: delete object from storage,
// clear references in any existing averbacao tables, and mark the uploads row
// as deleted. Returns a structured report of actions performed.
router.post('/:id/cleanup', async (req, res) => {
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

    const report = {
      id,
      key,
      deletedFromStorage: false,
      uploadsRowUpdated: false,
      clearedAverbacoesGratuitas: 0,
      clearedAverbacoes: 0
    };

    // Attempt to delete from storage (best-effort)
    try {
      if (key && BB_BUCKET_NAME) {
        await s3.send(new DeleteObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
        // Verify deletion via HeadObject
        try {
          await s3.send(new HeadObjectCommand({ Bucket: BB_BUCKET_NAME, Key: key }));
          // still exists
          report.deletedFromStorage = false;
          console.warn('[uploads.cleanup] HeadObject succeeded after DeleteObject - object still exists', { id, key });
        } catch (headErr) {
          const status = headErr && headErr.$metadata && headErr.$metadata.httpStatusCode;
          if (status === 404 || headErr && (headErr.name === 'NotFound' || headErr.code === 'NotFound')) {
            report.deletedFromStorage = true;
            console.info('[uploads.cleanup] object deletion confirmed (HeadObject 404)', { id, key });
          } else {
            console.warn('[uploads.cleanup] HeadObject check after delete failed', headErr && headErr.message ? headErr.message : headErr);
          }
        }
        console.info('[uploads.cleanup] S3 DeleteObject attempted', { id, key, deletedFromStorage: report.deletedFromStorage });
      }
    } catch (eDel) {
      console.warn('[uploads.cleanup] failed to delete object from storage (continuing)', eDel && eDel.message ? eDel.message : eDel);
    }

    // Mark uploads row as deleted (soft-delete)
    try {
      const up = await pool.query('UPDATE public.uploads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id', ['deleted', id]);
      report.uploadsRowUpdated = !!(up && up.rowCount > 0);
      console.info('[uploads.cleanup] uploads row updated', { rowCount: up && up.rowCount });
    } catch (eUp) {
      console.warn('[uploads.cleanup] failed to update uploads row status', eUp && eUp.message ? eUp.message : eUp);
    }

    // Build public URL used elsewhere
    const host = (normalizedEndpoint || BB_ENDPOINT || '').replace(/^https?:\/\//, '').replace(/\/+$/,'');
    const publicUrl = host ? `https://${BB_BUCKET_NAME}.${host}/${encodeURIComponent(key)}` : `${normalizedEndpoint || BB_ENDPOINT}/${BB_BUCKET_NAME}/${encodeURIComponent(key)}`;

    // If this upload was linked to an averbacao, attempt to remove references
    if (linkedAverbacaoId) {
      try {
        const hasAverbacoesGratuitas = await tableExists('averbacoes_gratuitas');
        const hasAverbacoes = await tableExists('averbacoes');

        if (hasAverbacoesGratuitas) {
          try {
            const r1 = await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 ) RETURNING id`, [linkedAverbacaoId, key, publicUrl]);
            report.clearedAverbacoesGratuitas += (r1 && r1.rowCount) || 0;
          } catch (e) { console.warn('[uploads.cleanup] clearing pdf json failed (averbacoes_gratuitas)', e && e.message ? e.message : e); }

          try {
            const r2 = await pool.query(`UPDATE public.averbacoes_gratuitas SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3) RETURNING id`, [linkedAverbacaoId, publicUrl, publicUrl]);
            report.clearedAverbacoesGratuitas += (r2 && r2.rowCount) || 0;
          } catch (e) { console.warn('[uploads.cleanup] clearing anexo_url failed (averbacoes_gratuitas)', e && e.message ? e.message : e); }

          try {
            const r3 = await pool.query(`UPDATE public.averbacoes_gratuitas SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3 OR pdf_filename = $4) RETURNING id`, [linkedAverbacaoId, publicUrl, storedName, storedName]);
            report.clearedAverbacoesGratuitas += (r3 && r3.rowCount) || 0;
          } catch (e) { console.warn('[uploads.cleanup] clearing legacy pdf fields failed (averbacoes_gratuitas)', e && e.message ? e.message : e); }
        }

        if (hasAverbacoes) {
          try {
            const r4 = await pool.query(`UPDATE public.averbacoes SET pdf = NULL WHERE id = $1 AND ( (pdf->> 'key') = $2 OR (pdf->> 'url') = $3 ) RETURNING id`, [linkedAverbacaoId, key, publicUrl]);
            report.clearedAverbacoes += (r4 && r4.rowCount) || 0;
          } catch (e) { console.warn('[uploads.cleanup] clearing averbacoes.pdf json failed (averbacoes)', e && e.message ? e.message : e); }

          try {
            const r5 = await pool.query(`UPDATE public.averbacoes SET anexo_url = NULL, anexo_metadata = NULL, updated_at = NOW() WHERE id = $1 AND (anexo_url = $2 OR anexo_url = $3) RETURNING id`, [linkedAverbacaoId, publicUrl, publicUrl]);
            report.clearedAverbacoes += (r5 && r5.rowCount) || 0;
          } catch (e) { console.warn('[uploads.cleanup] clearing averbacoes.anexo_url failed (averbacoes)', e && e.message ? e.message : e); }

          try {
            const r6 = await pool.query(`UPDATE public.averbacoes SET pdf_url = NULL, pdf_filename = NULL, updated_at = NOW() WHERE id = $1 AND (pdf_url = $2 OR pdf_filename = $3) RETURNING id`, [linkedAverbacaoId, publicUrl, storedName]);
            report.clearedAverbacoes += (r6 && r6.rowCount) || 0;
          } catch (e) { /* some schemas may not have these legacy fields; ignore */ }
        }
      } catch (e) {
        console.warn('[uploads.cleanup] error while detaching from averbacao', e && e.message ? e.message : e);
      }
    }

    // Attempt to write an audit log for this cleanup if the table exists.
    try {
      const hasLogs = await tableExists('uploads_cleanup_logs');
      if (hasLogs) {
        const performedBy = (req.user && (req.user.email || req.user.id || req.user.username)) || null;
        try {
          await pool.query('INSERT INTO public.uploads_cleanup_logs (upload_id, performed_by, action, details) VALUES ($1,$2,$3,$4)', [id, performedBy, 'cleanup', JSON.stringify(report)]);
          console.info('[uploads.cleanup] audit log inserted', { uploadId: id });
        } catch (eLog) {
          console.warn('[uploads.cleanup] failed to insert audit log', eLog && eLog.message ? eLog.message : eLog);
        }
      } else {
        console.info('[uploads.cleanup] uploads_cleanup_logs table missing; skipping audit log');
      }
    } catch (eLogCheck) {
      console.warn('[uploads.cleanup] failed to check logs table existence', eLogCheck && eLogCheck.message ? eLogCheck.message : eLogCheck);
    }

    // Optional permanent purge: POST /api/uploads/:id/cleanup?purge=true&confirm=true
    try {
      const purgeCleanup = req.query && String(req.query.purge || '').toLowerCase() === 'true';
      const confirmCleanup = req.query && String(req.query.confirm || '').toLowerCase() === 'true';
      if (purgeCleanup) {
        // ensureAuth was applied earlier when purgeCleanup was true
        if (!confirmCleanup) {
          report.purged = false;
        } else if (!report.deletedFromStorage) {
          // Only allow permanent purge if storage deletion was confirmed
          report.purged = false;
        } else {
          try {
            const delRes = await pool.query('DELETE FROM public.uploads WHERE id = $1 RETURNING id', [id]);
            report.purged = !!(delRes && delRes.rowCount > 0);
            if (report.purged) console.info('[uploads.cleanup] uploads row permanently purged', { id });
          } catch (eP) {
            console.warn('[uploads.cleanup] failed to purge uploads row', eP && eP.message ? eP.message : eP);
            report.purged = false;
          }
        }
      } else {
        report.purged = false;
      }
    } catch (e) {
      report.purged = false;
    }

    return res.json({ ok: true, report });
  } catch (err) {
    console.error('[uploads.cleanup] error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'failed to cleanup upload' });
  }
});

// Export a register function so the main server can call `registerUploads(app)`
// (this matches how `server.js` expects to mount the routes).
function registerUploads(app) {
  app.use('/api/uploads', router);
}

module.exports = { registerUploads };