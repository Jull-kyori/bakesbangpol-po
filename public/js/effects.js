/* Efek interaktif umum: muncul saat scroll, progres baca, tombol ke atas, penanda menu aktif.
   Dimuat otomatis oleh layout.js. Menghormati pengaturan "kurangi gerakan" milik pengguna. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 1. Bilah progres baca + tombol kembali ke atas ----
  const bar = document.createElement('div');
  bar.setAttribute('aria-hidden', 'true');
  bar.className = 'fixed inset-x-0 top-0 z-50 h-1 origin-left bg-primary';
  bar.style.transform = 'scaleX(0)';

  const toTop = document.createElement('button');
  toTop.type = 'button';
  toTop.setAttribute('aria-label', 'Kembali ke atas');
  toTop.className = 'fixed bottom-6 left-6 z-40 hidden h-11 w-11 items-center justify-center rounded-full bg-ink text-white shadow-lg ring-1 ring-white/20 transition hover:bg-accent';
  toTop.innerHTML = '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  document.body.append(bar, toTop);

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(scrollY / max, 1) : 0) + ')';
      const show = scrollY > 600;
      toTop.classList.toggle('hidden', !show);
      toTop.classList.toggle('flex', show);
      if (scrollY < 300) document.querySelectorAll('.nav-link.is-active').forEach((a) => a.classList.remove('is-active'));
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- 2. Muncul halus saat masuk layar ----
  const io = ('IntersectionObserver' in window && !reduce)
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    : null;

  function reveal(nodes) {
    if (!io || !nodes) return;
    const list = nodes.nodeType === 1 ? [nodes] : Array.from(nodes);
    list.forEach((el, i) => {
      if (el.dataset.fx) return;
      el.dataset.fx = '1';
      el.classList.add('reveal');
      el.style.setProperty('--d', (i % 4) * 90 + 'ms'); // muncul berurutan, bukan serentak
      io.observe(el);
    });
  }

  // Bagian yang otomatis diberi efek (tanpa perlu mengubah HTML)
  [
    '.hero-fan .relative.mx-auto > *',
    '[aria-label="Akses cepat"] a',
    '#profil .grid > *',
    '#angka .stat',
    '#berita > div > div:first-child',
    '#bidang > div > h2, #bidang > div > p, #bidang article',
    '#idi-teaser .grid > *',
    '#struktur > div > h2, #struktur > div > p, #struktur .flex.flex-col, #struktur article',
    '[data-reveal]'
  ].forEach((sel) => reveal(document.querySelectorAll(sel)));

  // ---- 3. Penanda menu sesuai bagian yang sedang dilihat ----
  const links = Array.from(document.querySelectorAll('[data-spy]'));
  if (links.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || scrollY < 300) return;
        links.forEach((a) => a.classList.toggle('is-active', a.dataset.spy.split(' ').includes(e.target.id)));
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    links.forEach((a) => a.dataset.spy.split(' ').forEach((id) => {
      const s = document.getElementById(id);
      if (s) spy.observe(s);
    }));
  }

  window.FX = { reveal, reduce };
  window.dispatchEvent(new Event('fx:ready'));
})();
