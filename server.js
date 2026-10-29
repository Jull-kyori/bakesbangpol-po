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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 jam
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_FILE = path.join(__dirname, 'data', 'berita.json');
const MAX_GALERI = 10;

if (!process.env.ADMIN_PASSWORD) {
  console.warn('\n[PERINGATAN] ADMIN_PASSWORD belum diatur. Memakai "admin123".');
  console.warn('Salin .env.example menjadi .env lalu ganti password sebelum website dipublikasikan.\n');
}

const KATEGORI = [
  'Sekretariat',
  'Ideologi & Wawasan Kebangsaan',
  'Politik Dalam Negeri & Ormas',
  'Kewaspadaan Nasional'
];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

// --- Penyimpanan berita (file JSON) ---
function readDb() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}
function writeDb(items) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, DATA_FILE); // tulis atomik, file tidak rusak jika terputus
}
function removeUpload(gambar) {
  if (typeof gambar === 'string' && gambar.startsWith('/uploads/')) {
    fs.unlink(path.join(UPLOAD_DIR, path.basename(gambar)), () => {});
  }
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
  if (isAdmin(req)) return next();
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
    if (!err) return next();
    let msg = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') msg = 'Ukuran tiap gambar maksimal 3 MB.';
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') msg = `Maksimal ${MAX_GALERI} foto galeri dan 1 gambar cover.`;
    res.status(400).json({ error: msg });
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
const toListItem = (b) => ({
  id: b.id, judul: b.judul, kategori: b.kategori, tanggal: b.tanggal, gambar: b.gambar,
  ringkasan: b.isi.replace(/\s+/g, ' ').slice(0, 160)
});
const sortDesc = (a, b) =>
  b.tanggal.localeCompare(a.tanggal) || String(b.createdAt).localeCompare(String(a.createdAt));

// --- Aplikasi ---
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});
app.use(express.json({ limit: '10kb' }));

// Auth
app.post('/api/login', (req, res) => {
  const now = Date.now();
  const ip = req.ip;
  let a = attempts.get(ip);
  if (!a || a.reset < now) { a = { count: 0, reset: now + 15 * 60 * 1000 }; attempts.set(ip, a); }
  if (a.count >= 5) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
  const pw = String((req.body && req.body.password) || '');
  if (!safeEqual(pw, ADMIN_PASSWORD)) { a.count++; return res.status(401).json({ error: 'Password salah.' }); }
  attempts.delete(ip);
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

// Publik: daftar & detail berita
app.get('/api/kategori', (req, res) => res.json(KATEGORI));

app.get('/api/berita', (req, res) => {
  const kategori = String(req.query.kategori || '');
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 9, 1), 50);
  let items = readDb().sort(sortDesc);
  if (kategori) items = items.filter((b) => b.kategori === kategori);
  if (q) items = items.filter((b) => (b.judul + ' ' + b.isi).toLowerCase().includes(q));
  const total = items.length;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);
  res.json({ items: items.slice((page - 1) * limit, page * limit).map(toListItem), total, page, pages });
});

app.get('/api/berita/:id', (req, res) => {
  const b = readDb().find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  res.json(b);
});

// Admin: tambah, ubah, hapus
app.post('/api/berita', requireAdmin, uploadImage, (req, res) => {
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
  const items = readDb();
  items.push(item);
  writeDb(items);
  res.status(201).json(item);
});

app.put('/api/berita/:id', requireAdmin, uploadImage, (req, res) => {
  const items = readDb();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx === -1) {
    discardUploads(req);
    return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  }
  const v = validate(req.body);
  if (v.errors.length) {
    discardUploads(req);
    return res.status(400).json({ error: v.errors.join(' ') });
  }
  const old = items[idx];
  const oldGaleri = old.galeri || [];
  const hapus = [].concat(req.body.hapus_galeri || []).filter((p) => oldGaleri.includes(p));
  const sisa = oldGaleri.filter((p) => !hapus.includes(p));
  const baru = galleryFiles(req).map((f) => '/uploads/' + f.filename);
  if (sisa.length + baru.length > MAX_GALERI) {
    discardUploads(req);
    return res.status(400).json({ error: `Maksimal ${MAX_GALERI} foto galeri per berita.` });
  }
  hapus.forEach((p) => removeUpload(p));

  let gambar = old.gambar;
  const cover = coverFile(req);
  if (cover) { removeUpload(old.gambar); gambar = '/uploads/' + cover.filename; }
  else if (req.body.hapus_gambar === 'on') { removeUpload(old.gambar); gambar = ''; }

  items[idx] = { ...old, judul: v.judul, kategori: v.kategori, tanggal: v.tanggal, isi: v.isi, gambar, galeri: [...sisa, ...baru] };
  writeDb(items);
  res.json(items[idx]);
});

app.delete('/api/berita/:id', requireAdmin, (req, res) => {
  const items = readDb();
  const b = items.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Berita tidak ditemukan.' });
  removeUpload(b.gambar);
  (b.galeri || []).forEach((p) => removeUpload(p));
  writeDb(items.filter((x) => x.id !== req.params.id));
  res.json({ ok: true });
});

// ===================== E-IDI (Indeks Demokrasi Indonesia) =====================
const IDI_FILE = path.join(__dirname, 'data', 'idi.json');
const IDI_AUDIT = path.join(__dirname, 'data', 'idi-audit.log');
const IDI_DIR = path.join(UPLOAD_DIR, 'idi');
const ASPEK_IDI = ['Kebebasan Sipil', 'Kesetaraan Politik', 'Lembaga Demokrasi'];
fs.mkdirSync(IDI_DIR, { recursive: true });

