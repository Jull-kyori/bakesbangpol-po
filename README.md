# Website Bakesbangpol Kabupaten Ponorogo

Website publik dan panel pengelola berita berbasis HTML, Tailwind CSS, Express, dan PostgreSQL. Fitur mencakup berita dan komentar serta asisten informasi yang dapat memakai Groq API. E-IDI bukan bagian dari layanan Bakesbangpol ini dan dikembangkan sebagai aplikasi terpisah di repository `bakesbangpol-ponorogo-idi`.

## Menjalankan secara lokal

Butuh Node.js 18 atau lebih baru.

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` sebelum menjalankan server:

- Ganti `ADMIN_PASSWORD` dengan password acak minimal 16 karakter.
- Atur `DATABASE_URL` ke database PostgreSQL yang disediakan untuk aplikasi. Jangan masukkan kredensial database ke Git.
- Atur `GROQ_API_KEY` jika ingin mengaktifkan jawaban generatif asisten. Jangan masukkan key ke kode, browser, atau Git.
- Untuk pengembangan lokal melalui HTTP, `COOKIE_SECURE=false` dapat dipakai. Produksi wajib menggunakan HTTPS dan `COOKIE_SECURE=true`.

```powershell
npm start
```

- Situs: <http://localhost:3000>
- Admin berita: <http://localhost:3000/admin/>

`public/css/output.css` sudah dikompilasi. Jalankan `npm run css` setelah mengubah kelas Tailwind atau `src/input.css`.

## Database dan data

Data runtime disimpan di PostgreSQL pada tabel `app_state` sebagai dokumen JSONB terpisah untuk berita, komentar/reaksi/laporan, pengaturan situs, dan dokumentasi kegiatan. Penulisan tiap dokumen memakai transaksi serta row lock; penghapusan berita dan data komentar terkait dilakukan atomik. Skema berversi berada di `migrations/`.

JSON lama hanya menjadi sumber impor satu kali. Perintah impor default hanya melakukan dry-run dan tidak mengubah database. Foto berita dan dokumentasi disimpan di `public/uploads/`, terpisah dari database; gunakan disk persisten atau object storage yang disetujui. Cadangkan database dan unggahan, lalu uji pemulihannya. Jangan unggah `.env`, backup berisi data pengguna, atau log audit ke repositori.

Admin dashboard menyediakan formulir **Dokumentasi** untuk mengunggah foto kegiatan, serta menu **Pengaturan situs** untuk identitas dan kontak, banner pengumuman, dan mengaktifkan atau menonaktifkan asisten AI. Kunci Groq tidak ditampilkan atau diubah dari dashboard, melainkan dikelola oleh administrator server melalui `GROQ_API_KEY`.

Panel admin berita, komentar, dan pengaturan situs menggunakan sesi login yang sama. Pengelolaan E-IDI tidak tersedia di aplikasi ini.

### Menyiapkan skema dan mengimpor JSON

1. Pastikan PostgreSQL dapat diakses melalui `DATABASE_URL`.
2. Jalankan migrasi skema dan periksa bahwa perintah selesai tanpa error:

   ```powershell
   npm run db:migrate
   ```
3. Pratinjau sumber lokal. Perintah ini menampilkan jumlah data dan checksum, tanpa menampilkan isi komentar:

   ```powershell
   npm run db:import
   ```
4. Verifikasi sumber, jumlah, dan checksum. Impor hanya ke database kosong yang sudah dimigrasikan:

   ```powershell
   npm run db:import -- --apply
   ```

   Impor ditransaksikan, menolak database yang sudah berisi salah satu dokumen, dan tidak menimpa data. Sumber defaultnya adalah `data/berita.json`, `data/komentar.json`, dan `data/site-settings.json`; gunakan `--news-file`, `--comments-file`, atau `--settings-file` untuk jalur berbeda.
5. Setelah impor berhasil, jalankan `npm start`. Server memerlukan keempat dokumen tersedia di database dan akan gagal startup jika migrasi/impor belum dilakukan.

JSON sumber tidak dihapus atau diubah. Data berita lokal yang ada ketika impor dijalankan akan ikut menjadi sumber awal. Tetapkan database staging/produksi, hak akses minimum, enkripsi koneksi, backup/restore, retensi, pemantauan, serta prosedur cutover bersama pengelola infrastruktur instansi.

## Persiapan sebelum serah-terima/publikasi

Konfirmasi dan isi bersama pihak Bakesbangpol:

1. Logo, foto, alamat, telepon, email, jam layanan, profil, struktur pejabat, serta tautan kanal resmi.
2. Berita contoh dan seluruh materi publik, termasuk hak penggunaan foto.
3. Pengelola yang bertanggung jawab atas moderasi komentar, laporan, akun admin, backup, retensi log, dan permintaan penghapusan data.
4. Persetujuan instansi atas pemrosesan pertanyaan chatbot oleh Groq dan penggunaan aset CDN eksternal yang dijelaskan pada halaman Kebijakan.
5. Kebutuhan PPID dan tautan resminya. Halaman Aspirasi hanya mengarahkan ke kanal eksternal dan bukan sistem pengaduan tersimpan di situs.

## Deploy dan batas operasional

Sebelum menjalankan `npm start` di produksi, atur `NODE_ENV=production`, `ADMIN_PASSWORD` acak minimal 16 karakter, dan `COOKIE_SECURE=true`. Server akan menolak startup produksi jika persyaratan password atau cookie HTTPS tidak terpenuhi. Simpan `GROQ_API_KEY` sebagai secret di lingkungan server jika AI diaktifkan.

Tempatkan aplikasi di belakang HTTPS yang dikelola instansi. Bila menggunakan reverse proxy, set `TRUST_PROXY_HOPS` ke jumlah hop proxy yang tepercaya dan dikendalikan sendiri (misalnya `1` untuk satu proxy); jangan percaya header proxy dari klien langsung.

Sesi admin, pembatasan laju, dan percobaan login masih berada di memori satu proses. Karena itu:

- Gunakan satu instance aplikasi. Restart mengakhiri sesi dan menghapus penghitung laju di memori; unggahan berita memerlukan disk persisten.
- Jangan menjalankan beberapa instance sebelum sesi dan rate limiter dipindahkan ke penyimpanan bersama yang sesuai.
- Implementasi ini memakai satu password admin bersama, tanpa akun per orang atau MFA. Tinjau kecukupannya untuk kebijakan keamanan instansi sebelum dibuka ke publik.
- Tetapkan backup, retensi, akses log, pemantauan, dan prosedur pemulihan dengan pengelola sistem.

## Fitur publik

Komentar tidak memerlukan akun dan menunggu persetujuan admin. Pengunjung dapat membalas komentar, memberi reaksi suka/tidak suka, melaporkan komentar, dan membagikan tautan berita. Asisten informasi dapat menjawab pertanyaan bebas dengan Groq jika API key tersedia; pertanyaan dan konteks percakapan terbaru dikirim ke penyedia tersebut, sehingga pengguna harus menghindari data pribadi atau rahasia. Rincian pemrosesan data ada di halaman Kebijakan.

Galeri **Dokumentasi kegiatan** di beranda menampilkan foto yang dipilih dan diunggah admin. Foto dapat difilter berdasarkan bidang, dibuka dalam tampilan foto besar, dan dimuat bertahap. Admin dapat memberi judul, bidang, tanggal, dan keterangan singkat; unggahan menggunakan format JPG, PNG, atau WebP dengan batas 3 MB. Data foto disimpan di PostgreSQL dan file gambarnya di `public/uploads/`. Migrasi `002_dokumentasi.sql` menyalin foto berita yang sudah ada ke galeri, dan importer juga mengisi galeri saat database baru diimpor.

## Perintah

- `npm start` — menjalankan server.
- `npm run db:migrate` — menerapkan migrasi skema PostgreSQL.
- `npm run db:import` — validasi dan dry-run JSON tanpa mengubah database.
- `npm run db:import -- --apply` — impor sumber JSON ke database kosong.
- `npm run css` — membangun CSS minified.
- `npm run dev:css` — memantau perubahan CSS Tailwind.
