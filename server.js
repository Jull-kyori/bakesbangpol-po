'use strict';
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// --- Baca file .env sederhana (tanpa library tambahan) ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 jam
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const MAX_GALERI = 10;
const MAX_DOKUMENTASI_PHOTOS = 10;
const { pool, readState, updateState, verifyState } = require('./lib/storage');
const DEFAULT_SITE_SETTINGS = Object.freeze({
  brandName: 'BAKESBANGPOL',
  organizationName: 'Badan Kesatuan Bangsa dan Politik',
  district: 'Kabupaten Ponorogo',
  address: 'Kabupaten Ponorogo, Jawa Timur',
  phone: '',
  email: '',
  serviceHours: '',
  announcementEnabled: false,
  announcement: ''
});

if (IS_PRODUCTION) {
  if (ADMIN_PASSWORD.length < 16 || ADMIN_PASSWORD.startsWith('ganti_dengan_')) {
    throw new Error('Production requires ADMIN_PASSWORD with at least 16 characters.');
  }
  if (process.env.COOKIE_SECURE !== 'true') {
    throw new Error('Production requires COOKIE_SECURE=true behind HTTPS.');
  }
}
if (!ADMIN_PASSWORD) {
  console.warn('[PERINGATAN] ADMIN_PASSWORD belum diatur. Login admin dinonaktifkan.');
}

const KATEGORI = [
  'Sekretariat',
  'Ideologi & Wawasan Kebangsaan',
  'Politik Dalam Negeri & Ormas',
  'Kewaspadaan Nasional'
];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readSiteSettings(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    throw new Error('Pengaturan situs harus berupa object JSON.');
  }
  const settings = { ...DEFAULT_SITE_SETTINGS };
  for (const field of ['brandName', 'organizationName', 'district', 'address', 'phone', 'email', 'serviceHours', 'announcement']) {
    if (saved[field] !== undefined && typeof saved[field] !== 'string') {
      throw new Error(`Pengaturan ${field} harus berupa teks.`);
    }
    if (saved[field] !== undefined) settings[field] = saved[field];
  }
  for (const field of ['announcementEnabled']) {
    if (saved[field] !== undefined && typeof saved[field] !== 'boolean') {
      throw new Error(`Pengaturan ${field} harus berupa pilihan aktif/nonaktif.`);
    }
    if (saved[field] !== undefined) settings[field] = saved[field];
  }
  return settings;
}

function publicSiteSettings(saved) {
  const { brandName, organizationName, district, address, phone, email, serviceHours,
    announcementEnabled, announcement } = readSiteSettings(saved);
  return {
    brandName, organizationName, district, address, phone, email, serviceHours,
    announcementEnabled, announcement
  };
}
function validateSiteSettings(body) {
  const errors = [];
  const stringField = (name, label, maxLength) => {
    if (typeof body[name] !== 'string') {
      errors.push(`${label} harus berupa teks.`);
      return '';
    }
    const value = body[name].trim();
    if (value.length > maxLength) errors.push(`${label} maksimal ${maxLength} karakter.`);
    return value.slice(0, maxLength);
  };
  const settings = {
    brandName: stringField('brandName', 'Nama singkat situs', 80),
    organizationName: stringField('organizationName', 'Nama instansi', 120),
    district: stringField('district', 'Nama wilayah', 80),
    address: stringField('address', 'Alamat', 240),
    phone: stringField('phone', 'Telepon', 40),
    email: stringField('email', 'Email', 120),
    serviceHours: stringField('serviceHours', 'Jam layanan', 120),
    announcement: stringField('announcement', 'Pengumuman', 300)
  };
  for (const [field, label] of [['brandName', 'Nama singkat situs'], ['organizationName', 'Nama instansi'], ['district', 'Nama wilayah']]) {
    if (!settings[field]) errors.push(`${label} wajib diisi.`);
  }
  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    errors.push('Format email tidak valid.');
  }
  if (typeof body.announcementEnabled !== 'boolean') {
    errors.push('Status pengumuman harus berupa pilihan aktif/nonaktif.');
  }
  if (body.announcementEnabled === true && !settings.announcement) {
    errors.push('Isi pengumuman wajib diisi jika pengumuman diaktifkan.');
  }
  return { settings: { ...settings, announcementEnabled: body.announcementEnabled }, errors };
}
function removeUpload(gambar) {
  if (typeof gambar === 'string' && gambar.startsWith('/uploads/')) {
    fs.unlink(path.join(UPLOAD_DIR, path.basename(gambar)), (error) => {
      if (error && error.code !== 'ENOENT') console.error(`[Upload] Gagal menghapus file: ${error.message}`);
    });
  }
}

