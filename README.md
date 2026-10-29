# Website Bakesbangpol Kabupaten Ponorogo

Website instansi (HTML + Tailwind CSS) dengan dashboard admin untuk mengunggah berita.
Frontend murni HTML + Tailwind. Backend Express kecil hanya dipakai untuk login admin dan menyimpan berita ke `data/berita.json` (tanpa database).

## Menjalankan

Butuh Node.js 18 atau lebih baru.

```bash
npm install
copy .env.example .env      # Windows (Mac/Linux: cp .env.example .env)
# buka .env, ganti ADMIN_PASSWORD
npm start
```

- Website: http://localhost:3000
- Admin:   http://localhost:3000/admin/  (masuk dengan ADMIN_PASSWORD)

`public/css/output.css` sudah dikompilasi, jadi website langsung tampil. Jalankan perintah di bawah hanya jika kamu mengubah class Tailwind atau `src/input.css`:

```bash
npm run dev:css     # otomatis memperbarui output.css saat file disimpan
npm run css         # kompilasi sekali (minify), sebelum deploy
```

## Struktur folder

```
server.js            Express: login admin + API berita + upload gambar
data/berita.json     Isi berita (di-backup bersama public/uploads)
data/komentar.json   Komentar, balasan, reaksi, dan laporan moderasi
src/input.css        Warna (@theme), font, gaya hero
public/
  index.html         Beranda: hero, akses cepat, profil, berita, bidang, struktur
  berita.html        Daftar berita (filter kategori, pencarian, halaman)
  berita-detail.html Detail satu berita
  aspirasi.html      Panduan aspirasi dan kanal pengaduan resmi
  kebijakan.html     Aturan komentar dan informasi privasi
  js/layout.js       Header + footer + data kontak (objek SITE) untuk semua halaman
  admin/             Login, dashboard berita, dan dashboard admin E-IDI
  assets/img/        Taruh logo.png, hero.jpg, kantor.jpg di sini
  uploads/           Gambar berita yang diunggah lewat admin
```

## Yang perlu diisi/diganti sebelum tayang

1. **Password admin** di `.env` (wajib).
2. **Logo dan foto**: `public/assets/img/logo.png`, `hero.jpg` (foto kegiatan, latar hero), `kantor.jpg` (bagian profil). Jika file belum ada, tampilan memakai pengganti otomatis.
3. **Kontak**: edit objek `SITE` di `public/js/layout.js` (alamat, telepon, email, jam layanan). Kolom yang kosong tidak ditampilkan.
4. **Teks profil**: cocokkan dengan tugas pokok dan fungsi resmi di `public/index.html` (bagian `id="profil"`) dan deskripsi tiap bidang (bagian `id="bidang"`).
5. **Nama dan gelar pejabat/staf** di bagian `id="struktur"`: cocokkan dengan data kepegawaian. Nama Kasubbag Umum dan Kepegawaian belum ada di bagan sumber.
6. **Berita contoh**: hapus 3 berita "Contoh: ..." lewat dashboard admin.
7. Menu **PPID** belum dibuat karena belum ada tautan resminya. Tambahkan kartu baru di bagian "AKSES CEPAT" `index.html` jika perlu.

## Deploy singkat

- Jalankan dengan `npm start` di server (disarankan pakai `pm2` agar tetap hidup) dan taruh di belakang Nginx/Apache dengan **HTTPS**.
- Setelah HTTPS aktif, isi `COOKIE_SECURE=true` di `.env`.
- Jika di belakang reverse proxy, tambahkan `app.set('trust proxy', 1);` di `server.js` agar pembatasan percobaan login membaca IP asli.
- **Backup**: salin folder `data/` dan `public/uploads/` secara berkala.
- Komentar publik tidak memerlukan akun. Komentar baru menunggu persetujuan admin sebelum tampil; admin dapat menyetujui, menolak, atau menghapus komentar beserta balasannya. Pengunjung dapat membalas komentar yang sudah tampil, memberi reaksi suka/tidak suka, melaporkan komentar, dan membagikan tautan berita. Komentar dibatasi 5 kiriman per IP tiap 10 menit.
- Pengelolaan E-IDI berada terpisah di `/admin/idi.html` dan memerlukan sesi admin. Halaman publik `/idi.html` hanya menampilkan data, grafik, dan rekapitulasi.
- Halaman Aspirasi menjelaskan kanal pengaduan eksternal yang resmi, tanpa menyimpan pengaduan langsung di situs. Halaman Kebijakan menjelaskan aturan komentar dan data yang digunakan.
- Tombol aksesibilitas mengatur ukuran teks dan kontras; asisten informasi di pojok kanan menjawab panduan FAQ lokal tanpa API AI atau mengirim pertanyaan ke layanan pihak ketiga.

## Keamanan yang sudah ada

Password dibandingkan dengan `timingSafeEqual`, cookie sesi `HttpOnly` + `SameSite=Strict`, maksimal 5 percobaan login per 15 menit per IP, upload dibatasi JPG/PNG/WebP maksimal 3 MB dengan nama file acak, semua teks berita di-escape saat ditampilkan (tidak bisa menyisipkan HTML/JS), dan tulis file JSON secara atomik.
Yang belum ada: banyak akun admin dan riwayat perubahan. Untuk kebutuhan itu, ganti `data/berita.json` dengan database (mis. SQLite).
