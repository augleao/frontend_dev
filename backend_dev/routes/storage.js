const express = require('express');
const { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

const router = express.Router();

// Backblaze / S3 config (reuse env vars used elsewhere)
const BB_ENDPOINT = process.env.BB_ENDPOINT; // e.g. https://s3.us-east-005.backblazeb2.com
const BB_REGION = process.env.BB_REGION || 'us-east-1';
const BB_KEY_ID = process.env.BB_KEY_ID;
const BB_APP_KEY = process.env.BB_APP_KEY;
const BB_BUCKET_NAME = process.env.BB_BUCKET_NAME;

const normalizedEndpoint = (BB_ENDPOINT && !/^https?:\/\//i.test(BB_ENDPOINT)) ? `https://${BB_ENDPOINT}` : BB_ENDPOINT;

const s3 = new S3Client({
  region: BB_REGION,
  endpoint: normalizedEndpoint || undefined,
  credentials: BB_KEY_ID && BB_APP_KEY ? { accessKeyId: BB_KEY_ID, secretAccessKey: BB_APP_KEY } : undefined,
  forcePathStyle: false
});

function lastSegmentFromKey(key) {
  if (!key) return key;
  const k = String(key).replace(/\/+$/,'');
  const parts = k.split('/');
  return parts[parts.length - 1] || k;
}

// GET /storage/list?path=
// Returns folders and files under the given prefix. `path` is a prefix like "ATOS_GRATUITOS/2025/11" (no leading slash).
router.get('/list', async (req, res) => {
  try {
    const raw = req.query.path || '';
    let prefix = String(raw || '').replace(/^\/+/, '');
    if (prefix && !prefix.endsWith('/')) prefix = prefix + '/';

    const params = { Bucket: BB_BUCKET_NAME, Prefix: prefix, Delimiter: '/' };
    const listRes = await s3.send(new ListObjectsV2Command(params));

    const items = [];

    // folders (CommonPrefixes)
    if (listRes.CommonPrefixes && Array.isArray(listRes.CommonPrefixes)) {
      for (const cp of listRes.CommonPrefixes) {
        const p = cp.Prefix;
        items.push({ name: lastSegmentFromKey(p), key: p, type: 'folder' });
      }
    }

    // files
    if (listRes.Contents && Array.isArray(listRes.Contents)) {
      for (const obj of listRes.Contents) {
        // skip the prefix placeholder (folder object)
        if (obj.Key === prefix) continue;
        const name = lastSegmentFromKey(obj.Key);
        // create a short signed URL for convenience
        let url = null;
        try {
          const getCmd = new GetObjectCommand({ Bucket: BB_BUCKET_NAME, Key: obj.Key });
          url = await getSignedUrl(s3, getCmd, { expiresIn: parseInt(process.env.DOWNLOAD_URL_EXPIRES || '300', 10) });
        } catch (e) {
          // ignore signed url errors
        }
        items.push({ name, key: obj.Key, type: 'file', size: obj.Size || 0, url });
      }
    }

    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[storage.list] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'failed to list storage objects' });
  }
});

// GET /storage/download?key=
// Streams the object back to the client with Content-Disposition to force download
router.get('/download', async (req, res) => {
  try {
    const key = req.query && req.query.key;
    if (!key) return res.status(400).json({ error: 'key query parameter required' });

    const k = String(key);
    const getCmd = new GetObjectCommand({ Bucket: BB_BUCKET_NAME, Key: k });
    const obj = await s3.send(getCmd);

    // Set headers
    const filename = lastSegmentFromKey(k) || 'file';
    if (obj.ContentType) res.setHeader('Content-Type', obj.ContentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/\"/g,'') }"`);
    if (obj.ContentLength) res.setHeader('Content-Length', String(obj.ContentLength));

    // Stream body
    const body = obj.Body;
    if (!body) return res.status(404).json({ error: 'object has no body' });
    await pipeline(body, res);
  } catch (err) {
    console.error('[storage.download] error', err && err.message ? err.message : err);
    // If object not found, return 404
    const code = err && err.$metadata && err.$metadata.httpStatusCode;
    if (code === 404 || (err && (err.name === 'NotFound' || err.code === 'NotFound'))) return res.status(404).json({ error: 'object not found' });
    return res.status(500).json({ error: 'failed to download object', details: err && err.message ? err.message : String(err) });
  }
});

// DELETE /storage?key=
// Deletes a single object or, when `key` ends with '/', treats as folder prefix and deletes all objects under it.
router.delete('/', async (req, res) => {
  try {
    const key = req.query && req.query.key;
    if (!key) return res.status(400).json({ error: 'key query parameter required' });
    const k = String(key);

    // If looks like a folder (ends with /) delete all keys with this prefix
    if (k.endsWith('/')) {
      const prefix = k;
      let deletedCount = 0;
      let continuationToken = undefined;
      do {
        const listRes = await s3.send(new ListObjectsV2Command({ Bucket: BB_BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken }));
        const contents = listRes.Contents || [];
        if (contents.length) {
          // Delete in batch up to 1000
          const objects = contents.map(c => ({ Key: c.Key }));
          const delRes = await s3.send(new DeleteObjectsCommand({ Bucket: BB_BUCKET_NAME, Delete: { Objects: objects } }));
          const deleted = (delRes && delRes.Deleted) ? delRes.Deleted.length : 0;
          deletedCount += deleted;
        }
        continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
      } while (continuationToken);

      return res.json({ ok: true, deleted: deletedCount });
    }

    // Delete a single object
    await s3.send(new DeleteObjectCommand({ Bucket: BB_BUCKET_NAME, Key: k }));
    return res.json({ ok: true, deleted: 1 });
  } catch (err) {
    console.error('[storage.delete] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'failed to delete object(s)', details: err && err.message ? err.message : String(err) });
  }
});

function registerStorage(app) {
  app.use('/api/storage', router);
}

module.exports = { registerStorage };
