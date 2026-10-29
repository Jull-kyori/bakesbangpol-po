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
      if (!m.sub) return `<a href="${m.h}" class="nav-link"${spy}>${m.t}</a>`;
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
          <summary class="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">${m.t}${chevron('')}</summary>
          <div class="pb-2 pl-4">${m.sub.map(([t, h]) => `<a href="${h}" class="block py-2 text-sm text-white/80 hover:text-primary">${t}</a>`).join('')}</div>
        </details>`
      : `<a href="${m.h}" class="block border-t border-white/10 py-3 text-sm font-medium hover:text-primary">${m.t}</a>`
    ).join('');

    header.innerHTML = `
      <div id="header-bar" class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 transition-all duration-300">
        <a href="/" class="flex items-center gap-3">
          <!-- LOGO: jika kamu sudah memakai logo sendiri, tempel ulang markup logomu di sini -->
          <span class="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display font-bold text-ink">B<img src="/assets/img/logo.png" alt="" class="absolute inset-0 h-full w-full rounded-full bg-white object-contain" onerror="this.remove()"></span>
          <span class="leading-tight"><span class="block font-display text-lg font-bold">BAKESBANGPOL</span><span class="block text-xs text-white/75">Kabupaten Ponorogo</span></span>
        </a>
        <nav class="hidden items-center gap-7 text-sm font-medium lg:flex" aria-label="Menu utama">${desktop}</nav>
        <button id="menu-btn" type="button" aria-label="Buka menu" aria-expanded="false" aria-controls="menu-panel" class="rounded-lg p-2 hover:bg-white/10 lg:hidden">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
      <nav id="menu-panel" class="hidden max-h-[75vh] overflow-y-auto bg-ink px-6 pb-5 lg:hidden" aria-label="Menu seluler">${mobile}</nav>`;

    const btn = document.getElementById('menu-btn');
    const panel = document.getElementById('menu-panel');
    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
    });
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) panel.classList.add('hidden'); });

    // Di beranda: menu transparan di atas hero, lalu menjadi solid dan lebih ramping saat di-scroll
    if (overlay) {
      const bar = document.getElementById('header-bar');
      const onScroll = () => {
        const s = scrollY > 40;
        header.classList.toggle('bg-ink/95', s);
        header.classList.toggle('shadow-lg', s);
        header.classList.toggle('backdrop-blur', s);
        bar.classList.toggle('py-4', !s);
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
})();

  const fx = document.createElement('script');
  fx.src = '/js/effects.js';
  fx.defer = true;
  document.body.appendChild(fx);
