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
    if (!el.closest('#stat-pegawai, #stat-berita, #stat-dokumentasi')) watchCount(el);
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

  // ---- Dokumentasi: filter bidang dan lightbox native ----
  const dokumentasiList = $('#dokumentasi-list');
  const dokumentasiTabs = $('#dokumentasi-tabs');
  const dokumentasiMore = $('#dokumentasi-more');
  const dialog = $('#dokumentasi-dialog');
  const dialogImage = $('#dokumentasi-dialog-image');
  const dialogTitle = $('#dokumentasi-dialog-title');
  const dialogMeta = $('#dokumentasi-dialog-meta');
  const dialogCaption = $('#dokumentasi-dialog-caption');

  function renderDocumentationTabs(categories, active) {
    dokumentasiTabs.innerHTML = ['', ...categories].map((category) =>
      `<button type="button" role="tab" data-k="${esc(category)}" aria-selected="${category === active}" class="rounded-full px-4 py-2 text-sm font-semibold transition ${category === active ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-ink/15 hover:ring-primary'}">${esc(category || 'Semua')}</button>`
    ).join('');
  }

  function renderDocumentation(items, append) {
    const markup = items.length ? items.map((item) => `
      <button type="button" data-documentation-title="${esc(item.judul)}" data-documentation-photo="${esc(item.gambar)}" data-documentation-category="${esc(item.kategori)}" data-documentation-date="${esc(item.tanggal)}" data-documentation-caption="${esc(item.keterangan || '')}" aria-label="Lihat dokumentasi: ${esc(item.judul)}" class="group overflow-hidden rounded-xl bg-white text-left shadow-sm ring-1 ring-ink/10 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none">
        <span class="relative block aspect-[4/3] overflow-hidden bg-primary/15">
          <img src="${esc(item.gambar)}" alt="" loading="lazy" decoding="async" class="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
          <span class="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-ink">${esc(item.kategori)}</span>
          <span class="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-ink shadow-lg transition group-hover:bg-accent group-hover:text-white" aria-hidden="true">↗</span>
        </span>
        <span class="block p-4">
          <span class="block text-xs font-semibold text-slate-500">${esc(window.BK.tanggal(item.tanggal))}</span>
          <span class="mt-1 block line-clamp-2 font-bold leading-snug text-ink group-hover:text-accent">${esc(item.judul)}</span>
        </span>
      </button>`).join('') :
      '<p class="col-span-full rounded-xl bg-white p-8 text-center text-slate-600">Belum ada dokumentasi untuk kategori ini.</p>';
    if (append) dokumentasiList.insertAdjacentHTML('beforeend', markup);
    else dokumentasiList.innerHTML = markup;
    if (items.length) {
      onFx((fx) => fx.reveal(append ? Array.from(dokumentasiList.children).slice(-items.length) : dokumentasiList.children));
    }
  }

  async function loadDocumentation(category, page, append) {
    dokumentasiList.setAttribute('aria-busy', 'true');
    dokumentasiMore.disabled = true;
    try {
      const params = new URLSearchParams({ limit: 8, page });
      if (category) params.set('kategori', category);
      const response = await fetch('/api/dokumentasi?' + params);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderDocumentation(data.items, append);
      dokumentasiMore.hidden = data.page >= data.pages;
      if (!category && page === 1) setStat('#stat-dokumentasi', data.total);
      return true;
    } catch (error) {
      dokumentasiList.innerHTML = '<p class="col-span-full rounded-xl bg-white p-8 text-center text-slate-600">Dokumentasi belum bisa dimuat. Coba muat ulang halaman beberapa saat lagi.</p>';
      if (!category) setStat('#stat-dokumentasi', null);
      dokumentasiMore.hidden = true;
      return false;
    } finally {
      dokumentasiList.removeAttribute('aria-busy');
      dokumentasiMore.disabled = false;
    }
  }

  let documentationCategory = '';
  let documentationPage = 1;
  (async function initDocumentation() {
    try {
      const response = await fetch('/api/kategori');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const categories = await response.json();
      renderDocumentationTabs(categories, '');
      dokumentasiTabs.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-k]');
        if (!button) return;
        renderDocumentationTabs(categories, button.dataset.k);
        documentationCategory = button.dataset.k;
        documentationPage = 1;
        await loadDocumentation(documentationCategory, documentationPage, false);
      });
    } catch (error) {
      renderDocumentationTabs([], '');
    }
    await loadDocumentation(documentationCategory, documentationPage, false);
  })();

  dokumentasiMore.addEventListener('click', async () => {
    const nextPage = documentationPage + 1;
    if (await loadDocumentation(documentationCategory, nextPage, true)) documentationPage = nextPage;
  });

  dokumentasiList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-documentation-title]');
    if (!button) return;
    dialogImage.src = button.dataset.documentationPhoto;
    dialogImage.alt = button.dataset.documentationTitle;
    dialogTitle.textContent = button.dataset.documentationTitle;
    dialogMeta.textContent = [
      button.dataset.documentationCategory,
      window.BK.tanggal(button.dataset.documentationDate)
    ].filter(Boolean).join(' · ');
    dialogCaption.textContent = button.dataset.documentationCaption;
    dialog.showModal();
    $('#dokumentasi-dialog-close').focus();
  });
  $('#dokumentasi-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialogImage.removeAttribute('src');
    dialogImage.alt = '';
  });

})();