// --- Komentar, reaksi, dan laporan ---
function visitorKey(req, res) {
  let token = getCookie(req, 'visitor');
  if (!/^[a-f0-9]{64}$/.test(token || '')) {
    token = crypto.randomBytes(32).toString('hex');
    let value = `visitor=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`;
    if (process.env.COOKIE_SECURE === 'true') value += '; Secure';
    res.append('Set-Cookie', value);
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}
function consumeLimit(limits, key, max, windowMs) {
  const now = Date.now();
  if (limits.size > 10000) {
    for (const [entryKey, entry] of limits) {
      if (entry.resetAt <= now) limits.delete(entryKey);
    }
  }
  let entry = limits.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    limits.set(key, entry);
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
const commentLimits = new Map();
const reportLimits = new Map();
const reactionLimits = new Map();
function findComment(data, id) {
  return data.comments.find((item) => item.id === id && !item.deletedAt);
}
function isPublishedComment(data, item) {
  const seen = new Set();
  let current = item;
  while (current) {
    if (current.deletedAt || current.status === 'pending' || current.status === 'rejected' || seen.has(current.id)) {
      return false;
    }
    seen.add(current.id);
    if (!current.parentId) return true;
    current = findComment(data, current.parentId);
  }
  return false;
}

// --- Sesi & login ---
const sessions = new Map();
const attempts = new Map();

function getCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const p = part.trim();
    const i = p.indexOf('=');
    if (i > 0 && p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}
function isAdmin(req) {
  const token = getCookie(req, 'sid');
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function requireAdmin(req, res, next) {
  if (isAdmin(req)) {
    req.adminAuthenticated = true;
    return next();
  }
  res.status(401).json({ error: 'Sesi berakhir. Silakan masuk lagi.' });
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function cookie(value, maxAgeSec) {
  let c = `sid=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;
  if (process.env.COOKIE_SECURE === 'true') c += '; Secure';
  return c;
}

// --- Upload gambar ---
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
function hasExpectedFileSignature(file) {
  const descriptor = fs.openSync(file.path, 'r');
  const header = Buffer.alloc(12);
  let bytesRead;
  try {
    bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (file.mimetype === 'image/jpeg') return bytesRead >= 3 && header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (file.mimetype === 'image/png') return bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  return false;
}
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype])
  }),
 limits: { fileSize: 3 * 1024 * 1024, files: MAX_GALERI + 1 },
  fileFilter: (req, file, cb) =>
    EXT[file.mimetype] ? cb(null, true) : cb(new Error('Gambar harus berformat JPG, PNG, atau WebP.'))
});
function uploadImage(req, res, next) {
  upload.fields([
    { name: 'gambar', maxCount: 1 },
    { name: 'galeri', maxCount: MAX_GALERI }
  ])(req, res, (err) => {
    if (!err) {
      try {
        const files = [coverFile(req), ...galleryFiles(req)].filter(Boolean);
        if (!files.some((file) => !hasExpectedFileSignature(file))) return next();
        discardUploads(req);
        return res.status(400).json({ error: 'Isi file tidak sesuai dengan format gambar yang dipilih.' });
      } catch (error) {
        discardUploads(req);
        return next(error);
      }
    }
    discardUploads(req);
    let msg = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') msg = 'Ukuran tiap gambar maksimal 3 MB.';
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') msg = `Maksimal ${MAX_GALERI} foto galeri dan 1 gambar cover.`;
    res.status(400).json({ error: msg });
  });
}
function discardDocumentationUploads(req) {
  (req.files || []).forEach((file) => removeUpload('/uploads/' + file.filename));
}
function uploadDocumentationImages(req, res, next) {
  upload.array('gambar', MAX_DOKUMENTASI_PHOTOS)(req, res, (error) => {
    if (error) {
      discardDocumentationUploads(req);
      let message = error.message;
      if (error.code === 'LIMIT_FILE_SIZE') message = 'Ukuran setiap foto maksimal 3 MB.';
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Maksimal ${MAX_DOKUMENTASI_PHOTOS} foto dalam satu postingan.`;
      }
      return res.status(400).json({ error: message });
    }
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'Pilih minimal satu foto dokumentasi.' });
    try {
      if (req.files.some((file) => !hasExpectedFileSignature(file))) {
        discardDocumentationUploads(req);
        return res.status(400).json({ error: 'Isi file tidak sesuai dengan format gambar yang dipilih.' });
      }
    } catch (verificationError) {
      discardDocumentationUploads(req);
      return next(verificationError);
    }
    next();
  });
}
function uploadStructurePhoto(req, res, next) {
  upload.single('foto')(req, res, (error) => {
    if (error) {
      if (req.file) removeUpload('/uploads/' + req.file.filename);
      let message = error.message;
      if (error.code === 'LIMIT_FILE_SIZE') message = 'Ukuran foto maksimal 3 MB.';
      if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
        message = 'Pilih satu foto anggota saja.';
      }
      return res.status(400).json({ error: message });
    }
    if (!req.file) return next();
    try {
      if (hasExpectedFileSignature(req.file)) return next();
      removeUpload('/uploads/' + req.file.filename);
      return res.status(400).json({ error: 'Isi file tidak sesuai dengan format gambar yang dipilih.' });
    } catch (verificationError) {
      removeUpload('/uploads/' + req.file.filename);
      return next(verificationError);
    }
  });
}
const coverFile = (req) => ((req.files || {}).gambar || [])[0];
const galleryFiles = (req) => (req.files || {}).galeri || [];
const discardUploads = (req) =>
  [coverFile(req), ...galleryFiles(req)].filter(Boolean).forEach((f) => removeUpload('/uploads/' + f.filename));

// --- Validasi berita ---
function validate(body) {
  const judul = String(body.judul || '').trim().slice(0, 200);
  const kategori = String(body.kategori || '').trim();
  const isi = String(body.isi || '').trim().slice(0, 30000);
  let tanggal = String(body.tanggal || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || isNaN(Date.parse(tanggal))) {
    tanggal = new Date().toISOString().slice(0, 10);
  }
  const errors = [];
  if (judul.length < 5) errors.push('Judul minimal 5 karakter.');
  if (!KATEGORI.includes(kategori)) errors.push('Pilih kategori berita.');
  if (isi.length < 20) errors.push('Isi berita minimal 20 karakter.');
  return { judul, kategori, isi, tanggal, errors };
}
function validateDocumentation(body) {
  const errors = [];
  const judul = typeof body.judul === 'string' ? body.judul.trim() : '';
  const kategori = typeof body.kategori === 'string' ? body.kategori.trim() : '';
  const tanggal = typeof body.tanggal === 'string' ? body.tanggal.trim() : '';
  const keterangan = typeof body.keterangan === 'string' ? body.keterangan.trim() : '';
  if (judul.length < 5 || judul.length > 200) errors.push('Judul dokumentasi harus terdiri dari 5 sampai 200 karakter.');
  if (!KATEGORI.includes(kategori)) errors.push('Pilih bidang dokumentasi yang tersedia.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
    Number.isNaN(Date.parse(`${tanggal}T00:00:00.000Z`)) ||
    new Date(`${tanggal}T00:00:00.000Z`).toISOString().slice(0, 10) !== tanggal) {
    errors.push('Tanggal dokumentasi tidak valid.');
  }
  if (keterangan.length > 500) errors.push('Keterangan maksimal 500 karakter.');
  return { dokumentasi: { judul, kategori, tanggal, keterangan }, errors };
}
function validateStructureMember(body, sections) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const position = typeof body.position === 'string' ? body.position.trim() : '';
  const sectionId = typeof body.sectionId === 'string' ? body.sectionId.trim() : '';
  const errors = [];
  if (name.length < 2 || name.length > 120) errors.push('Nama harus terdiri dari 2 sampai 120 karakter.');
  if (position.length < 2 || position.length > 160) errors.push('Jabatan harus terdiri dari 2 sampai 160 karakter.');
  if (!sections.some((section) => section.id === sectionId)) errors.push('Pilih bagian struktur yang tersedia.');
  if (body.removePhoto !== undefined && !['true', 'false', true, false].includes(body.removePhoto)) {
    errors.push('Pilihan penghapusan foto tidak valid.');
  }
  return { member: { name, position, sectionId }, errors };
}
function validStructure(data) {
  return data && typeof data === 'object' &&
    Array.isArray(data.sections) && Array.isArray(data.members) &&
    data.sections.every((section) =>
      section && typeof section.id === 'string' && typeof section.title === 'string' &&
      typeof section.description === 'string') &&
    data.members.every((member) =>
      member && typeof member.id === 'string' && typeof member.sectionId === 'string' &&
      typeof member.name === 'string' && typeof member.position === 'string' &&
      typeof member.photo === 'string' && Number.isInteger(member.order) &&
      data.sections.some((section) => section.id === member.sectionId) &&
      (!member.photo || /^\/uploads\/[a-f0-9]{24}\.(?:jpg|png|webp)$/.test(member.photo))) &&
    new Set(data.sections.map((section) => section.id)).size === data.sections.length &&
    new Set(data.members.map((member) => member.id)).size === data.members.length;
}
const toListItem = (b) => ({
  id: b.id, judul: b.judul, kategori: b.kategori, tanggal: b.tanggal, gambar: b.gambar,
  ringkasan: b.isi.replace(/\s+/g, ' ').slice(0, 160)
});
const sortDesc = (a, b) =>
  b.tanggal.localeCompare(a.tanggal) || String(b.createdAt).localeCompare(String(a.createdAt));

