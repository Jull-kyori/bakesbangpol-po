'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const extensionByType = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const r2Variables = [
  process.env.R2_ACCOUNT_ID,
  process.env.R2_ACCESS_KEY_ID,
  process.env.R2_SECRET_ACCESS_KEY,
  process.env.R2_BUCKET_NAME,
  process.env.R2_PUBLIC_URL
];
const hasR2Settings = r2Variables.some(Boolean);
if (hasR2Settings && r2Variables.some((value) => !value)) {
  throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL must all be configured.');
}

let publicUrl;
let r2Client;
if (hasR2Settings) {
  const parsedUrl = new URL(process.env.R2_PUBLIC_URL);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('R2_PUBLIC_URL must be an HTTPS URL without a query string or fragment.');
  }
  publicUrl = parsedUrl.href.replace(/\/+$/, '');
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

const remoteEnabled = Boolean(r2Client);

async function saveImage(file) {
  const extension = extensionByType[file.mimetype];
  if (!extension) throw new Error('Format foto tidak didukung.');
  const filename = crypto.randomBytes(12).toString('hex') + extension;

  if (remoteEnabled) {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      Body: file.buffer || fs.createReadStream(file.path),
      ContentLength: file.size,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable'
    }));
    return `${publicUrl}/${filename}`;
  }

  if (process.env.VERCEL) {
    const error = new Error('Unggahan foto memerlukan konfigurasi penyimpanan Cloudflare R2.');
    error.status = 503;
    throw error;
  }
  if (file.path) return `/uploads/${path.basename(file.path)}`;

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const target = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(target, file.buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}

async function removeImage(imageUrl) {
  if (typeof imageUrl !== 'string') return;

  if (remoteEnabled && imageUrl.startsWith(`${publicUrl}/`)) {
    let filename;
    try {
      filename = decodeURIComponent(new URL(imageUrl).pathname.split('/').pop());
    } catch (error) {
      console.error(`[R2] URL foto tidak valid: ${error.message}`);
      return;
    }
    if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(filename)) return;
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename
      }));
    } catch (error) {
      console.error(`[R2] Gagal menghapus foto: ${error.message}`);
    }
    return;
  }

  if (process.env.VERCEL || !imageUrl.startsWith('/uploads/')) return;
  const filename = path.basename(imageUrl);
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(filename)) return;
  fs.unlink(path.join(UPLOAD_DIR, filename), (error) => {
    if (error && error.code !== 'ENOENT') console.error(`[Upload] Gagal menghapus file: ${error.message}`);
  });
}

module.exports = { remoteEnabled, removeImage, saveImage };
