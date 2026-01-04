#!/usr/bin/env node
// scripts/getBucketCors.js
// Usage (PowerShell):
// $env:BB_ENDPOINT='https://s3.us-east-005.backblazeb2.com';
// $env:BB_KEY_ID='...'; $env:BB_APP_KEY='...'; $env:BB_BUCKET_NAME='bibliofilia-uploads';
// node scripts/getBucketCors.js

const { S3Client, GetBucketCorsCommand } = require('@aws-sdk/client-s3');

async function main() {
  const endpoint = process.env.BB_ENDPOINT;
  const region = process.env.BB_REGION || 'us-east-005';
  const accessKeyId = process.env.BB_KEY_ID;
  const secretAccessKey = process.env.BB_APP_KEY;
  const bucket = process.env.BB_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Missing required environment variables. Set BB_ENDPOINT, BB_KEY_ID, BB_APP_KEY, BB_BUCKET_NAME.');
    process.exit(1);
  }

  const normalizedEndpoint = (!/^https?:\/\//i.test(endpoint)) ? `https://${endpoint}` : endpoint;

  const s3 = new S3Client({
    region,
    endpoint: normalizedEndpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  try {
    const cmd = new GetBucketCorsCommand({ Bucket: bucket });
    const res = await s3.send(cmd);
    console.log(`CORS configuration for bucket '${bucket}':`);
    console.log(JSON.stringify(res.CORSRules || res, null, 2));
  } catch (err) {
    if (err && (err.name === 'NoSuchCORSConfiguration' || err.Code === 'NoSuchCORSConfiguration')) {
      console.log('Bucket has no CORS configuration.');
      process.exit(0);
    }
    console.error('Failed to get CORS:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
}

main();
