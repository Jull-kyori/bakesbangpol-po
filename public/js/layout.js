/* Header, footer, dan fungsi bantu yang dipakai semua halaman publik. */
(function () {
  const SITE = {
    brandName: 'BAKESBANGPOL',
    organizationName: 'Badan Kesatuan Bangsa dan Politik',
    district: 'Kabupaten Ponorogo',
    alamat: 'Kabupaten Ponorogo, Jawa Timur',
    telepon: '',
    email: '',
    jam: '',
    announcementEnabled: false,
    announcement: '',
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mobileMenuCloseTimer;
  let mobileMenuInertState = [];
  let mobileMenuOpener = null;

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
      ? `<img src="${esc(b.gambar)}" alt="" width="1280" height="800" sizes="${big ? '(min-width: 1024px) 55vw, 100vw' : '(min-width: 1024px) 33vw, 100vw'}" loading="lazy" decoding="async" class="news-card__image h-full w-full object-cover">`
      : `<div class="flex h-full min-h-44 items-center justify-center bg-linear-to-br from-sky-100 to-emerald-50 font-display text-5xl font-bold text-primary-dark" aria-hidden="true">B</div>`;
    return `<a href="/berita-detail.html?id=${encodeURIComponent(b.id)}" class="news-card ${big ? 'news-card__featured lg:col-span-2' : ''} group flex flex-col overflow-hidden rounded-2xl bg-white transition hover:-translate-y-1">
      <span class="news-card__media relative block overflow-hidden bg-sky-50">
        ${img}
        <span class="absolute inset-0 bg-linear-to-t from-ink/45 via-transparent to-transparent" aria-hidden="true"></span>
        <span class="absolute bottom-3 left-3 rounded-full border border-white/40 bg-white/90 px-3 py-1 text-xs font-semibold text-ink backdrop-blur">${esc(b.kategori)}</span>
      </span>
      <span class="news-card__body flex flex-1 flex-col p-5">
        <span class="text-xs font-medium text-slate-500">${tanggal(b.tanggal)}</span>
        <span class="mt-2 block ${big ? 'text-xl sm:text-2xl' : 'text-lg'} font-bold leading-snug text-ink group-hover:text-primary-dark">${esc(b.judul)}</span>
        <span class="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">${esc(b.ringkasan)}</span>
        <span class="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-primary-dark">Baca selengkapnya <span aria-hidden="true" class="transition-transform group-hover:translate-x-1">→</span></span>
      </span>
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
    { t: 'Dokumentasi', h: '/#dokumentasi', spy: 'dokumentasi' },
    { t: 'Paskibraka BPIP', h: 'https://paskibraka.bpip.go.id/', external: true },
    { t: 'Aspirasi', h: '/#aspirasi', spy: 'aspirasi' },
    { t: 'Kontak', h: '#kontak' }
  ];
  const chevron = (cls) => `<svg class="h-3 w-3 transition-transform duration-200 ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

  function closeFloatingPanels() {
    ['aksesibilitas-panel', 'faq-panel'].forEach((id) => {
      const panel = document.getElementById(id);
      const toggle = document.querySelector(`[aria-controls="${id}"]`);
      if (panel) panel.classList.add('hidden');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function closeMobileMenu(restoreFocus = false) {
    const panel = document.getElementById('menu-panel');
    const toggle = document.getElementById('menu-btn');
    if (!panel || !toggle) return;
    const backdrop = document.getElementById('menu-backdrop');
    clearTimeout(mobileMenuCloseTimer);
    panel.inert = true;
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.add('-translate-x-full');
    if (backdrop) {
      backdrop.inert = true;
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.classList.add('opacity-0');
      mobileMenuCloseTimer = setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Buka menu');
    const bottomMenuButton = document.querySelector('[data-bottom-menu]');
    if (bottomMenuButton) bottomMenuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('public-menu-open');
    mobileMenuInertState.forEach(([element, inert]) => { element.inert = inert; });
    mobileMenuInertState = [];
    if (restoreFocus && mobileMenuOpener && mobileMenuOpener.isConnected &&
        !mobileMenuOpener.inert && mobileMenuOpener.offsetParent !== null) {
      mobileMenuOpener.focus();
    }
    mobileMenuOpener = null;
  }

  const header = document.getElementById('site-header');
  if (header) {
    document.body.classList.add('public-site');
    const overlay = header.dataset.variant === 'overlay';
    header.className = overlay
      ? 'glass-header glass-header--overlay fixed inset-x-0 top-0 z-30 text-white transition-all duration-300'
      : 'glass-header sticky top-0 z-30 text-white transition-all duration-300';

    // Menu desktop: submenu meluncur turun saat disorot kursor atau difokus keyboard
    const desktop = MENU.map((m) => {
      const spy = m.spy ? ` data-spy="${m.spy}"` : '';
      const currentPage = !m.external && !m.h.includes('#') && new URL(m.h, location.href).pathname === location.pathname;
      const activeClass = currentPage ? ' text-primary' : '';
      const current = currentPage ? ' aria-current="page"' : '';
      const external = m.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      if (!m.sub) return `<a href="${m.h}" class="nav-link${activeClass}"${current}${spy}${external}>${m.t}</a>`;
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
    const mobile = MENU.map((m) => {
      const currentPage = !m.external && !m.h.includes('#') && new URL(m.h, location.href).pathname === location.pathname;
      const activeClass = currentPage ? ' text-primary' : '';
      const current = currentPage ? ' aria-current="page"' : '';
      const external = m.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return m.sub
      ? `<details class="border-t border-white/10">
          <summary class="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium focus-visible:rounded">${m.t}${chevron('')}</summary>
          <div class="pb-2 pl-4">${m.sub.map(([t, h]) => `<a href="${h}" class="block py-2 text-sm text-white/80 hover:text-primary">${t}</a>`).join('')}</div>
        </details>`
      : `<a href="${m.h}" class="block border-t border-white/10 py-3 text-sm font-medium hover:text-primary${activeClass}"${current}${external}>${m.t}</a>`;
    }).join('');

    header.innerHTML = `
      <div id="header-bar" class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 transition-all duration-300 sm:px-6 sm:py-4">
        <a href="/" class="flex items-center gap-3">
          <!-- LOGO: jika kamu sudah memakai logo sendiri, tempel ulang markup logomu di sini -->
          <span class="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display font-bold text-ink">B<img src="/assets/img/logo.png" alt="" class="absolute inset-0 h-full w-full rounded-full bg-white object-contain" onerror="this.remove()"></span>
          <span class="leading-tight"><span data-site-brand class="block font-display text-lg font-bold">BAKESBANGPOL</span><span data-site-district class="block text-xs text-white/75">Kabupaten Ponorogo</span></span>
        </a>
        <nav class="hidden items-center gap-5 text-sm font-medium xl:flex 2xl:gap-7" aria-label="Menu utama">${desktop}</nav>
        <button id="menu-btn" type="button" aria-label="Buka menu" aria-expanded="false" aria-controls="menu-panel" class="rounded-lg p-2 hover:bg-white/10 xl:hidden">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
      `;

    const btn = document.getElementById('menu-btn');
    const backdrop = document.createElement('button');
    backdrop.id = 'menu-backdrop';
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Tutup menu');
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.inert = true;
    backdrop.className = 'mobile-menu-backdrop fixed inset-0 z-70 hidden bg-ink/35 opacity-0 backdrop-blur-sm transition-opacity duration-300 xl:hidden';

    const panel = document.createElement('nav');
    panel.id = 'menu-panel';
    panel.setAttribute('aria-label', 'Menu seluler');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    panel.className = 'mobile-menu-panel glass-panel fixed inset-y-0 left-0 z-80 flex w-[min(19rem,84vw)] -translate-x-full flex-col overflow-y-auto border-r border-white/15 px-4 py-5 text-white shadow-2xl transition-transform duration-300 xl:hidden';
    panel.innerHTML = `
      <div class="mb-6 flex items-start justify-between gap-3">
        <a href="/" class="flex min-w-0 items-center gap-3" aria-label="Beranda Bakesbangpol Ponorogo">
          <img src="/assets/img/logo.png" alt="" class="h-10 w-10 shrink-0 rounded-full bg-white/95 p-1 shadow-lg">
          <span class="min-w-0 leading-tight">
            <span data-site-brand class="block truncate text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sky-200">BAKESBANGPOL</span>
            <span data-site-district class="mt-1 block font-display text-sm font-bold">Kabupaten Ponorogo</span>
          </span>
        </a>
        <button id="menu-close" type="button" aria-label="Tutup menu" class="rounded-lg p-2 text-white/75 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="flex flex-col gap-1 text-sm font-semibold">${mobile}</div>`;
    document.body.append(backdrop, panel);

    function setMobileMenuOpen(open, opener = btn, restoreFocus = false) {
      if (open) {
        clearTimeout(mobileMenuCloseTimer);
        mobileMenuOpener = opener;
        backdrop.classList.remove('hidden');
        backdrop.inert = false;
        backdrop.setAttribute('aria-hidden', 'false');
        panel.inert = false;
        panel.setAttribute('aria-hidden', 'false');
        mobileMenuInertState = Array.from(document.body.children)
          .filter((element) => element !== backdrop && element !== panel)
          .map((element) => {
            const previousInert = element.inert;
            element.inert = true;
            return [element, previousInert];
          });
        document.body.classList.add('public-menu-open');
        requestAnimationFrame(() => {
          backdrop.classList.remove('opacity-0');
          panel.classList.remove('-translate-x-full');
        });
        closeFloatingPanels();
        document.getElementById('menu-close').focus();
      } else {
        closeMobileMenu(restoreFocus);
      }
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
      const bottomMenuButton = document.querySelector('[data-bottom-menu]');
      if (bottomMenuButton) bottomMenuButton.setAttribute('aria-expanded', String(open));
    }

    btn.addEventListener('click', () => {
      setMobileMenuOpen(btn.getAttribute('aria-expanded') !== 'true', btn, true);
    });
    backdrop.addEventListener('click', () => setMobileMenuOpen(false, btn, true));
    document.getElementById('menu-close').addEventListener('click', () => setMobileMenuOpen(false, btn, true));
    panel.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return;
      setMobileMenuOpen(false, btn);
    });
    document.addEventListener('keydown', (event) => {
      if (btn.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false, btn, true);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll('a[href], button:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      }
    });
    matchMedia('(min-width: 1280px)').addEventListener('change', (event) => {
      if (event.matches && btn.getAttribute('aria-expanded') === 'true') setMobileMenuOpen(false, btn);
    });

    // Di beranda: menu transparan di atas hero, lalu menjadi solid dan lebih ramping saat di-scroll
    if (overlay) {
      const bar = document.getElementById('header-bar');
      const onScroll = () => {
        const s = scrollY > 40;
        header.classList.toggle('is-scrolled', s);
        bar.classList.toggle('py-3', !s);
        bar.classList.toggle('sm:py-4', !s);
        bar.classList.toggle('py-2.5', s);
      };
      addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const bottomNav = document.createElement('nav');
    bottomNav.className = 'mobile-bottom-nav';
    bottomNav.setAttribute('aria-label', 'Navigasi utama seluler');
    bottomNav.innerHTML = `
      <a href="/" data-bottom-nav="home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>
        <span>Beranda</span>
      </a>
      <a href="/#beranda-cari" data-bottom-nav="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <span>Cari</span>
      </a>
      <a href="/berita.html" data-bottom-nav="news">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v14H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M5 4v13a3 3 0 0 0 3 3M9 8h8M9 12h8M9 16h5"/></svg>
        <span>Berita</span>
      </a>
      <a href="/#dokumentasi" data-bottom-nav="docs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        <span>Dokumentasi</span>
      </a>
      <button type="button" data-bottom-menu aria-label="Buka menu lainnya" aria-controls="menu-panel" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
        <span>Menu</span>
      </button>`;
    document.body.appendChild(bottomNav);

    function updateBottomNav() {
      const currentPath = location.pathname;
      const hash = location.hash;
      const active = hash === '#beranda-cari' ? 'search'
        : hash === '#dokumentasi' ? 'docs'
          : currentPath === '/berita.html' || currentPath === '/berita-detail.html' ? 'news'
            : currentPath === '/' ? 'home' : '';
      bottomNav.querySelectorAll('a[data-bottom-nav]').forEach((link) => {
        if (link.dataset.bottomNav === active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }
    updateBottomNav();
    addEventListener('hashchange', updateBottomNav);
    addEventListener('popstate', updateBottomNav);
    bottomNav.querySelector('[data-bottom-menu]').addEventListener('click', (event) => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      setMobileMenuOpen(open, event.currentTarget, true);
      if (open) panel.scrollTop = 0;
    });
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
          <p data-site-organization class="font-display text-xl font-bold">Badan Kesatuan Bangsa dan Politik</p>
          <p data-footer-district class="text-white/75">Kabupaten Ponorogo</p>
          <dl data-site-contact class="mt-5 space-y-2 text-sm text-white/85">
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
            <li><a class="hover:text-primary" href="/#dokumentasi">Dokumentasi kegiatan</a></li>
            <li><a class="hover:text-primary" href="/#aspirasi">Aspirasi dan pengaduan</a></li>
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
    const socialBar = document.createElement('div');
    socialBar.className = 'border-y border-slate-200 bg-slate-100 px-4 py-2.5 text-ink';
    socialBar.innerHTML = `
      <nav class="mx-auto flex max-w-7xl items-center justify-center gap-5" aria-label="Media sosial resmi Bakesbangpol Kabupaten Ponorogo">
        <a href="https://www.instagram.com/bakesbangpol_ponorogo/" target="_blank" rel="noopener noreferrer" aria-label="Instagram Bakesbangpol Kabupaten Ponorogo (buka di tab baru)" class="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold text-slate-600 transition hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none"/></svg>
          <span>Instagram</span>
        </a>
        <a href="https://www.tiktok.com/@bakesbangpol_ponorogo" target="_blank" rel="noopener noreferrer" aria-label="TikTok Bakesbangpol Kabupaten Ponorogo (buka di tab baru)" class="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold text-slate-600 transition hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4v10.5a4.5 4.5 0 1 1-4-4.47"/><path d="M14 4c.5 3 2.5 5 5 5"/></svg>
          <span>TikTok</span>
        </a>
      </nav>`;
    footer.parentNode.insertBefore(socialBar, footer);
  }

  // ---- Aksesibilitas dan FAQ ----
  const widget = document.createElement('div');
  widget.innerHTML = `
    <div id="aksesibilitas-widget" class="fixed bottom-4 left-4 z-60">
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
    <div id="faq-widget" class="fixed bottom-4 right-4 z-60">
      <button id="faq-toggle" type="button" aria-label="Buka FAQ" aria-expanded="false" aria-controls="faq-panel" class="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-xl ring-2 ring-white transition hover:scale-105 hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.2-2.3 1.3-2.3 3"/><path d="M12 17h.01"/></svg>
      </button>
      <section id="faq-panel" aria-label="Pertanyaan yang sering diajukan" class="absolute bottom-16 right-0 hidden w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white text-ink shadow-2xl ring-1 ring-ink/15">
        <div class="flex items-center justify-between bg-ink px-4 py-3 text-white">
          <div><h2 class="font-display font-bold">Pertanyaan umum</h2><p class="text-xs text-white/75">Informasi Bakesbangpol Ponorogo</p></div>
          <button id="faq-close" type="button" aria-label="Tutup FAQ" class="rounded-lg px-2 py-1 text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tutup</button>
        </div>
        <div class="max-h-[min(28rem,calc(100dvh-9rem))] overflow-y-auto p-4">
          <div class="faq-list divide-y divide-ink/10">
            <details>
              <summary>Apa tugas Bakesbangpol?</summary>
              <p>Bakesbangpol Kabupaten Ponorogo membantu urusan kesatuan bangsa dan politik, termasuk wawasan kebangsaan, politik dan organisasi kemasyarakatan, serta kewaspadaan nasional. Lihat <a href="/#profil">Profil</a> dan <a href="/#bidang">Bidang</a>.</p>
            </details>
            <details>
              <summary>Apa saja bidang yang ada?</summary>
              <p>Bidangnya meliputi Sekretariat; Ideologi dan Wawasan Kebangsaan; Politik Dalam Negeri dan Organisasi Kemasyarakatan; serta Kewaspadaan Nasional. <a href="/#bidang">Lihat informasi bidang</a>.</p>
            </details>
            <details>
              <summary>Di mana saya dapat membaca berita?</summary>
              <p>Berita dan pengumuman tersedia di halaman <a href="/berita.html">Berita</a>, termasuk pilihan kategori dan pencarian.</p>
            </details>
            <details>
              <summary>Bagaimana cara menyampaikan aspirasi atau pengaduan?</summary>
              <p>Situs ini tidak menerima pengaduan resmi secara langsung. Buka <a href="/aspirasi.html">Panduan Aspirasi</a> untuk memilih kanal yang sesuai.</p>
            </details>
            <details>
              <summary>Bagaimana komentar dimoderasi?</summary>
              <p>Komentar dan balasan pada berita ditinjau admin sebelum ditampilkan. Baca <a href="/kebijakan.html">aturan komentar dan privasi</a>.</p>
            </details>
            <details>
              <summary>Bagaimana cara menghubungi Bakesbangpol?</summary>
              <p id="faq-contact">Informasi alamat dan kontak tersedia di bagian bawah halaman. Jika belum tercantum, gunakan saluran resmi Pemerintah Kabupaten Ponorogo.</p>
              <a href="/#kontak">Lihat informasi kontak</a>
            </details>
          </div>
        </div>
      </section>
    </div>`;
  document.body.appendChild(widget);

  async function applySiteSettings() {
    try {
      const response = await fetch('/api/site-settings');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const settings = await response.json();
      Object.assign(SITE, {
        brandName: settings.brandName,
        organizationName: settings.organizationName,
        district: settings.district,
        alamat: settings.address,
        telepon: settings.phone,
        email: settings.email,
        jam: settings.serviceHours,
        announcementEnabled: settings.announcementEnabled,
        announcement: settings.announcement
      });

      const brands = document.querySelectorAll('[data-site-brand]');
      const districts = document.querySelectorAll('[data-site-district]');
      const organization = document.querySelector('[data-site-organization]');
      const footerDistrict = document.querySelector('[data-footer-district]');
      brands.forEach((brand) => { brand.textContent = SITE.brandName; });
      districts.forEach((district) => { district.textContent = SITE.district; });
      if (organization) organization.textContent = SITE.organizationName;
      if (footerDistrict) footerDistrict.textContent = SITE.district;

      const contactList = document.querySelector('[data-site-contact]');
      if (contactList) {
        const rows = [
          ['Alamat', SITE.alamat],
          ['Telepon', SITE.telepon],
          ['Email', SITE.email],
          ['Jam layanan', SITE.jam]
        ].filter(([, value]) => value);
        contactList.innerHTML = rows.map(([label, value]) =>
          `<div><dt class="inline font-semibold text-primary">${esc(label)}:</dt> <dd class="inline">${esc(value)}</dd></div>`
        ).join('');
      }

      if (mainContent && SITE.announcementEnabled && SITE.announcement) {
        let banner = document.getElementById('site-announcement');
        if (!banner) {
          banner = document.createElement('aside');
          banner.id = 'site-announcement';
          banner.setAttribute('role', 'status');
          banner.className = 'mx-auto mb-6 max-w-7xl rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm';
          mainContent.prepend(banner);
        }
        banner.textContent = SITE.announcement;
      }

      const faqContact = document.getElementById('faq-contact');
      const contactDetails = [SITE.alamat, SITE.telepon, SITE.email, SITE.jam].filter(Boolean);
      if (faqContact && contactDetails.length) faqContact.textContent = `Informasi kontak: ${contactDetails.join('; ')}.`;
    } catch (error) {
      console.warn(`[Pengaturan situs] Tidak dapat memuat pengaturan: ${error.message}`);
    }
  }
  applySiteSettings();

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
    if (open) {
      closeMobileMenu();
      faqPanel.classList.add('hidden');
      faqToggle.setAttribute('aria-expanded', 'false');
    }
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

  const faqToggle = document.getElementById('faq-toggle');
  const faqPanel = document.getElementById('faq-panel');
  faqToggle.addEventListener('click', () => {
    const open = faqPanel.classList.toggle('hidden') === false;
    faqToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      closeMobileMenu();
      accessPanel.classList.add('hidden');
      accessToggle.setAttribute('aria-expanded', 'false');
      document.getElementById('faq-close').focus();
    }
  });
  document.getElementById('faq-close').addEventListener('click', () => {
    faqPanel.classList.add('hidden');
    faqToggle.setAttribute('aria-expanded', 'false');
    faqToggle.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!faqPanel.classList.contains('hidden')) {
      faqPanel.classList.add('hidden');
      faqToggle.setAttribute('aria-expanded', 'false');
      faqToggle.focus();
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

  const analyticsKey = 'bakesbangpol-analytics-visitor';
  const analyticsCreatedKey = 'bakesbangpol-analytics-created';
  const analyticsOptOutKey = 'bakesbangpol-analytics-opt-out';
  const trackedPages = new Set(['/', '/berita.html', '/berita-detail.html', '/aspirasi.html', '/kebijakan.html']);
  function createAnalyticsId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function getAnalyticsVisitorId() {
    let visitorId = localStorage.getItem(analyticsKey);
    const createdAt = Number(localStorage.getItem(analyticsCreatedKey));
    const expired = !Number.isFinite(createdAt) || Date.now() - createdAt > 180 * 24 * 60 * 60 * 1000;
    if (expired || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId || '')) {
      visitorId = createAnalyticsId();
      localStorage.setItem(analyticsKey, visitorId);
      localStorage.setItem(analyticsCreatedKey, String(Date.now()));
    }
    return visitorId;
  }
  function setAnalyticsPreference() {
    const control = document.getElementById('analytics-opt-out');
    const status = document.getElementById('analytics-preference-status');
    if (!control) return;
    const optedOut = localStorage.getItem(analyticsOptOutKey) === 'true';
    control.textContent = optedOut ? 'Aktifkan pengukuran di browser ini' : 'Nonaktifkan pengukuran di browser ini';
    control.setAttribute('aria-pressed', String(optedOut));
    if (status) status.textContent = optedOut
      ? 'Pengukuran trafik dinonaktifkan di browser ini.'
      : 'Pengukuran trafik aktif di browser ini.';
  }
  try {
    if (document.getElementById('analytics-opt-out')) {
      setAnalyticsPreference();
      document.getElementById('analytics-opt-out').addEventListener('click', () => {
        try {
          const optingOut = localStorage.getItem(analyticsOptOutKey) !== 'true';
          localStorage.setItem(analyticsOptOutKey, String(optingOut));
          if (optingOut) {
            localStorage.removeItem(analyticsKey);
            localStorage.removeItem(analyticsCreatedKey);
          }
          setAnalyticsPreference();
        } catch (error) {
          console.warn('Preferensi pengukuran trafik tidak dapat disimpan:', error);
        }
      });
    }
    if (trackedPages.has(location.pathname) && localStorage.getItem(analyticsOptOutKey) !== 'true') {
      fetch('/api/traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: getAnalyticsVisitorId(), path: location.pathname }),
        keepalive: true
      }).catch((error) => console.warn('Pengukuran trafik gagal:', error));
    }
  } catch (error) {
    console.warn('Pengukuran trafik tidak tersedia:', error);
  }
