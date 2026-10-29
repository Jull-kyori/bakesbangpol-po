/* Khusus beranda: tab berita per kategori, angka yang menghitung naik, dan ringkasan E-IDI. */
(function () {
  const { esc, cardBerita } = window.BK;
  const $ = (s) => document.querySelector(s);
  const fmt = (n, dec) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  const onFx = (fn) => window.FX ? fn(window.FX) : window.addEventListener('fx:ready', () => fn(window.FX), { once: true });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Kategori skor, sama dengan halaman E-IDI
  const kategori = (s) => s >= 80
    ? { t: 'Baik', cls: 'bg-emerald-100 text-emerald-800' }
    : s < 60 ? { t: 'Kurang', cls: 'bg-red-100 text-red-800' } : { t: 'Sedang', cls: 'bg-amber-100 text-amber-800' };

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
    if (!el.closest('#stat-pegawai, #stat-berita, #stat-idi')) watchCount(el);
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

  // ---- Ringkasan E-IDI ----
  (async function initIdi() {
    const sec = $('#idi-teaser');
    try {
      const d = await fetch('/api/idi').then((r) => r.json());
      if (typeof d.skorTotal !== 'number' || !d.aspek.length) throw new Error('kosong');
      const k = kategori(d.skorTotal);
      $('#idi-skor').textContent = fmt(d.skorTotal, 2) + '%';
      $('#idi-tahun').textContent = d.tahun
        ? '(' + d.tahun + (d.periodeData ? ' · data utama ' + d.periodeData : '') + ')'
        : '';
      const kat = $('#idi-kat');
      kat.textContent = k.t;
      kat.className = 'rounded-full px-3 py-1 text-sm font-bold ' + k.cls;
      $('#idi-bars').innerHTML = d.aspek.map((a) => `
        <div>
          <div class="flex justify-between text-sm"><span class="font-semibold text-ink">${esc(a.judul)}</span><span class="font-bold text-primary-dark">${fmt(a.skor, 2)}%</span></div>
          <div class="mt-1.5 h-2.5 rounded-full bg-primary/20"><div class="fill-bar h-2.5 rounded-full bg-primary" data-w="${Math.min(100, Math.max(0, a.skor))}"></div></div>
        </div>`).join('');
      const isi = () => document.querySelectorAll('#idi-bars .fill-bar').forEach((b) => { b.style.width = b.dataset.w + '%'; });
      if (reduce || !('IntersectionObserver' in window)) isi();
      else {
        const o = new IntersectionObserver((es) => { if (es[0].isIntersecting) { isi(); o.disconnect(); } }, { threshold: 0.35 });
        o.observe($('#idi-bars'));
      }
      setStat('#stat-idi', d.skorTotal);
    } catch (e) {
      if (sec) sec.hidden = true;
      setStat('#stat-idi', null);
    }
  })();
})();
