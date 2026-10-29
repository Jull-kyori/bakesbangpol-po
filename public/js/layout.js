/* Header, footer, dan fungsi bantu yang dipakai semua halaman publik.
   Ubah data kontak di objek SITE di bawah ini. Kolom yang dikosongkan tidak ditampilkan. */
(function () {
  const SITE = {
    alamat: 'Kabupaten Ponorogo, Jawa Timur',
    telepon: '',
    email: '',
    jam: ''
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const mainContent = document.querySelector('main');
  if (mainContent && !mainContent.id) mainContent.id = 'main-content';
  if (mainContent) {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Lewati ke konten utama';
    skipLink.className = 'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-ink focus:shadow-xl';
    document.body.prepend(skipLink);
  }

  const tanggal = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  function cardBerita(b, big) {
    const img = b.gambar
      ? `<img src="${esc(b.gambar)}" alt="" loading="lazy" class="${big ? 'h-64' : 'h-44'} w-full object-cover">`
      : `<div class="flex ${big ? 'h-64' : 'h-44'} items-center justify-center bg-primary/15 font-display text-5xl font-bold text-primary-dark">B</div>`;
    return `<a href="/berita-detail.html?id=${encodeURIComponent(b.id)}" class="group flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-ink/10 transition hover:ring-2 hover:ring-primary ${big ? 'lg:col-span-2' : ''}">
      ${img}
      <div class="flex flex-1 flex-col p-5">
        <p class="text-sm font-semibold text-primary-dark">${esc(b.kategori)}</p>
        <h3 class="mt-1 ${big ? 'text-2xl' : 'text-lg'} font-bold leading-snug text-ink group-hover:text-accent">${esc(b.judul)}</h3>
        <p class="mt-2 line-clamp-2 text-sm text-slate-600">${esc(b.ringkasan)}</p>
        <p class="mt-auto pt-4 text-sm text-slate-500">${tanggal(b.tanggal)}</p>
      </div>
    </a>`;
  }

  window.BK = { SITE, esc, tanggal, cardBerita };

  // ---- Header ----
  // Samakan daftar kategori ini dengan KATEGORI di server.js
  const KATEGORI = ['Sekretariat', 'Ideologi & Wawasan Kebangsaan', 'Politik Dalam Negeri & Ormas', 'Kewaspadaan Nasional'];
  const MENU = [
    { t: 'Beranda', h: '/' },
    { t: 'Profil', h: '/#profil', spy: 'profil struktur', sub: [['Tentang Bakesbangpol', '/#profil'], ['Struktur Organisasi', '/#struktur']] },
    { t: 'Bidang', h: '/#bidang', spy: 'bidang', sub: [
      ['Sekretariat', '/#bidang-sekretariat'],
      ['Ideologi dan Wawasan Kebangsaan', '/#bidang-ideologi'],
      ['Politik Dalam Negeri dan Ormas', '/#bidang-politik'],
      ['Kewaspadaan Nasional', '/#bidang-kewaspadaan']
    ] },
    { t: 'Berita', h: '/berita.html', spy: 'berita', sub: [['Semua berita', '/berita.html']].concat(
      KATEGORI.map((k) => [k, '/berita.html?kategori=' + encodeURIComponent(k)])) },
    { t: 'E-IDI', h: '/idi.html', spy: 'idi-teaser' },
    { t: 'Aspirasi', h: '/aspirasi.html' },
    { t: 'Kontak', h: '#kontak' }
  ];
  const chevron = (cls) => `<svg class="h-3 w-3 transition-transform duration-200 ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

  const header = document.getElementById('site-header');
  if (header) {
    const overlay = header.dataset.variant === 'overlay';
    header.className = overlay
      ? 'fixed inset-x-0 top-0 z-30 text-white transition-all duration-300'
      : 'sticky top-0 z-30 bg-ink text-white shadow';

    // Menu desktop: submenu meluncur turun saat disorot kursor atau difokus keyboard
    const desktop = MENU.map((m) => {
      const spy = m.spy ? ` data-spy="${m.spy}"` : '';
      if (!m.sub) return `<a href="${m.h}" class="nav-link ${m.t === 'Aspirasi' ? 'text-primary' : ''}"${spy}>${m.t}</a>`;
      return `<div class="group relative">
        <a href="${m.h}" class="nav-link inline-flex items-center gap-1.5"${spy}>${m.t}${chevron('group-hover:rotate-180 group-focus-within:rotate-180')}</a>
        <div class="invisible absolute left-1/2 top-full z-40 w-72 -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <div class="overflow-hidden rounded-xl bg-white py-2 text-ink shadow-xl ring-1 ring-ink/10">
            ${m.sub.map(([t, h]) => `<a href="${h}" class="block px-4 py-2.5 text-sm transition hover:bg-primary/15 hover:pl-5 hover:text-accent">${t}</a>`).join('')}
          </div>
        </div>
      </div>`;
    }).join('');

    // Menu HP: submenu berupa daftar yang bisa dibuka-tutup
    const mobile = MENU.map((m) => m.sub
      ? `<details class="border-t border-white/10">
          <summary class="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium focus-visible:rounded">${m.t}${chevron('')}</summary>
          <div class="pb-2 pl-4">${m.sub.map(([t, h]) => `<a href="${h}" class="block py-2 text-sm text-white/80 hover:text-primary">${t}</a>`).join('')}</div>
        </details>`
      : `<a href="${m.h}" class="block border-t border-white/10 py-3 text-sm font-medium hover:text-primary ${m.t === 'Aspirasi' ? 'text-primary' : ''}">${m.t}</a>`
    ).join('');

    header.innerHTML = `
      <div id="header-bar" class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 transition-all duration-300 sm:px-6 sm:py-4">
        <a href="/" class="flex items-center gap-3">
          <!-- LOGO: jika kamu sudah memakai logo sendiri, tempel ulang markup logomu di sini -->
          <span class="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display font-bold text-ink">B<img src="/assets/img/logo.png" alt="" class="absolute inset-0 h-full w-full rounded-full bg-white object-contain" onerror="this.remove()"></span>
          <span class="leading-tight"><span class="block font-display text-lg font-bold">BAKESBANGPOL</span><span class="block text-xs text-white/75">Kabupaten Ponorogo</span></span>
        </a>
        <nav class="hidden items-center gap-5 text-sm font-medium xl:flex 2xl:gap-7" aria-label="Menu utama">${desktop}</nav>
        <button id="menu-btn" type="button" aria-label="Buka menu" aria-expanded="false" aria-controls="menu-panel" class="rounded-lg p-2 hover:bg-white/10 xl:hidden">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
      <nav id="menu-panel" class="absolute inset-x-0 top-full z-40 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto bg-ink px-6 pb-5 shadow-2xl xl:hidden" aria-label="Menu seluler">${mobile}</nav>`;

    const btn = document.getElementById('menu-btn');
    const panel = document.getElementById('menu-panel');
    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    });
    panel.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return;
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Buka menu');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || panel.classList.contains('hidden')) return;
      panel.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Buka menu');
      btn.focus();
    });

    // Di beranda: menu transparan di atas hero, lalu menjadi solid dan lebih ramping saat di-scroll
    if (overlay) {
      const bar = document.getElementById('header-bar');
      const onScroll = () => {
        const s = scrollY > 40;
        header.classList.toggle('bg-ink/95', s);
        header.classList.toggle('shadow-lg', s);
        header.classList.toggle('backdrop-blur', s);
        bar.classList.toggle('py-3', !s);
        bar.classList.toggle('sm:py-4', !s);
        bar.classList.toggle('py-2.5', s);
      };
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  // ---- Footer ----
  const footer = document.getElementById('site-footer');
  if (footer) {
    const rows = [
      SITE.alamat && ['Alamat', SITE.alamat],
      SITE.telepon && ['Telepon', SITE.telepon],
      SITE.email && ['Email', SITE.email],
      SITE.jam && ['Jam layanan', SITE.jam]
    ].filter(Boolean);
    footer.id = 'kontak';
    footer.className = 'bg-ink text-white';
    footer.innerHTML = `
      <div class="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <p class="font-display text-xl font-bold">Badan Kesatuan Bangsa dan Politik</p>
          <p class="text-white/75">Kabupaten Ponorogo</p>
          <dl class="mt-5 space-y-2 text-sm text-white/85">
            ${rows.map(([k, v]) => `<div><dt class="inline font-semibold text-primary">${esc(k)}:</dt> <dd class="inline">${esc(v)}</dd></div>`).join('')}
          </dl>
        </div>
        <div>
          <p class="font-display text-lg font-bold">Halaman</p>
          <ul class="mt-4 space-y-2 text-sm text-white/85">
            <li><a class="hover:text-primary" href="/#profil">Profil</a></li>
            <li><a class="hover:text-primary" href="/#bidang">Bidang</a></li>
            <li><a class="hover:text-primary" href="/#struktur">Struktur organisasi</a></li>
            <li><a class="hover:text-primary" href="/berita.html">Berita</a></li>
            <li><a class="hover:text-primary" href="/aspirasi.html">Panduan aspirasi/pengaduan</a></li>
            <li><a class="hover:text-primary" href="/kebijakan.html">Aturan komentar &amp; privasi</a></li>
          </ul>
        </div>
        <div>
          <p class="font-display text-lg font-bold">Bidang</p>
          <ul class="mt-4 space-y-2 text-sm text-white/85">
            <li>Sekretariat</li>
            <li>Ideologi, Wawasan Kebangsaan dan Ketahanan Ekonomi, Sosial, Budaya, Agama</li>
            <li>Politik Dalam Negeri dan Organisasi Kemasyarakatan</li>
            <li>Kewaspadaan Nasional dan Penanganan Konflik</li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10 py-5 text-center text-sm text-white/60">
        &copy; ${new Date().getFullYear()} Bakesbangpol Kabupaten Ponorogo
      </div>`;
  }

  // ---- Aksesibilitas dan asisten panduan ----
  const widget = document.createElement('div');
  widget.innerHTML = `
    <div class="fixed bottom-4 left-4 z-[60]">
      <button id="aksesibilitas-toggle" type="button" aria-label="Buka pengaturan aksesibilitas" aria-expanded="false" aria-controls="aksesibilitas-panel" class="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-xl ring-2 ring-white transition hover:scale-105 hover:bg-primary-dark focus-visible:outline">
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="7" r="1"/><path d="M12 10v7m-4-7 4 2 4-2m-7 9 3-4 3 4"/></svg>
      </button>
      <section id="aksesibilitas-panel" aria-label="Pengaturan aksesibilitas" class="absolute bottom-16 left-0 hidden w-72 rounded-2xl bg-white p-4 text-ink shadow-2xl ring-1 ring-ink/15">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-bold">Aksesibilitas</h2>
          <button type="button" data-akses-close aria-label="Tutup pengaturan aksesibilitas" class="rounded-lg px-2 py-1 text-slate-500 hover:bg-cream">Tutup</button>
        </div>
        <div class="mt-3 space-y-2">
          <div class="flex items-center justify-between rounded-lg bg-cream px-3 py-2">
            <span class="text-sm font-semibold">Ukuran teks</span>
            <div class="flex gap-2">
              <button type="button" data-ukuran="-1" aria-label="Perkecil teks" class="h-9 w-9 rounded-lg bg-white text-lg font-bold ring-1 ring-ink/15 hover:bg-primary/20">A−</button>
              <button type="button" data-ukuran="1" aria-label="Perbesar teks" class="h-9 w-9 rounded-lg bg-white text-lg font-bold ring-1 ring-ink/15 hover:bg-primary/20">A+</button>
            </div>
          </div>
          <button type="button" data-akses="contrast" aria-pressed="false" class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ring-1 ring-ink/15 hover:bg-cream">Kontras tinggi <span aria-hidden="true">◐</span></button>
          <button type="button" data-akses="links" aria-pressed="false" class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold ring-1 ring-ink/15 hover:bg-cream">Garisbawahi tautan <span aria-hidden="true">↗</span></button>
          <button type="button" data-akses-reset class="w-full rounded-lg px-3 py-2 text-sm font-semibold text-primary-dark ring-1 ring-primary-dark/30 hover:bg-primary/15">Atur ulang tampilan</button>
        </div>
      </section>
    </div>
    <div class="fixed bottom-4 right-4 z-[60]">
      <button id="asisten-toggle" type="button" aria-label="Buka asisten informasi" aria-expanded="false" aria-controls="asisten-panel" class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-xl ring-2 ring-white transition hover:scale-105 hover:bg-accent hover:text-white">
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg>
      </button>
      <section id="asisten-panel" aria-label="Asisten informasi Bakesbangpol" class="absolute bottom-16 right-0 hidden w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white text-ink shadow-2xl ring-1 ring-ink/15">
        <div class="flex items-center justify-between bg-ink px-4 py-3 text-white">
          <div><h2 class="font-display font-bold">Asisten Bakesbangpol</h2><p class="text-xs text-white/75">Panduan otomatis situs</p></div>
          <button id="asisten-close" type="button" aria-label="Tutup asisten" class="rounded-lg px-2 py-1 text-white/80 hover:bg-white/10">Tutup</button>
        </div>
        <p class="border-b border-ink/10 bg-cream px-4 py-2 text-xs leading-relaxed text-slate-600">Jawaban menggunakan panduan FAQ situs, bukan AI generatif. Jangan kirim data pribadi.</p>
        <div id="asisten-pesan" class="flex max-h-72 min-h-32 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
          <p class="max-w-[90%] self-start rounded-xl rounded-tl-sm bg-cream px-3 py-2 text-sm">Halo! Saya bisa membantu mencari informasi tentang profil, bidang, berita, E-IDI, dan cara menghubungi Bakesbangpol.</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-tanya="Apa tugas Bakesbangpol?" class="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-dark ring-1 ring-primary-dark/30 hover:bg-primary/15">Tugas Bakesbangpol</button>
            <button type="button" data-tanya="Informasi berita" class="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-dark ring-1 ring-primary-dark/30 hover:bg-primary/15">Berita</button>
            <button type="button" data-tanya="Apa itu E-IDI?" class="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-dark ring-1 ring-primary-dark/30 hover:bg-primary/15">E-IDI</button>
          </div>
        </div>
        <form id="asisten-form" class="flex gap-2 border-t border-ink/10 p-3">
          <label for="asisten-input" class="sr-only">Tulis pertanyaan</label>
          <input id="asisten-input" maxlength="300" autocomplete="off" required placeholder="Tulis pertanyaan..." class="min-w-0 flex-1 rounded-lg border border-ink/20 px-3 py-2 text-sm" />
          <button class="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-ink hover:bg-accent hover:text-white">Kirim</button>
        </form>
      </section>
    </div>`;
  document.body.appendChild(widget);

  const accessToggle = document.getElementById('aksesibilitas-toggle');
  const accessPanel = document.getElementById('aksesibilitas-panel');
  const accessClasses = { contrast: 'a11y-contrast', links: 'a11y-links' };
  const savedScale = Number.parseInt(localStorage.getItem('bk-text-scale') || '0', 10);
  let textScale = Number.isFinite(savedScale) ? Math.max(-1, Math.min(2, savedScale)) : 0;
  const accessPrefs = (() => {
    try {
      const value = JSON.parse(localStorage.getItem('bk-accessibility') || '{}');
      return value && typeof value === 'object' ? value : {};
    }
    catch { return {}; }
  })();
  function applyAccess() {
    document.documentElement.classList.toggle('a11y-large-text', textScale === 1);
    document.documentElement.classList.toggle('a11y-larger-text', textScale === 2);
    document.documentElement.classList.toggle('a11y-small-text', textScale < 0);
    Object.entries(accessClasses).forEach(([key, className]) => {
      document.documentElement.classList.toggle(className, Boolean(accessPrefs[key]));
      const button = accessPanel.querySelector(`[data-akses="${key}"]`);
      button.setAttribute('aria-pressed', String(Boolean(accessPrefs[key])));
    });
  }
  applyAccess();
  accessToggle.addEventListener('click', () => {
    const open = accessPanel.classList.toggle('hidden') === false;
    accessToggle.setAttribute('aria-expanded', String(open));
  });
  accessPanel.addEventListener('click', (event) => {
    const close = event.target.closest('[data-akses-close]');
    const size = event.target.closest('[data-ukuran]');
    const setting = event.target.closest('[data-akses]');
    if (close) {
      accessPanel.classList.add('hidden');
      accessToggle.setAttribute('aria-expanded', 'false');
    } else if (size) {
      textScale = Math.max(-1, Math.min(2, textScale + Number(size.dataset.ukuran)));
      localStorage.setItem('bk-text-scale', String(textScale));
      applyAccess();
    } else if (setting) {
      const key = setting.dataset.akses;
      accessPrefs[key] = !accessPrefs[key];
      localStorage.setItem('bk-accessibility', JSON.stringify(accessPrefs));
      applyAccess();
    } else if (event.target.closest('[data-akses-reset]')) {
      textScale = 0;
      accessPrefs.contrast = false;
      accessPrefs.links = false;
      localStorage.removeItem('bk-text-scale');
      localStorage.removeItem('bk-accessibility');
      applyAccess();
    }
  });

  const assistantToggle = document.getElementById('asisten-toggle');
  const assistantPanel = document.getElementById('asisten-panel');
  const assistantInput = document.getElementById('asisten-input');
  const assistantMessages = document.getElementById('asisten-pesan');
  const addAssistantMessage = (text, user) => {
    const message = document.createElement('p');
    message.textContent = text;
    message.className = `max-w-[90%] whitespace-pre-line rounded-xl px-3 py-2 text-sm ${user ? 'self-end rounded-tr-sm bg-primary/25' : 'self-start rounded-tl-sm bg-cream'}`;
    assistantMessages.appendChild(message);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
  };
  function answerAssistant(question) {
    const q = question.toLowerCase();
    if (/profil|tugas|fungsi|tentang|bakesbangpol/.test(q)) {
      return 'Bakesbangpol Kabupaten Ponorogo membantu urusan kesatuan bangsa dan politik, termasuk wawasan kebangsaan, politik dan organisasi kemasyarakatan, serta kewaspadaan nasional. Lihat bagian Profil dan Bidang di halaman Beranda.';
    }
    if (/bidang|sekretariat|ormas|organisasi|politik|kewaspadaan|ideologi/.test(q)) {
      return 'Informasi bidang tersedia di bagian Bidang pada Beranda: Sekretariat; Ideologi dan Wawasan Kebangsaan; Politik Dalam Negeri dan Ormas; serta Kewaspadaan Nasional.';
    }
    if (/berita|kabar|artikel/.test(q)) {
      return 'Berita dan pengumuman dapat dibaca pada halaman Berita. Pilih menu Berita di bagian atas untuk melihat daftar dan kategori.';
    }
    if (/idi|demokrasi/.test(q)) {
      return 'E-IDI menampilkan informasi Indeks Demokrasi Indonesia, termasuk aspek, skor, dan tren. Buka menu E-IDI untuk melihat datanya.';
    }
    if (/kontak|alamat|telepon|email|jam|hubungi/.test(q)) {
      return 'Alamat dan informasi kontak yang tersedia dapat dilihat pada bagian bawah halaman. Jika nomor telepon atau email tidak tercantum, gunakan saluran resmi Pemerintah Kabupaten Ponorogo.';
    }
    if (/komentar|balas|suka|lapor/.test(q)) {
      return 'Pada halaman detail berita, Anda dapat mengirim komentar dengan nama tampilan. Komentar tampil setelah disetujui admin. Aturan dan privasi tersedia di halaman Kebijakan.';
    }
    if (/aspirasi|pengaduan|laporan resmi|lapor\\.go/.test(q)) {
      return 'Panduan aspirasi dan pengaduan tersedia di halaman Aspirasi. Situs ini belum menerima pengaduan resmi secara langsung; gunakan SP4N-LAPOR atau kanal resmi instansi.';
    }
    if (/privasi|data pribadi|kebijakan|aturan komentar/.test(q)) {
      return 'Aturan komentar dan informasi data yang digunakan tersedia di halaman Kebijakan dan Privasi.';
    }
    return 'Maaf, saya belum menemukan jawaban di panduan situs. Coba tanyakan tentang profil, bidang, berita, E-IDI, komentar, atau kontak.';
  }
  function submitAssistant(question) {
    const value = question.trim();
    if (!value) return;
    addAssistantMessage(value, true);
    addAssistantMessage(answerAssistant(value), false);
  }
  assistantToggle.addEventListener('click', () => {
    const open = assistantPanel.classList.toggle('hidden') === false;
    assistantToggle.setAttribute('aria-expanded', String(open));
    if (open) assistantInput.focus();
  });
  document.getElementById('asisten-close').addEventListener('click', () => {
    assistantPanel.classList.add('hidden');
    assistantToggle.setAttribute('aria-expanded', 'false');
    assistantToggle.focus();
  });
  assistantMessages.addEventListener('click', (event) => {
    const prompt = event.target.closest('[data-tanya]');
    if (prompt) submitAssistant(prompt.dataset.tanya);
  });
  document.getElementById('asisten-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAssistant(assistantInput.value);
    assistantInput.value = '';
    assistantInput.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!assistantPanel.classList.contains('hidden')) {
      assistantPanel.classList.add('hidden');
      assistantToggle.setAttribute('aria-expanded', 'false');
    }
    if (!accessPanel.classList.contains('hidden')) {
      accessPanel.classList.add('hidden');
      accessToggle.setAttribute('aria-expanded', 'false');
    }
  });
})();

  const fx = document.createElement('script');
  fx.src = '/js/effects.js';
  fx.defer = true;
  document.body.appendChild(fx);
