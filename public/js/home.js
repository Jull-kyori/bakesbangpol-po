/* Khusus beranda: tab berita per kategori dan angka yang menghitung naik. */
(function () {
  const { esc, cardBerita } = window.BK;
  const $ = (s) => document.querySelector(s);
  const fmt = (n, dec) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  const onFx = (fn) => window.FX ? fn(window.FX) : window.addEventListener('fx:ready', () => fn(window.FX), { once: true });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Angka menghitung naik saat terlihat ----
  function countUp(el) {
    const end = Number(el.dataset.count) || 0;
    const dec = Number(el.dataset.decimals || 0);
    if (reduce) { el.textContent = fmt(end, dec); return; }
    const t0 = performance.now(), dur = 1400;
    (function step(t) {
      const k = Math.min((t - t0) / dur, 1);
      el.textContent = fmt(end * (1 - Math.pow(1 - k, 3)), dec);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function watchCount(el) {
    el.textContent = fmt(0, Number(el.dataset.decimals || 0));
    if (!('IntersectionObserver' in window)) { countUp(el); return; }
    const o = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { countUp(el); o.disconnect(); }
    }, { threshold: 0.5 });
    o.observe(el);
  }
  function setStat(id, value) {
    const box = $(id);
    if (!box) return;
    if (value == null) { box.classList.add('hidden'); return; } // data tidak tersedia: sembunyikan, jangan tampilkan angka palsu
    const num = box.querySelector('[data-count]');
    num.dataset.count = value;
    watchCount(num);
  }

  // Pejabat dan staf dihitung dari struktur di halaman (5 pejabat + semua staf yang tercantum)
  const jumlahStaf = document.querySelectorAll('#struktur li').length;
  setStat('#stat-pegawai', jumlahStaf ? jumlahStaf + 5 : null);
  document.querySelectorAll('#angka [data-count]').forEach((el) => {
    if (!el.closest('#stat-pegawai, #stat-berita')) watchCount(el);
  });

  // ---- Berita: tab kategori ----
  const box = $('#berita-list');
  const tabs = $('#berita-tabs');
  let beritaTotal = null;

  async function loadBerita(kat) {
    box.setAttribute('aria-busy', 'true');
    try {
      const p = new URLSearchParams({ limit: 6 });
      if (kat) p.set('kategori', kat);
      const d = await fetch('/api/berita?' + p).then((r) => r.json());
      box.innerHTML = d.items.length
        ? d.items.map((b, i) => cardBerita(b, i === 0 && d.items.length >= 3)).join('')
        : '<p class="col-span-full rounded-xl bg-cream p-8 text-center text-slate-600">Belum ada berita di kategori ini.</p>';
      onFx((fx) => fx.reveal(box.children));
      return d;
    } catch (e) {
      box.innerHTML = '<p class="col-span-full rounded-xl bg-cream p-8 text-center text-slate-600">Berita belum bisa dimuat. Muat ulang halaman ini beberapa saat lagi.</p>';
    } finally {
      box.removeAttribute('aria-busy');
    }
  }

  function renderTabs(daftar, aktif) {
    tabs.innerHTML = ['', ...daftar].map((k) =>
      `<button type="button" role="tab" data-k="${esc(k)}" aria-selected="${k === aktif}" class="rounded-full px-4 py-2 text-sm font-semibold transition ${k === aktif ? 'bg-primary text-ink' : 'bg-cream text-ink ring-1 ring-ink/15 hover:ring-primary'}">${esc(k || 'Semua')}</button>`
    ).join('');
  }

  (async function initBerita() {
    const daftar = await fetch('/api/kategori').then((r) => r.json()).catch(() => []);
    renderTabs(daftar, '');
    tabs.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      renderTabs(daftar, b.dataset.k);
      await loadBerita(b.dataset.k);
    });
    const d = await loadBerita('');
    beritaTotal = d ? d.total : null;
    setStat('#stat-berita', beritaTotal);
  })();

})();
