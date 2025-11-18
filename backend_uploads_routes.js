/*
Express router for presigned uploads (prepare/complete) using S3-compatible Backblaze B2.
Drop into your backend project and adapt imports (DB pool, auth) as needed.

Requirements:
- npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner pg
- Set env vars: BZ_S3_ENDPOINT, BZ_S3_REGION, BZ_S3_KEY, BZ_S3_SECRET, BZ_S3_BUCKET
- Database must have `uploads` table (you created it) and `averbacoes_upload_seq` sequence table.

Usage:
const createUploadsRouter = require('./backend_uploads_routes');
const uploadsRouter = createUploadsRouter({ pool: yourPgPool });
app.use('/uploads', uploadsRouter);
*/

const express = require('express');
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Pool } = require('pg');

function sanitizeStoredName(s) {
  return (s || '').replace(/[^a-zA-Z0-9_.-]/g, '-').toUpperCase();
}

module.exports = function createUploadsRouter(opts = {}) {
  const router = express.Router();

  // DB pool: prefer provided pool, otherwise build from DATABASE_URL
  let pool = opts.pool;
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
    if (!connectionString) {
      console.warn('[uploads] No DB pool passed and no DATABASE_URL found. Creating a default pool using PG env vars.');
      pool = new Pool();
    } else {
      pool = new Pool({ connectionString });
    }
  }

  // S3 client: prefer provided, otherwise build from env
  let s3Client = opts.s3Client;
  const BUCKET = process.env.BZ_S3_BUCKET || opts.bucket || 'your-bucket';
  if (!s3Client) {
    const endpoint = process.env.BZ_S3_ENDPOINT; // e.g. 'https://s3.us-east-005.backblazeb2.com'
    const region = process.env.BZ_S3_REGION || 'us-east-1';
    const accessKeyId = process.env.BZ_S3_KEY;
    const secretAccessKey = process.env.BZ_S3_SECRET;
    if (!accessKeyId || !secretAccessKey) {
      console.warn('[uploads] Missing BZ_S3_KEY/SECRET in env; S3 operations will fail until configured.');
    }
    s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      forcePathStyle: true // Backblaze requires path-style
    });
  }

  async function reserveMonthSequence(txClient, anoMes) {
    // Uses table averbacoes_upload_seq(ano_mes PK, seq int)
    // Returns next sequence integer for the month
    const selectSql = 'SELECT seq FROM public.averbacoes_upload_seq WHERE ano_mes = $1 FOR UPDATE';
    const insertSql = 'INSERT INTO public.averbacoes_upload_seq (ano_mes, seq) VALUES ($1, 1)';
    const updateSql = 'UPDATE public.averbacoes_upload_seq SET seq = seq + 1 WHERE ano_mes = $1 RETURNING seq';

    const res = await txClient.query(selectSql, [anoMes]);
    if (res.rowCount === 0) {
      await txClient.query(insertSql, [anoMes]);
      return 1;
    }
    const up = await txClient.query(updateSql, [anoMes]);
    return up.rows[0].seq;
  }

  router.post('/prepare', async (req, res) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      // TODO: validate token / user if your app requires auth

      const { filename, contentType, folder } = req.body || {};
      if (!filename) return res.status(400).json({ error: 'filename required' });

      const now = new Date();
      const anoMes = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`; // YYYYMM
      const mesNome = now.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();

      // Reserve a sequence in a transaction
      const client = await pool.connect();
      let seq;
      try {
        await client.query('BEGIN');
        seq = await reserveMonthSequence(client, anoMes);

        // Build stored name / key
        const ext = (filename && filename.split('.').pop()) || 'pdf';
        const storedName = `AVERBACAO-${String(seq).padStart(3,'0')}-${mesNome}.${ext}`;
        const keyPrefix = folder ? `${folder.replace(/^\/+|\/+$/g, '')}/` : '';
        const key = `${keyPrefix}${storedName}`;

        // Insert uploads record with status 'prepared'
        const insertSql = `INSERT INTO public.uploads ("key", stored_name, original_name, bucket, content_type, status, metadata, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id`;
        const insertVals = [key, storedName, filename, BUCKET, contentType || 'application/pdf', 'prepared', JSON.stringify({ preparedByToken: !!token })];
        const ir = await client.query(insertSql, insertVals);
        const uploadId = ir.rows[0].id;

        await client.query('COMMIT');

        // Generate presigned PUT URL
        const putCommand = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType || 'application/pdf' });
        const expiresIn = parseInt(process.env.UPLOAD_URL_EXPIRES || '900', 10); // seconds
        const url = await getSignedUrl(s3Client, putCommand, { expiresIn });

        return res.json({ ok: true, url, key, uploadId, expiresIn, storedName });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[uploads][prepare] error', err);
      return res.status(500).json({ error: err.message || 'internal error' });
    }
  });

  router.post('/complete', async (req, res) => {
    try {
      const { key, metadata, averbacaoId } = req.body || {};
      if (!key) return res.status(400).json({ error: 'key required' });

      // Verify object exists with HEAD
      try {
        const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        const size = head.ContentLength || head.ContentLength === 0 ? Number(head.ContentLength) : null;
        const contentType = head.ContentType || null;

        // Update uploads row
        const updateSql = `UPDATE public.uploads SET size=$1, content_type=$2, status=$3, metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb, averbacao_id = COALESCE($5, averbacao_id), updated_at=now() WHERE "key" = $6 RETURNING id, stored_name, original_name`;
        const updateVals = [size, contentType, 'complete', JSON.stringify(metadata || {}), averbacaoId || null, key];
        const ures = await pool.query(updateSql, updateVals);
        if (ures.rowCount === 0) {
          return res.status(404).json({ error: 'upload record not found' });
        }

        // Optionally provide a signed GET URL for downloads (short lived)
        const getExpires = parseInt(process.env.DOWNLOAD_URL_EXPIRES || '300', 10);
        const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
        const downloadUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: getExpires });

        return res.json({ ok: true, id: ures.rows[0].id, storedName: ures.rows[0].stored_name, originalName: ures.rows[0].original_name, url: downloadUrl });
      } catch (headErr) {
        console.error('[uploads][complete] HeadObject error', headErr);
        return res.status(400).json({ error: 'object not found in storage or not yet available' });
      }
    } catch (err) {
      console.error('[uploads][complete] error', err);
      return res.status(500).json({ error: err.message || 'internal error' });
    }
  });

  return router;
};