// --- Aplikasi ---
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) {
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1 || trustProxyHops > 5) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 1 and 5.');
  }
  app.set('trust proxy', trustProxyHops);
}
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  if (req.path === '/api/login' || req.path === '/api/logout' || req.path.startsWith('/api/admin/')) {
    res.set({
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      Expires: '0'
    });
  }
  next();
});
app.use(express.json({ limit: '10kb' }));

function auditText(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    : '';
}
async function recordAdminActivity(action, detail, outcome, actor = 'Admin') {
  await pool.query(
    `INSERT INTO admin_activity (actor, action, detail, outcome)
     VALUES ($1, $2, $3, $4)`,
    [actor, auditText(action).slice(0, 80), auditText(detail), outcome]
  );
  await pool.query(
    `DELETE FROM admin_activity
     WHERE created_at < NOW() - INTERVAL '180 days'
        OR id NOT IN (
          SELECT id FROM admin_activity ORDER BY id DESC LIMIT 10000
        )`
  );
}
function adminActivityForRequest(req, statusCode) {
  const { method, path: requestPath, body = {}, params = {} } = req;
  const failed = statusCode >= 400;
  const outcome = failed ? 'gagal' : 'berhasil';
  const target = auditText(params.id || requestPath.slice(requestPath.lastIndexOf('/') + 1));
  const title = auditText(body.judul || body.name);
  const idDetail = target ? `ID ${target}` : '';
  let action = '';
  let detail = '';

  if (requestPath === '/api/login') {
    action = 'Login admin';
    detail = failed ? `Login gagal (HTTP ${statusCode})` : 'Login berhasil';
  } else if (requestPath === '/api/logout') {
    action = 'Logout admin';
    detail = 'Sesi admin ditutup';
  } else if (requestPath === '/api/admin/site-settings' && method === 'PUT') {
    action = 'Pengaturan situs diperbarui';
  } else if (requestPath === '/api/berita' && method === 'POST') {
    action = 'Berita diterbitkan';
    detail = title;
  } else if (/^\/api\/berita\/[^/]+$/.test(requestPath) && method === 'PUT') {
    action = 'Berita diperbarui';
    detail = title || idDetail;
  } else if (/^\/api\/berita\/[^/]+$/.test(requestPath) && method === 'DELETE') {
    action = 'Berita dihapus';
    detail = idDetail;
  } else if (requestPath === '/api/admin/struktur' && method === 'POST') {
    action = 'Anggota struktur ditambahkan';
    detail = title;
  } else if (/^\/api\/admin\/struktur\/[^/]+$/.test(requestPath) && method === 'PUT') {
    action = 'Anggota struktur diperbarui';
    detail = title || idDetail;
  } else if (/^\/api\/admin\/struktur\/[^/]+$/.test(requestPath) && method === 'DELETE') {
    action = 'Anggota struktur dihapus';
    detail = idDetail;
  } else if (requestPath === '/api/admin/dokumentasi' && method === 'POST') {
    action = 'Dokumentasi ditambahkan';
    detail = title;
  } else if (/^\/api\/admin\/dokumentasi\/[^/]+$/.test(requestPath) && method === 'DELETE') {
    action = 'Dokumentasi dihapus';
    detail = idDetail;
  } else if (/^\/api\/admin\/komentar\/[^/]+$/.test(requestPath) && method === 'PATCH') {
    action = body.status === 'approved' ? 'Komentar disetujui' : 'Komentar ditolak';
    detail = idDetail;
  } else if (/^\/api\/admin\/komentar\/[^/]+$/.test(requestPath) && method === 'DELETE') {
    action = 'Komentar dihapus';
    detail = idDetail;
  } else if (/^\/api\/admin\/laporan-komentar\/[^/]+$/.test(requestPath) && method === 'PATCH') {
    action = 'Laporan komentar ditinjau';
    detail = idDetail;
  } else if (/^\/api\/admin\/laporan-komentar\/[^/]+$/.test(requestPath) && method === 'DELETE') {
    action = 'Laporan komentar dihapus';
    detail = idDetail;
  }

  return action ? { action, detail, outcome } : null;
}
const TRACKED_PUBLIC_PAGES = new Set([
  '/', '/berita.html', '/berita-detail.html', '/aspirasi.html', '/kebijakan.html'
]);
const trafficBuckets = new Map();
async function recordPageView(visitorId, pagePath) {
  await pool.query(
    'INSERT INTO traffic_page_views (visitor_id, page_path) VALUES ($1, $2)',
    [visitorId, pagePath]
  );
}
function trafficDays(value) {
  const days = Number(value || 30);
  if (![7, 14, 30, 90, 180].includes(days)) {
    throw httpError('Pilih rentang 7, 14, 30, 90, atau 180 hari.', 400);
  }
  return days;
}
function csvCell(value) {
  const text = String(value == null ? '' : value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}
app.use((req, res, next) => {
  req.auditWasAdmin = req.path === '/api/logout' && isAdmin(req);
  res.once('finish', () => {
    const loginRequest = req.path === '/api/login' && req.method === 'POST';
    const logoutRequest = req.path === '/api/logout' && req.method === 'POST' && req.auditWasAdmin;
    const adminMutation = req.adminAuthenticated &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const deniedAdminRequest = !req.adminAuthenticated &&
      req.path.startsWith('/api/admin/') && res.statusCode === 401;
    if (deniedAdminRequest) {
      recordAdminActivity('Akses admin ditolak', auditText(req.path), 'gagal', 'Tidak terautentikasi')
        .catch((error) => console.error(`[Admin activity] Gagal mencatat akses ditolak: ${error.message}`));
      return;
    }
    if (!loginRequest && !logoutRequest && !adminMutation) return;

    const entry = adminActivityForRequest(req, res.statusCode);
    if (!entry) return;
    recordAdminActivity(entry.action, entry.detail, entry.outcome)
      .catch((error) => console.error(`[Admin activity] Gagal mencatat aktivitas: ${error.message}`));
  });
  next();
});

// Auth
app.post('/api/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Login admin belum dikonfigurasi oleh pengelola.' });
  }
  const now = Date.now();
  const ip = req.ip;
  if (attempts.size > 10000) {
    for (const [key, value] of attempts) {
      if (value.reset <= now) attempts.delete(key);
    }
  }
  let a = attempts.get(ip);
  if (!a || a.reset < now) { a = { count: 0, reset: now + 15 * 60 * 1000 }; attempts.set(ip, a); }
  if (a.count >= 5) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
  const pw = String((req.body && req.body.password) || '');
  if (!safeEqual(pw, ADMIN_PASSWORD)) {
    a.count++;
    return res.status(401).json({ error: 'Password salah.' });
  }
  attempts.delete(ip);
  if (sessions.size > 1000) {
    for (const [session, expiresAt] of sessions) {
      if (expiresAt <= now) sessions.delete(session);
    }
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, now + SESSION_MS);
  res.setHeader('Set-Cookie', cookie(token, SESSION_MS / 1000));
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  const token = getCookie(req, 'sid');
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', cookie('', 0));
  res.json({ ok: true });
});
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));
app.get('/api/admin/aktivitas', requireAdmin, asyncRoute(async (req, res) => {
  const requestedLimit = Number(req.query.limit || 50);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    throw httpError('Batas log harus berupa angka antara 1 dan 100.', 400);
  }
  const result = await pool.query(
    `SELECT id, actor, action, detail, outcome, created_at AS "createdAt"
     FROM admin_activity
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [requestedLimit]
  );
  res.json({ items: result.rows });
}));
app.get('/api/admin/traffic', requireAdmin, asyncRoute(async (req, res) => {
  const days = trafficDays(req.query.days);
  const [daily, totals, pages, overview] = await Promise.all([
    pool.query(
      `WITH calendar AS (
         SELECT generate_series(
           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1),
           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date,
           INTERVAL '1 day'
         )::date AS day
       ), visits AS (
         SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
                COUNT(*)::int AS views,
                COUNT(DISTINCT visitor_id)::int AS visitors
         FROM traffic_page_views
         WHERE created_at >= (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Jakarta')
         GROUP BY 1
       )
       SELECT TO_CHAR(calendar.day, 'YYYY-MM-DD') AS date,
              COALESCE(visits.views, 0)::int AS views,
              COALESCE(visits.visitors, 0)::int AS visitors
       FROM calendar LEFT JOIN visits USING (day)
       ORDER BY calendar.day`,
      [days]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
       FROM traffic_page_views
      WHERE created_at >= (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Jakarta')`,
      [days]
    ),
    pool.query(
      `SELECT page_path AS path, COUNT(*)::int AS views,
              COUNT(DISTINCT visitor_id)::int AS visitors
       FROM traffic_page_views
      WHERE created_at >= (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Jakarta')
       GROUP BY page_path ORDER BY views DESC, path ASC LIMIT 5`,
      [days]
    ),
    pool.query(
      `WITH local_time AS (
         SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date AS today
       )
       SELECT
         TO_CHAR(local_time.today, 'YYYY-MM-DD') AS local_date,
         COUNT(*) FILTER (
           WHERE visits.created_at >= (local_time.today::timestamp AT TIME ZONE 'Asia/Jakarta')
         )::int AS today_views,
         COUNT(DISTINCT visits.visitor_id) FILTER (
           WHERE visits.created_at >= (local_time.today::timestamp AT TIME ZONE 'Asia/Jakarta')
         )::int AS today_visitors,
         COUNT(DISTINCT visits.visitor_id) FILTER (
           WHERE visits.created_at >= ((local_time.today - 1)::timestamp AT TIME ZONE 'Asia/Jakarta')
             AND visits.created_at < (local_time.today::timestamp AT TIME ZONE 'Asia/Jakarta')
         )::int AS yesterday_visitors,
         COUNT(*) FILTER (
           WHERE visits.created_at >= (
             date_trunc('month', local_time.today::timestamp) AT TIME ZONE 'Asia/Jakarta'
           )
         )::int AS month_views
       FROM local_time
       LEFT JOIN traffic_page_views AS visits ON TRUE
       GROUP BY local_time.today`
    )
  ]);
  res.json({
    days,
    daily: daily.rows,
    totals: totals.rows[0],
    topPages: pages.rows,
    overview: overview.rows[0]
  });
}));
app.get('/api/admin/traffic/export', requireAdmin, asyncRoute(async (req, res) => {
  const days = trafficDays(req.query.days || 180);
  const [traffic, activities] = await Promise.all([
    pool.query(
      `SELECT TO_CHAR((created_at AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS day,
              page_path AS path, COUNT(*)::int AS views,
              COUNT(DISTINCT visitor_id)::int AS visitors
       FROM traffic_page_views
      WHERE created_at >= (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Jakarta')
       GROUP BY 1, 2 ORDER BY day DESC, views DESC`,
      [days]
    ),
    pool.query(
      `SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI:SS') AS time,
              actor, action, detail, outcome
       FROM admin_activity
       WHERE created_at >= (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Jakarta')
       ORDER BY created_at DESC, id DESC`,
      [days]
    )
  ]);
  const rows = [
    ['Waktu', 'Jenis log', 'Aktivitas/halaman', 'Ringkasan', 'Hasil', 'Pengunjung unik', 'Tampilan halaman'],
    ...traffic.rows.map((row) => [row.day, 'Trafik web', row.path, '', '', row.visitors, row.views]),
    ...activities.rows.map((row) => [row.time, row.actor, row.action, row.detail, row.outcome, '', ''])
  ];
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="log-bakesbangpol-${days}-hari.csv"`,
    'Cache-Control': 'no-store'
  }).send(csv);
}));
app.post('/api/traffic', asyncRoute(async (req, res) => {
  const origin = req.get('Origin');
  if (origin) {
    let originHost;
    try { originHost = new URL(origin).host; }
    catch { throw httpError('Asal permintaan tidak diizinkan.', 403); }
    if (originHost !== req.get('host')) throw httpError('Asal permintaan tidak diizinkan.', 403);
  }
  const visitorId = typeof req.body?.visitorId === 'string' ? req.body.visitorId : '';
  const pagePath = typeof req.body?.path === 'string' ? req.body.path : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId) ||
      !TRACKED_PUBLIC_PAGES.has(pagePath)) {
    throw httpError('Data kunjungan tidak valid.', 400);
  }
  const now = Date.now();
  let bucket = trafficBuckets.get(req.ip);
  if (!bucket && trafficBuckets.size >= 10000) {
    for (const [ip, value] of trafficBuckets) {
      if (value.resetAt <= now) trafficBuckets.delete(ip);
    }
    if (trafficBuckets.size >= 10000) {
      return res.status(429).json({ error: 'Batas pencatatan kunjungan tercapai.' });
    }
  }
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + 60 * 1000 };
    trafficBuckets.set(req.ip, bucket);
  }
  if (bucket.count >= 60) return res.status(429).json({ error: 'Batas pencatatan kunjungan tercapai.' });
  bucket.count++;
  if (trafficBuckets.size > 10000) {
    for (const [ip, value] of trafficBuckets) {
      if (value.resetAt <= now) trafficBuckets.delete(ip);
    }
  }
  await recordPageView(visitorId, pagePath);
  res.status(202).json({ ok: true });
}));
app.get('/api/site-settings', asyncRoute(async (req, res) => {
  const { 'site-settings': saved } = await readState(['site-settings']);
  const settings = publicSiteSettings(saved);
  res.set('Cache-Control', 'no-store');
  res.json(settings);
}));
app.get('/api/admin/site-settings', requireAdmin, asyncRoute(async (req, res) => {
  const { 'site-settings': saved } = await readState(['site-settings']);
  res.json(publicSiteSettings(saved));
}));
app.put('/api/admin/site-settings', requireAdmin, asyncRoute(async (req, res) => {
  const { settings, errors } = validateSiteSettings(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  await updateState(['site-settings'], (state) => {
    state['site-settings'] = settings;
  });
  res.json(settings);
}));

app.get('/api/admin/struktur', requireAdmin, asyncRoute(async (req, res) => {
  const { struktur } = await readState(['struktur']);
  if (!validStructure(struktur)) throw httpError('Data struktur organisasi tidak valid.', 503);
  res.json(struktur);
}));
app.post('/api/admin/struktur', requireAdmin, uploadStructurePhoto, asyncRoute(async (req, res) => {
  const { struktur: current } = await readState(['struktur']);
  if (!validStructure(current)) {
    if (req.file) removeUpload('/uploads/' + req.file.filename);
    throw httpError('Data struktur organisasi tidak valid.', 503);
  }
  const { member: fields, errors } = validateStructureMember(req.body || {}, current.sections);
  if (errors.length) {
    if (req.file) removeUpload('/uploads/' + req.file.filename);
    return res.status(400).json({ error: errors.join(' ') });
  }
  const member = {
    id: crypto.randomBytes(12).toString('hex'),
    ...fields,
    photo: req.file ? '/uploads/' + req.file.filename : '',
    order: current.members.filter((person) => person.sectionId === fields.sectionId)
      .reduce((max, person) => Math.max(max, person.order), 0) + 1
  };
  try {
    await updateState(['struktur'], (state) => {
      if (!validStructure(state.struktur)) throw httpError('Data struktur organisasi tidak valid.', 503);
      if (!state.struktur.sections.some((section) => section.id === fields.sectionId)) {
        throw httpError('Bagian struktur tidak ditemukan.', 400);
      }
      state.struktur.members.push(member);
    });
  } catch (error) {
    if (req.file) removeUpload('/uploads/' + req.file.filename);
    throw error;
  }
  res.status(201).json(member);
}));
app.put('/api/admin/struktur/:id', requireAdmin, uploadStructurePhoto, asyncRoute(async (req, res) => {
  const { struktur: current } = await readState(['struktur']);
  if (!validStructure(current)) {
    if (req.file) removeUpload('/uploads/' + req.file.filename);
    throw httpError('Data struktur organisasi tidak valid.', 503);
  }
  const { member: fields, errors } = validateStructureMember(req.body || {}, current.sections);
  if (errors.length) {
    if (req.file) removeUpload('/uploads/' + req.file.filename);
    return res.status(400).json({ error: errors.join(' ') });
  }
  if (req.body.removePhoto === 'true' && req.file) {
    removeUpload('/uploads/' + req.file.filename);
    return res.status(400).json({ error: 'Pilih foto baru atau hapus foto lama, bukan keduanya.' });
  }
  let previousPhoto = '';
  let updated;
  try {
    updated = await updateState(['struktur'], (state) => {
      if (!validStructure(state.struktur)) throw httpError('Data struktur organisasi tidak valid.', 503);
      const person = state.struktur.members.find((item) => item.id === req.params.id);
      if (!person) throw httpError('Anggota struktur tidak ditemukan.', 404);
      previousPhoto = person.photo;
      const nextOrder = person.sectionId === fields.sectionId
        ? person.order
        : state.struktur.members.filter((item) => item.sectionId === fields.sectionId)
          .reduce((max, item) => Math.max(max, item.order), 0) + 1;
      Object.assign(person, fields, {
        photo: req.file ? '/uploads/' + req.file.filename : req.body.removePhoto === 'true' ? '' : person.photo,
        order: nextOrder
      });
      return { ...person };
    });
  } catch (error) {
    if (req.file) removeUpload('/uploads/' + req.file.filename);
    throw error;
  }
  if (previousPhoto && previousPhoto !== updated.photo) {
    const { struktur } = await readState(['struktur']);
    if (!struktur.members.some((person) => person.photo === previousPhoto)) removeUpload(previousPhoto);
  }
  res.json(updated);
}));
app.delete('/api/admin/struktur/:id', requireAdmin, asyncRoute(async (req, res) => {
  const removed = await updateState(['struktur'], (state) => {
    if (!validStructure(state.struktur)) throw httpError('Data struktur organisasi tidak valid.', 503);
    const index = state.struktur.members.findIndex((person) => person.id === req.params.id);
    if (index < 0) throw httpError('Anggota struktur tidak ditemukan.', 404);
    return state.struktur.members.splice(index, 1)[0];
  });
  if (removed.photo) {
    const { struktur } = await readState(['struktur']);
    if (!struktur.members.some((person) => person.photo === removed.photo)) removeUpload(removed.photo);
  }
  res.json({ ok: true });
}));

// Publik: daftar & detail berita
app.get('/api/kategori', (req, res) => res.json(KATEGORI));

app.get('/api/struktur', asyncRoute(async (req, res) => {
  const { struktur } = await readState(['struktur']);
  if (!validStructure(struktur)) throw httpError('Data struktur organisasi tidak valid.', 503);
  res.set('Cache-Control', 'no-store');
  res.json(struktur);
}));

app.get('/api/dokumentasi', asyncRoute(async (req, res) => {
  const kategori = String(req.query.kategori || '');
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  let items = (await readState(['dokumentasi'])).dokumentasi.slice().sort(sortDesc);
  if (kategori) items = items.filter((item) => item.kategori === kategori);
  const total = items.length;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);
  res.set('Cache-Control', 'no-store');
  res.json({ items: items.slice((page - 1) * limit, page * limit), total, page, pages });
}));

app.get('/api/berita', asyncRoute(async (req, res) => {
  const kategori = String(req.query.kategori || '');
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 50);
  let items = (await readState(['berita'])).berita.sort(sortDesc);
  if (kategori) items = items.filter((b) => b.kategori === kategori);
  if (q) items = items.filter((b) => (b.judul + ' ' + b.isi).toLowerCase().includes(q));
  const total = items.length;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);
  res.json({ items: items.slice((page - 1) * limit, page * limit).map(toListItem), total, page, pages });
}));

app.get('/api/berita/:id', asyncRoute(async (req, res) => {
  const b = (await readState(['berita'])).berita.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  res.json(b);
}));

app.get('/api/berita/:id/komentar', asyncRoute(async (req, res) => {
  const newsId = req.params.id;
  const { berita, komentar: data } = await readState(['berita', 'komentar']);
  if (!berita.some((item) => item.id === newsId)) {
    return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  }
  const visitor = visitorKey(req, res);
  const comments = data.comments
    .filter((item) => item.beritaId === newsId && isPublishedComment(data, item))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => {
      const reactions = data.reactions.filter((reaction) => reaction.commentId === item.id);
      const mine = reactions.find((reaction) => reaction.visitor === visitor);
      return {
        id: item.id, parentId: item.parentId, nama: item.nama, isi: item.isi,
        createdAt: item.createdAt,
        suka: reactions.filter((reaction) => reaction.value === 'suka').length,
        tidakSuka: reactions.filter((reaction) => reaction.value === 'tidak-suka').length,
        reaksiSaya: mine ? mine.value : ''
      };
    });
  res.json({ items: comments, total: comments.length });
}));

app.post('/api/berita/:id/komentar', asyncRoute(async (req, res) => {
  const newsId = req.params.id;
  const { berita } = await readState(['berita']);
  if (!berita.some((news) => news.id === newsId)) {
    return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  }
  if (!consumeLimit(commentLimits, req.ip, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Terlalu banyak komentar. Silakan coba lagi nanti.' });
  }
  const nama = String((req.body && req.body.nama) || '').trim();
  const isi = String((req.body && req.body.isi) || '').trim();
  const parentId = String((req.body && req.body.parentId) || '').trim();
  if (nama.length < 2 || nama.length > 60) {
    return res.status(400).json({ error: 'Nama harus terdiri dari 2 sampai 60 karakter.' });
  }
  if (isi.length < 2 || isi.length > 1000) {
    return res.status(400).json({ error: 'Komentar harus terdiri dari 2 sampai 1.000 karakter.' });
  }
  const item = {
    id: crypto.randomBytes(12).toString('hex'), beritaId: newsId,
    parentId: parentId || null, nama, isi, status: 'pending', createdAt: new Date().toISOString()
  };
  await updateState(['berita', 'komentar'], (state) => {
    if (!state.berita.some((news) => news.id === newsId)) {
      throw httpError('Berita tidak ditemukan.', 404);
    }
    if (parentId) {
      let parent = findComment(state.komentar, parentId);
      if (!parent || parent.beritaId !== newsId || !isPublishedComment(state.komentar, parent)) {
        throw httpError('Komentar yang dibalas tidak ditemukan.', 400);
      }
      let depth = 1;
      while (parent.parentId) {
        depth++;
        parent = findComment(state.komentar, parent.parentId);
        if (!parent || depth > 4) throw httpError('Rangkaian balasan tidak valid.', 400);
      }
      if (depth >= 4) throw httpError('Balasan sudah mencapai batas kedalaman.', 400);
    }
    state.komentar.comments.push(item);
  });
  res.status(201).json({ ok: true, id: item.id });
}));

app.post('/api/komentar/:id/reaksi', asyncRoute(async (req, res) => {
  const initialState = await readState(['berita', 'komentar']);
  const initialItem = findComment(initialState.komentar, req.params.id);
  if (!initialItem || !isPublishedComment(initialState.komentar, initialItem) ||
    !initialState.berita.some((news) => news.id === initialItem.beritaId)) {
    return res.status(404).json({ error: 'Komentar tidak ditemukan.' });
  }
  const value = String((req.body && req.body.reaksi) || '');
  if (!['suka', 'tidak-suka'].includes(value)) {
    return res.status(400).json({ error: 'Reaksi tidak valid.' });
  }
  if (!consumeLimit(reactionLimits, req.ip, 60, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Terlalu banyak reaksi. Silakan coba lagi nanti.' });
  }
  const visitor = visitorKey(req, res);
  await updateState(['berita', 'komentar'], (state) => {
    const item = findComment(state.komentar, req.params.id);
    if (!item || !isPublishedComment(state.komentar, item) ||
      !state.berita.some((news) => news.id === item.beritaId)) {
      throw httpError('Komentar tidak ditemukan.', 404);
    }
    const index = state.komentar.reactions.findIndex((reaction) =>
      reaction.commentId === item.id && reaction.visitor === visitor);
    if (index >= 0 && state.komentar.reactions[index].value === value) {
      state.komentar.reactions.splice(index, 1);
    } else if (index >= 0) {
      state.komentar.reactions[index].value = value;
    } else {
      state.komentar.reactions.push({ commentId: item.id, visitor, value });
    }
  });
  res.json({ ok: true });
}));

app.post('/api/komentar/:id/laporan', asyncRoute(async (req, res) => {
  const initialState = await readState(['berita', 'komentar']);
  const initialItem = findComment(initialState.komentar, req.params.id);
  if (!initialItem || !isPublishedComment(initialState.komentar, initialItem) ||
    !initialState.berita.some((news) => news.id === initialItem.beritaId)) {
    return res.status(404).json({ error: 'Komentar tidak ditemukan.' });
  }
  if (!consumeLimit(reportLimits, req.ip, 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Terlalu banyak laporan. Silakan coba lagi nanti.' });
  }
  const reason = String((req.body && req.body.alasan) || '');
  const detail = String((req.body && req.body.detail) || '').trim();
  if (!['Spam', 'Tidak pantas', 'Informasi keliru', 'Lainnya'].includes(reason)) {
    return res.status(400).json({ error: 'Pilih alasan laporan yang tersedia.' });
  }
  if (detail.length > 300) {
    return res.status(400).json({ error: 'Keterangan laporan maksimal 300 karakter.' });
  }
  const visitor = visitorKey(req, res);
  await updateState(['berita', 'komentar'], (state) => {
    const item = findComment(state.komentar, req.params.id);
    if (!item || !isPublishedComment(state.komentar, item) ||
      !state.berita.some((news) => news.id === item.beritaId)) {
      throw httpError('Komentar tidak ditemukan.', 404);
    }
    if (state.komentar.reports.some((report) =>
      report.commentId === item.id && report.visitor === visitor)) {
      throw httpError('Anda sudah melaporkan komentar ini.', 409);
    }
    state.komentar.reports.push({
      id: crypto.randomBytes(12).toString('hex'), commentId: item.id,
      beritaId: item.beritaId, visitor, alasan: reason, detail,
      status: 'baru', createdAt: new Date().toISOString()
    });
  });
  res.status(201).json({ ok: true });
}));

app.get('/api/admin/komentar', requireAdmin, asyncRoute(async (req, res) => {
  const status = String(req.query.status || 'pending');
  if (!['all', 'pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Filter status komentar tidak valid.' });
  }
  const { berita, komentar: data } = await readState(['berita', 'komentar']);
  const news = new Map(berita.map((item) => [item.id, item.judul]));
  const reportsByComment = new Map();
  data.reports.filter((report) => report.status === 'baru').forEach((report) => {
    reportsByComment.set(report.commentId, (reportsByComment.get(report.commentId) || 0) + 1);
  });
  const items = data.comments.filter((item) => !item.deletedAt).map((item) => ({
    id: item.id, beritaId: item.beritaId, judulBerita: news.get(item.beritaId) || 'Berita dihapus',
    parentId: item.parentId, nama: item.nama, isi: item.isi, createdAt: item.createdAt,
    status: item.status || 'approved',
    laporanBaru: reportsByComment.get(item.id) || 0
  })).filter((item) => status === 'all' || item.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ items });
}));

app.patch('/api/admin/komentar/:id', requireAdmin, asyncRoute(async (req, res) => {
  const { komentar } = await readState(['komentar']);
  if (!findComment(komentar, req.params.id)) {
    return res.status(404).json({ error: 'Komentar tidak ditemukan.' });
  }
  const status = String((req.body && req.body.status) || '');
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status moderasi tidak valid.' });
  }
  const affected = await updateState(['komentar'], (state) => {
    const data = state.komentar;
    const item = findComment(data, req.params.id);
    if (!item) throw httpError('Komentar tidak ditemukan.', 404);
    if (status === 'approved' && item.parentId) {
      const parent = findComment(data, item.parentId);
      if (!parent || !isPublishedComment(data, parent)) {
        throw httpError('Setujui komentar induk sebelum menyetujui balasannya.', 409);
      }
    }
    const ids = new Set([item.id]);
    if (status === 'rejected') {
      let changed = true;
      while (changed) {
        changed = false;
        data.comments.forEach((comment) => {
          if (comment.parentId && ids.has(comment.parentId) && !ids.has(comment.id)) {
            ids.add(comment.id);
            changed = true;
          }
        });
      }
    }
    const reviewedAt = new Date().toISOString();
    data.comments.forEach((comment) => {
      if (ids.has(comment.id)) {
        comment.status = status;
        comment.reviewedAt = reviewedAt;
      }
    });
    return ids.size;
  });
  res.json({ ok: true, affected });
}));

app.get('/api/admin/laporan-komentar', requireAdmin, asyncRoute(async (req, res) => {
  const { berita, komentar: data } = await readState(['berita', 'komentar']);
  const news = new Map(berita.map((item) => [item.id, item.judul]));
  const comments = new Map(data.comments.map((item) => [item.id, item]));
  const items = data.reports.map((report) => {
    const comment = comments.get(report.commentId);
    return {
      ...report, judulBerita: news.get(report.beritaId) || 'Berita dihapus',
      namaKomentar: comment ? comment.nama : '[Komentar tidak tersedia]',
      isiKomentar: comment ? comment.isi : ''
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ items });
}));

app.patch('/api/admin/laporan-komentar/:id', requireAdmin, asyncRoute(async (req, res) => {
  await updateState(['komentar'], (state) => {
    const report = state.komentar.reports.find((item) => item.id === req.params.id);
    if (!report) throw httpError('Laporan tidak ditemukan.', 404);
    report.status = 'ditinjau';
    report.reviewedAt = new Date().toISOString();
  });
  res.json({ ok: true });
}));

app.delete('/api/admin/laporan-komentar/:id', requireAdmin, asyncRoute(async (req, res) => {
  await updateState(['komentar'], (state) => {
    const reports = state.komentar.reports.filter((item) => item.id !== req.params.id);
    if (reports.length === state.komentar.reports.length) throw httpError('Laporan tidak ditemukan.', 404);
    state.komentar.reports = reports;
  });
  res.json({ ok: true });
}));

app.delete('/api/admin/komentar/:id', requireAdmin, asyncRoute(async (req, res) => {
  const deleted = await updateState(['komentar'], (state) => {
    const data = state.komentar;
    const target = findComment(data, req.params.id);
    if (!target) throw httpError('Komentar tidak ditemukan.', 404);
    const deletedAt = new Date().toISOString();
    const ids = new Set([target.id]);
    let changed = true;
    while (changed) {
      changed = false;
      data.comments.forEach((item) => {
        if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
          ids.add(item.id);
          changed = true;
        }
      });
    }
    data.comments.forEach((item) => {
      if (ids.has(item.id)) item.deletedAt = deletedAt;
    });
    data.reactions = data.reactions.filter((reaction) => !ids.has(reaction.commentId));
    return ids.size;
  });
  res.json({ ok: true, deleted });
}));

// Admin: tambah, ubah, hapus berita
app.post('/api/berita', requireAdmin, uploadImage, asyncRoute(async (req, res) => {
  const v = validate(req.body);
  if (v.errors.length) {
    discardUploads(req);
    return res.status(400).json({ error: v.errors.join(' ') });
  }
  const cover = coverFile(req);
  const item = {
    id: Date.now().toString(36) + crypto.randomBytes(2).toString('hex'),
    judul: v.judul, kategori: v.kategori, tanggal: v.tanggal, isi: v.isi,
    gambar: cover ? '/uploads/' + cover.filename : '',
    galeri: galleryFiles(req).map((f) => '/uploads/' + f.filename),
    createdAt: new Date().toISOString()
  };
  try {
    await updateState(['berita'], (state) => state.berita.push(item));
  } catch (error) {
    discardUploads(req);
    throw error;
  }
  res.status(201).json(item);
}));

app.put('/api/berita/:id', requireAdmin, uploadImage, asyncRoute(async (req, res) => {
  const { berita } = await readState(['berita']);
  if (!berita.some((item) => item.id === req.params.id)) {
    discardUploads(req);
    return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  }
  const v = validate(req.body);
  if (v.errors.length) {
    discardUploads(req);
    return res.status(400).json({ error: v.errors.join(' ') });
  }
  const oldUploads = [];
  let updated;
  try {
    updated = await updateState(['berita'], (state) => {
      const idx = state.berita.findIndex((item) => item.id === req.params.id);
      if (idx === -1) throw httpError('Berita tidak ditemukan.', 404);
      const old = state.berita[idx];
      const oldGaleri = old.galeri || [];
      const hapus = [].concat(req.body.hapus_galeri || []).filter((item) => oldGaleri.includes(item));
      const sisa = oldGaleri.filter((item) => !hapus.includes(item));
      const baru = galleryFiles(req).map((file) => '/uploads/' + file.filename);
      if (sisa.length + baru.length > MAX_GALERI) {
        throw httpError(`Maksimal ${MAX_GALERI} foto galeri per berita.`, 400);
      }
      const removedGallery = oldGaleri.filter((item) => !sisa.includes(item));
      let gambar = old.gambar;
      const cover = coverFile(req);
      if (cover) {
        if (old.gambar) oldUploads.push(old.gambar);
        gambar = '/uploads/' + cover.filename;
      } else if (req.body.hapus_gambar === 'on') {
        if (old.gambar) oldUploads.push(old.gambar);
        gambar = '';
      }
      oldUploads.push(...removedGallery);
      state.berita[idx] = {
        ...old,
        judul: v.judul,
        kategori: v.kategori,
        tanggal: v.tanggal,
        isi: v.isi,
        gambar,
        galeri: [...sisa, ...baru]
      };
      return state.berita[idx];
    });
  } catch (error) {
    discardUploads(req);
    throw error;
  }
  oldUploads.forEach(removeUpload);
  res.json(updated);
}));

app.delete('/api/berita/:id', requireAdmin, asyncRoute(async (req, res) => {
  const removed = await updateState(['berita', 'komentar'], (state) => {
    const index = state.berita.findIndex((item) => item.id === req.params.id);
    if (index < 0) throw httpError('Berita tidak ditemukan.', 404);
    const [item] = state.berita.splice(index, 1);
    const commentIds = new Set(state.komentar.comments
      .filter((comment) => comment.beritaId === req.params.id).map((comment) => comment.id));
    state.komentar.comments = state.komentar.comments.filter((comment) => comment.beritaId !== req.params.id);
    state.komentar.reactions = state.komentar.reactions.filter((reaction) => !commentIds.has(reaction.commentId));
    state.komentar.reports = state.komentar.reports.filter((report) => report.beritaId !== req.params.id);
    return item;
  });
  removeUpload(removed.gambar);
  (removed.galeri || []).forEach(removeUpload);
  res.json({ ok: true });
}));

app.get('/api/admin/dokumentasi', requireAdmin, asyncRoute(async (req, res) => {
  const items = (await readState(['dokumentasi'])).dokumentasi.slice().sort(sortDesc);
  res.json({ items, total: items.length });
}));

app.post('/api/admin/dokumentasi', requireAdmin, uploadDocumentationImages, asyncRoute(async (req, res) => {
  const { dokumentasi, errors } = validateDocumentation(req.body || {});
  if (errors.length) {
    discardDocumentationUploads(req);
    return res.status(400).json({ error: errors.join(' ') });
  }
  const gambar = req.files.map((file) => '/uploads/' + file.filename);
  const item = {
    id: crypto.randomBytes(12).toString('hex'),
    ...dokumentasi,
    gambar: gambar[0],
    galeri: gambar.slice(1),
    createdAt: new Date().toISOString()
  };
  try {
    await updateState(['dokumentasi'], (state) => state.dokumentasi.push(item));
  } catch (error) {
    gambar.forEach(removeUpload);
    throw error;
  }
  res.status(201).json(item);
}));

app.delete('/api/admin/dokumentasi/:id', requireAdmin, asyncRoute(async (req, res) => {
  const removed = await updateState(['dokumentasi'], (state) => {
    const index = state.dokumentasi.findIndex((item) => item.id === req.params.id);
    if (index < 0) throw httpError('Dokumentasi tidak ditemukan.', 404);
    return state.dokumentasi.splice(index, 1)[0];
  });
  const { berita, dokumentasi } = await readState(['berita', 'dokumentasi']);
  const usedPhotos = new Set(dokumentasi.flatMap((item) => [item.gambar, ...(item.galeri || [])]));
  berita.forEach((item) => {
    if (item.gambar) usedPhotos.add(item.gambar);
    (item.galeri || []).forEach((image) => usedPhotos.add(image));
  });
  [removed.gambar, ...(removed.galeri || [])]
    .filter((image) => image && !usedPhotos.has(image))
    .forEach(removeUpload);
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Tidak ditemukan.' }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));
app.use((error, req, res, next) => {
  console.error(`[HTTP ${req.method} ${req.path}] ${error.message}`);
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({
    error: status === 503 ? error.message : status < 500 ? error.message : 'Terjadi kesalahan internal. Coba lagi nanti.'
  });
});

async function start() {
  await verifyState();
  await Promise.all([
    pool.query("DELETE FROM traffic_page_views WHERE created_at < NOW() - INTERVAL '180 days'"),
    pool.query("DELETE FROM admin_activity WHERE created_at < NOW() - INTERVAL '180 days'")
  ]);
  const trafficCleanupTimer = setInterval(() => {
    Promise.all([
      pool.query("DELETE FROM traffic_page_views WHERE created_at < NOW() - INTERVAL '180 days'"),
      pool.query("DELETE FROM admin_activity WHERE created_at < NOW() - INTERVAL '180 days'")
    ])
      .catch((error) => console.error(`[Traffic] Gagal membersihkan data kedaluwarsa: ${error.message}`));
  }, 24 * 60 * 60 * 1000);
  trafficCleanupTimer.unref();
  app.listen(PORT, () => console.log(`Website listening on port ${PORT} (admin: /admin/)`));
}

start().catch((error) => {
  console.error(`[Startup] ${error.message}`);
  pool.end().catch((closeError) => {
    console.error(`[PostgreSQL] Gagal menutup koneksi: ${closeError.message}`);
  }).finally(() => {
    process.exitCode = 1;
  });
});
