const express = require('express');
const AWS = require('aws-sdk');
const archiver = require('archiver');

const router = express.Router();

// Support either S3_* env names or BB_* used elsewhere
const S3_ENDPOINT = process.env.S3_ENDPOINT || process.env.BB_ENDPOINT;
const S3_KEY = process.env.S3_KEY || process.env.BB_KEY_ID;
const S3_SECRET = process.env.S3_SECRET || process.env.BB_APP_KEY;
const S3_BUCKET = process.env.S3_BUCKET || process.env.BB_BUCKET_NAME;

if (!S3_ENDPOINT || !S3_KEY || !S3_SECRET || !S3_BUCKET) {
  console.warn('[storageArchive] missing S3 env vars (S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET or BB_ equivalents)');
}

const s3 = new AWS.S3({
  endpoint: S3_ENDPOINT,
  accessKeyId: S3_KEY,
  secretAccessKey: S3_SECRET,
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
});

// GET /api/storage/archive?key=folder/path/&archive=true
// Streams a ZIP of all objects under the given prefix
router.get('/archive', async (req, res) => {
  try {
    const rawKey = req.query.key || req.query.path;
    if (!rawKey) return res.status(400).send('Missing key/path parameter');

    const prefix = rawKey.endsWith('/') ? rawKey : rawKey + '/';

    // list all objects under prefix (handle continuation)
    let ContinuationToken = undefined;
    const allObjects = [];
    do {
      const listResp = await s3.listObjectsV2({ Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken }).promise();
      if (listResp && Array.isArray(listResp.Contents)) {
        allObjects.push(...listResp.Contents);
      }
      ContinuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : undefined;
    } while (ContinuationToken);

    if (!allObjects.length) return res.status(404).send('Nenhum arquivo encontrado na pasta informada.');

    const folderName = prefix.replace(/\/$/, '').split('/').pop() || 'arquivos';
    const zipFilename = `${folderName}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);
    if (res.setTimeout) res.setTimeout(0);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => {
      console.error('[storageArchive] Archiver error:', err);
      try { if (!res.headersSent) res.status(500).end(); } catch (e) {}
    });
    archive.pipe(res);

    for (const obj of allObjects) {
      const key = obj.Key;
      const nameInZip = key.replace(prefix, '');
      if (!nameInZip) continue; // skip folder markers

      // getObject stream
      const s3obj = s3.getObject({ Bucket: S3_BUCKET, Key: key });
      const stream = s3obj.createReadStream();
      archive.append(stream, { name: nameInZip });
    }

    await archive.finalize();
    // response ends when archive finishes
  } catch (err) {
    console.error('[storageArchive] error creating ZIP:', err && err.message ? err.message : err);
    if (!res.headersSent) res.status(500).send('Erro ao gerar ZIP: ' + (err.message || 'unknown'));
  }
});

module.exports = router;
