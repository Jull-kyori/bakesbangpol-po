'use strict';
require('./load-env');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DEFAULT_SETTINGS = {
  brandName: 'BAKESBANGPOL',
  organizationName: 'Badan Kesatuan Bangsa dan Politik',
  district: 'Kabupaten Ponorogo',
  address: 'Kabupaten Ponorogo, Jawa Timur',
  phone: '',
  email: '',
  serviceHours: '',
  announcementEnabled: false,
  announcement: ''
};

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : path.resolve(process.argv[index + 1] || fallback);
}

function readJson(file, fallback, allowMissing = false) {
  try {
    const raw = fs.readFileSync(file);
    return { value: JSON.parse(raw.toString('utf8')), raw };
  } catch (error) {
    if (error.code === 'ENOENT' && allowMissing) {
      return { value: fallback, raw: Buffer.from(JSON.stringify(fallback)) };
    }
    throw new Error(`Tidak dapat membaca ${path.basename(file)} sebagai JSON yang valid.`, { cause: error });
  }
}

const sources = {
  berita: readJson(option('--news-file', path.join(DATA_DIR, 'berita.json'))),
  komentar: readJson(option('--comments-file', path.join(DATA_DIR, 'komentar.json')), {
    comments: [],
    reactions: [],
    reports: []
  }, !process.argv.includes('--comments-file')),
  'site-settings': readJson(
    option('--settings-file', path.join(DATA_DIR, 'site-settings.json')),
    DEFAULT_SETTINGS,
    !process.argv.includes('--settings-file')
  ),
  struktur: readJson(option('--structure-file', path.join(DATA_DIR, 'struktur.json')))
};
const news = sources.berita.value;
const comments = sources.komentar.value;
const settings = sources['site-settings'].value;
const structure = sources.struktur.value;

if (!Array.isArray(news) || news.some((item) => !item || typeof item.id !== 'string')) {
  throw new Error('Data berita harus berupa array dengan ID berita yang valid.');
}
if (new Set(news.map((item) => item.id)).size !== news.length) {
  throw new Error('Data berita memuat ID yang duplikat.');
}
if (news.some((item) =>
  typeof item.judul !== 'string' || typeof item.kategori !== 'string' ||
  typeof item.tanggal !== 'string' || typeof item.isi !== 'string' ||
  (item.gambar != null && typeof item.gambar !== 'string') ||
  (item.galeri != null && !Array.isArray(item.galeri)))) {
  throw new Error('Data berita memiliki kolom dengan format yang tidak valid.');
}
if (
  !comments || !Array.isArray(comments.comments) ||
  !Array.isArray(comments.reactions) || !Array.isArray(comments.reports)
) {
  throw new Error('Data komentar harus berisi array comments, reactions, dan reports.');
}
if (comments.comments.some((item) => !item || typeof item.id !== 'string' || typeof item.beritaId !== 'string')) {
  throw new Error('Data komentar memiliki ID atau ID berita yang tidak valid.');
}
if (new Set(comments.comments.map((item) => item.id)).size !== comments.comments.length) {
  throw new Error('Data komentar memuat ID yang duplikat.');
}
if (comments.reactions.some((item) =>
  !item || typeof item.commentId !== 'string' || typeof item.visitor !== 'string' ||
  !['suka', 'tidak-suka'].includes(item.value))) {
  throw new Error('Data reaksi komentar memiliki format yang tidak valid.');
}
if (comments.reports.some((item) =>
  !item || typeof item.id !== 'string' || typeof item.commentId !== 'string' ||
  typeof item.beritaId !== 'string' || typeof item.visitor !== 'string')) {
  throw new Error('Data laporan komentar memiliki format yang tidak valid.');
}
if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
  throw new Error('Pengaturan situs harus berupa object JSON.');
}
if (!structure || typeof structure !== 'object' ||
  !Array.isArray(structure.sections) || !Array.isArray(structure.members)) {
  throw new Error('Data struktur harus berisi array sections dan members.');
}
if (structure.sections.some((section) =>
  !section || typeof section.id !== 'string' || typeof section.title !== 'string' ||
  typeof section.description !== 'string')) {
  throw new Error('Data bagian struktur memiliki format yang tidak valid.');
}
if (structure.members.some((member) =>
  !member || typeof member.id !== 'string' || typeof member.sectionId !== 'string' ||
  typeof member.name !== 'string' || typeof member.position !== 'string' ||
  (member.photo !== '' && typeof member.photo !== 'string') ||
  !Number.isInteger(member.order))) {
  throw new Error('Data anggota struktur memiliki format yang tidak valid.');
}
if (new Set(structure.sections.map((section) => section.id)).size !== structure.sections.length ||
  new Set(structure.members.map((member) => member.id)).size !== structure.members.length) {
  throw new Error('Data struktur memuat ID yang duplikat.');
}
const structureSectionIds = new Set(structure.sections.map((section) => section.id));
if (structure.members.some((member) => !structureSectionIds.has(member.sectionId))) {
  throw new Error('Anggota struktur mengacu pada bagian yang tidak tersedia.');
}
for (const field of ['brandName', 'organizationName', 'district', 'address', 'phone', 'email', 'serviceHours', 'announcement']) {
  if (settings[field] !== undefined && typeof settings[field] !== 'string') {
    throw new Error(`Pengaturan ${field} harus berupa teks.`);
  }
}
for (const field of ['announcementEnabled']) {
  if (settings[field] !== undefined && typeof settings[field] !== 'boolean') {
    throw new Error(`Pengaturan ${field} harus berupa pilihan aktif/nonaktif.`);
  }
}
for (const [key, { raw, value }] of Object.entries(sources)) {
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  const summary = key === 'berita'
    ? `${value.length} berita`
    : key === 'komentar'
      ? `${value.comments.length} komentar, ${value.reactions.length} reaksi, ${value.reports.length} laporan`
      : key === 'struktur'
        ? `${value.members.length} anggota, ${value.sections.length} bagian`
        : `${Object.keys(value).length} pengaturan`;
  process.stdout.write(`${key}: ${summary}, SHA-256 ${digest}\n`);
}

if (!process.argv.includes('--apply')) {
  process.stdout.write('Dry-run saja. Data tidak ditulis. Tambahkan --apply untuk mengimpor ke PostgreSQL.\n');
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib diatur untuk impor.');

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('LOCK TABLE app_state IN SHARE ROW EXCLUSIVE MODE');
    const existing = await client.query(
      'SELECT key FROM app_state WHERE key = ANY($1::text[]) FOR UPDATE',
      [Object.keys(sources)]
    );
    if (existing.rowCount) {
      throw new Error(`Database sudah berisi data (${existing.rows.map((row) => row.key).join(', ')}); impor dibatalkan agar tidak menimpa data.`);
    }
    for (const [key, source] of Object.entries(sources)) {
      await client.query(
        'INSERT INTO app_state (key, value) VALUES ($1, $2::jsonb)',
        [key, JSON.stringify(source.value)]
      );
    }
    await client.query('COMMIT');
    process.stdout.write('Data berhasil diimpor ke PostgreSQL.\n');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(`[JSON import] Gagal membatalkan transaksi: ${rollbackError.message}`);
      }
    }
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[JSON import] ${error.message}`);
  process.exitCode = 1;
});
