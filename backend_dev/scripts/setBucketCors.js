#!/usr/bin/env node
// scripts/setBucketCors.js
// Usage (PowerShell):
// $env:BB_ENDPOINT='https://s3.us-east-005.backblazeb2.com';
// $env:BB_KEY_ID='...'; $env:BB_APP_KEY='...'; $env:BB_BUCKET_NAME='bibliofilia-uploads';
// $env:FRONTEND_ORIGIN='https://frontend-dev-e7yt.onrender.com';
// node scripts/setBucketCors.js

const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

async function main() {
  const endpoint = process.env.BB_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
  const region = process.env.BB_REGION || 'us-east-005';
  const accessKeyId = process.env.BB_KEY_ID || process.env.B2_KEY_ID || '005d320f21b26310000000003';
  const secretAccessKey = process.env.BB_APP_KEY || process.env.B2_APP_KEY || 'K0051nQIzDWv9mTV2BsANaTRxLgAJlI';
  const bucket = process.env.BB_BUCKET_NAME || 'bibliofilia-uploads';
  // Allow comma-separated list in FRONTEND_ORIGINS or a single FRONTEND_ORIGIN
  const originsEnv = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || '*';
  const originList = originsEnv.split(',').map(s => s.trim()).filter(Boolean);

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Missing required env vars. Set BB_ENDPOINT, BB_KEY_ID, BB_APP_KEY, BB_BUCKET_NAME.');
    process.exit(1);
  }

  const normalizedEndpoint = (!/^https?:\/\//i.test(endpoint)) ? `https://${endpoint}` : endpoint;

  const s3 = new S3Client({
    region,
    endpoint: normalizedEndpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: originList,
        AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
        MaxAgeSeconds: 3000,
      },
    ],
  };

  try {
    console.log('Applying CORS to bucket', bucket, 'endpoint', normalizedEndpoint.replace(/^https?:\/\//i, ''));
    const cmd = new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: corsConfig });
    const res = await s3.send(cmd);
    console.log('CORS applied successfully:', res);
  } catch (err) {
    console.error('Failed to apply CORS:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
}

main();
