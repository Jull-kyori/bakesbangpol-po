# Website Bakesbangpol Kabupaten Ponorogo

Website publik dan panel pengelola berbasis HTML, Tailwind CSS, dan Express. Fitur mencakup berita dan komentar, pengelolaan data E-IDI, serta asisten informasi yang dapat memakai Groq API. Data aplikasi disimpan dalam file JSON dan direktori unggahan; proyek ini belum memakai database.

## Menjalankan secara lokal

Butuh Node.js 18 atau lebih baru.

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` sebelum menjalankan server:

- Ganti `ADMIN_PASSWORD` dengan password acak minimal 16 karakter.
- Atur `GROQ_API_KEY` jika ingin mengaktifkan jawaban generatif asisten. Jangan masukkan key ke kode, browser, atau Git.
- Untuk pengembangan lokal melalui HTTP, `COOKIE_SECURE=false` dapat dipakai. Produksi wajib menggunakan HTTPS dan `COOKIE_SECURE=true`.

```powershell
npm start
```

- Situs: <http://localhost:3000>
- Admin berita: <http://localhost:3000/admin/>
- Admin E-IDI: <http://localhost:3000/admin/idi.html>

`public/css/output.css` sudah dikompilasi. Jalankan `npm run css` setelah mengubah kelas Tailwind atau `src/input.css`.

## Data dan penyimpanan

- `data/berita.json` menyimpan berita publik.
- `data/idi.json` menyimpan data E-IDI.
- Pengaturan identitas/kontak, banner, dan status asisten disimpan di `data/site-settings.json` (diabaikan Git).
- Komentar, reaksi, dan laporan disimpan di `data/komentar.json` (diabaikan Git).
- Gambar berita dan dokumen E-IDI disimpan di `public/uploads/`.
- `data/idi-audit.log` mencatat waktu, IP, tindakan, dan ringkasan perubahan E-IDI. File ini diabaikan Git; batasi akses dan tetapkan masa retensi sesuai kebijakan instansi.

Cadangkan `data/` dan `public/uploads/` secara berkala ke media yang aksesnya dibatasi, dan uji pemulihan cadangan. Jangan mengunggah `.env`, backup berisi data pengguna, atau log audit ke repositori.

Admin dashboard menyediakan menu **Pengaturan situs** untuk identitas dan kontak, banner pengumuman, serta mengaktifkan atau menonaktifkan asisten AI. Pengaturan disimpan pada disk server; lakukan backup dan pastikan disk tetap persisten. Kunci Groq tidak ditampilkan atau diubah dari dashboard, melainkan dikelola oleh administrator server melalui `GROQ_API_KEY`.

Panel admin berita, pengaturan situs, dan E-IDI menggunakan sesi login yang sama dan saling terhubung melalui navigasi admin.

## Rencana tahap berikutnya: migrasi ke database

Penyimpanan JSON saat ini sesuai untuk pengembangan lokal dan uji coba awal. Sebelum serah-terima dan deployment operasional kepada pihak Bakesbangpol, rencanakan migrasi ke database terkelola agar data lebih konsisten, mudah dicadangkan, dan siap dikembangkan. Pilihan produk database perlu ditentukan bersama pengelola infrastruktur instansi berdasarkan layanan yang tersedia, kebijakan keamanan, anggaran, dan kemampuan operasional; jangan mengasumsikan penyedia tertentu sebelum keputusan tersebut dibuat.

Urutan pekerjaan yang disarankan:

1. **Tentukan kebutuhan dan layanan** — sepakati penyedia/jenis database, lingkungan dev dan produksi, kepemilikan akun, lokasi data, retensi, backup, serta siapa yang bertanggung jawab mengoperasikannya.
2. **Rancang skema dan pemetaan data** — susun tabel dan relasi untuk berita, kategori, komentar dan balasan, reaksi, laporan, pengaturan situs, indikator E-IDI, serta metadata dokumen; tetapkan batasan, indeks, dan kebijakan penghapusan.
3. **Siapkan migrasi yang dapat diulang dan diverifikasi** — buat versi skema, alat impor JSON yang aman untuk dijalankan ulang, validasi jumlah dan keterkaitan data, serta laporan rekonsiliasi sebelum sumber data lama dihentikan.
4. **Pindahkan akses data ke lapisan penyimpanan** — ganti pembacaan/penulisan JSON dengan repository atau layanan data yang konsisten, memakai transaksi untuk perubahan terkait dan validasi di server. Pertahankan kontrak API serta perilaku situs selama transisi.
5. **Amankan koneksi dan kredensial** — simpan connection string sebagai secret lingkungan server, gunakan hak akses minimum, enkripsi koneksi, dan jangan masukkan kredensial ke Git atau browser.
6. **Uji pemulihan dan operasional** — uji backup/restore, migrasi di staging, beban dan konkurensi, penanganan kegagalan, pemantauan, retensi log audit, serta prosedur rollback.
7. **Lakukan cutover dengan persetujuan instansi** — ambil backup final, impor dan verifikasi data, alihkan aplikasi ke database, pantau hasilnya, lalu pertahankan sumber lama hanya sesuai masa retensi yang disepakati.

Migrasi ini belum diterapkan. Sampai seluruh langkah selesai dan diverifikasi, batasan penyimpanan JSON yang dijelaskan di bagian deployment tetap berlaku. Berkas unggahan tetap perlu penyimpanan file persisten atau object storage yang disetujui; database tidak otomatis menyimpan file tersebut.

## Persiapan sebelum serah-terima/publikasi

Konfirmasi dan isi bersama pihak Bakesbangpol:

1. Logo, foto, alamat, telepon, email, jam layanan, profil, struktur pejabat, serta tautan kanal resmi.
2. Berita contoh dan seluruh materi publik, termasuk hak penggunaan foto.
3. Data, periode, rumus, sumber, dan dokumen pendukung E-IDI. Tren historis yang diberi label perlu verifikasi sumber jangan disajikan sebagai angka resmi sebelum sumbernya dikonfirmasi.
4. Pengelola yang bertanggung jawab atas moderasi komentar, laporan, akun admin, backup, retensi log, dan permintaan penghapusan data.
5. Persetujuan instansi atas pemrosesan pertanyaan chatbot oleh Groq dan penggunaan aset CDN eksternal yang dijelaskan pada halaman Kebijakan.
6. Kebutuhan PPID dan tautan resminya. Halaman Aspirasi hanya mengarahkan ke kanal eksternal dan bukan sistem pengaduan tersimpan di situs.

## Deploy dan batas operasional

Sebelum menjalankan `npm start` di produksi, atur `NODE_ENV=production`, `ADMIN_PASSWORD` acak minimal 16 karakter, dan `COOKIE_SECURE=true`. Server akan menolak startup produksi jika persyaratan password atau cookie HTTPS tidak terpenuhi. Simpan `GROQ_API_KEY` sebagai secret di lingkungan server jika AI diaktifkan.

Tempatkan aplikasi di belakang HTTPS yang dikelola instansi. Bila menggunakan reverse proxy, set `TRUST_PROXY_HOPS` ke jumlah hop proxy yang tepercaya dan dikendalikan sendiri (misalnya `1` untuk satu proxy); jangan percaya header proxy dari klien langsung.

Penyimpanan file JSON, sesi admin, pembatasan laju, dan percobaan login berada di disk lokal atau memori satu proses. Karena itu:

- Gunakan satu instance aplikasi dan disk persisten. Restart mengakhiri sesi dan menghapus penghitung laju di memori.
- Jangan menjalankan beberapa instance atau memakai filesystem sementara/ephemeral tanpa lebih dulu memindahkan data, sesi, dan rate limiter ke penyimpanan bersama yang sesuai.
- Implementasi ini memakai satu password admin bersama, tanpa akun per orang atau MFA. Tinjau kecukupannya untuk kebijakan keamanan instansi sebelum dibuka ke publik.
- Tetapkan backup, retensi, akses log, pemantauan, dan prosedur pemulihan dengan pengelola sistem.

## Fitur publik

Komentar tidak memerlukan akun dan menunggu persetujuan admin. Pengunjung dapat membalas komentar, memberi reaksi suka/tidak suka, melaporkan komentar, dan membagikan tautan berita. Asisten informasi dapat menjawab pertanyaan bebas dengan Groq jika API key tersedia; pertanyaan dan konteks percakapan terbaru dikirim ke penyedia tersebut, sehingga pengguna harus menghindari data pribadi atau rahasia. Rincian pemrosesan data ada di halaman Kebijakan.

## Perintah

- `npm start` — menjalankan server.
- `npm run css` — membangun CSS minified.
- `npm run dev:css` — memantau perubahan CSS Tailwind.