function readIdi() {
  try { return JSON.parse(fs.readFileSync(IDI_FILE, 'utf8')); }
  catch { return { tahun: new Date().getFullYear(), skorTotal: null, sumberTren: '', aspek: [], tren: [], indikator: [] }; }
}
function writeIdi(d) {
  const tmp = IDI_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, IDI_FILE);
}
// Jejak audit: tiap tambah/ubah/hapus dicatat (waktu, IP, aksi, indikator)
function audit(req, aksi, detail) {
  const line = [new Date().toISOString(), req.ip, aksi, String(detail).replace(/[\t\r\n]+/g, ' ')].join('\t') + '\n';
  fs.appendFile(IDI_AUDIT, line, () => {});
}
function removeIdiDoc(p) {
  if (typeof p === 'string' && p.startsWith('/uploads/idi/')) {
    fs.unlink(path.join(IDI_DIR, path.basename(p)), () => {});
  }
}

const DOC_EXT = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };
const uploadDoc = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, IDI_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + DOC_EXT[file.mimetype])
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    DOC_EXT[file.mimetype] ? cb(null, true) : cb(new Error('Dokumen harus berformat PDF, PNG, atau JPG.'))
});
function uploadIdiDoc(req, res, next) {
  uploadDoc.single('dokumen')(req, res, (err) => {
    if (!err) return next();
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran dokumen maksimal 5 MB.' : err.message });
  });
}
function validateIdi(b) {
  const aspek = String(b.aspek || '').trim();
  const indikator = String(b.indikator || '').trim().slice(0, 200);
  const catatan = String(b.catatan || '').trim().slice(0, 1000);
  const skor = Math.round(parseFloat(String(b.skor).replace(',', '.')) * 100) / 100;
  const errors = [];
  if (!ASPEK_IDI.includes(aspek)) errors.push('Pilih aspek IDI.');
  if (indikator.length < 3) errors.push('Nama indikator minimal 3 karakter.');
  if (!Number.isFinite(skor) || skor < 0 || skor > 100) errors.push('Skor harus antara 0 dan 100.');
  return { aspek, indikator, catatan, skor, errors };
}
const cleanName = (n) => String(n || '').replace(/[^\w .()\-]/g, '_').slice(0, 100);

// Publik: status login (tanpa error 401 di konsol) dan data IDI
app.get('/api/session', (req, res) => res.json({ admin: isAdmin(req) }));
app.get('/api/idi', (req, res) => res.json(readIdi()));

// Admin: tambah, ubah, hapus indikator
app.post('/api/idi/indikator', requireAdmin, uploadIdiDoc, (req, res) => {
  const v = validateIdi(req.body);
  if (v.errors.length) {
    if (req.file) removeIdiDoc('/uploads/idi/' + req.file.filename);
    return res.status(400).json({ error: v.errors.join(' ') });
  }
  const item = {
    id: crypto.randomBytes(6).toString('hex'),
    aspek: v.aspek, indikator: v.indikator, catatan: v.catatan, skor: v.skor,
    dokumen: req.file ? '/uploads/idi/' + req.file.filename : '',
    dokumenNama: req.file ? cleanName(req.file.originalname) : '',
    updatedAt: new Date().toISOString()
  };
  const d = readIdi();
  d.indikator.push(item);
  writeIdi(d);
  audit(req, 'TAMBAH', `${item.indikator} (skor ${item.skor})`);
  res.status(201).json(item);
});

app.put('/api/idi/indikator/:id', requireAdmin, uploadIdiDoc, (req, res) => {
  const d = readIdi();
  const idx = d.indikator.findIndex((x) => x.id === req.params.id);
  if (idx === -1) {
    if (req.file) removeIdiDoc('/uploads/idi/' + req.file.filename);
    return res.status(404).json({ error: 'Indikator tidak ditemukan.' });
  }
  const v = validateIdi(req.body);
  if (v.errors.length) {
    if (req.file) removeIdiDoc('/uploads/idi/' + req.file.filename);
    return res.status(400).json({ error: v.errors.join(' ') });
  }
  const old = d.indikator[idx];
  let { dokumen, dokumenNama } = old;
  if (req.file) {
    removeIdiDoc(old.dokumen);
    dokumen = '/uploads/idi/' + req.file.filename;
    dokumenNama = cleanName(req.file.originalname);
  } else if (req.body.hapus_dokumen === 'on') {
    removeIdiDoc(old.dokumen);
    dokumen = ''; dokumenNama = '';
  }
  d.indikator[idx] = { ...old, aspek: v.aspek, indikator: v.indikator, catatan: v.catatan, skor: v.skor, dokumen, dokumenNama, updatedAt: new Date().toISOString() };
  writeIdi(d);
  audit(req, 'UBAH', `${v.indikator} (skor ${old.skor} -> ${v.skor})`);
  res.json(d.indikator[idx]);
});

app.delete('/api/idi/indikator/:id', requireAdmin, (req, res) => {
  const d = readIdi();
  const it = d.indikator.find((x) => x.id === req.params.id);
  if (!it) return res.status(404).json({ error: 'Indikator tidak ditemukan.' });
  removeIdiDoc(it.dokumen);
  d.indikator = d.indikator.filter((x) => x.id !== req.params.id);
  writeIdi(d);
  audit(req, 'HAPUS', `${it.indikator} (skor ${it.skor})`);
  res.json({ ok: true });
});
// =================== akhir blok E-IDI ===================

app.use('/api', (req, res) => res.status(404).json({ error: 'Tidak ditemukan.' }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));

app.listen(PORT, () => console.log(`Website berjalan di http://localhost:${PORT}  (admin: /admin/)`));
