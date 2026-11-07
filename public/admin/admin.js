(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const form = $('#form');
  const documentationForm = $('#dokumentasi-form');
  const documentationInput = $('#dokumentasi-gambar');
  const structureForm = $('#struktur-form');
  const structurePhotoInput = $('#struktur-photo');
  const sidebar = $('#admin-sidebar-panel');
  const sidebarToggle = $('#admin-sidebar-toggle');
  const sidebarBackdrop = $('#admin-sidebar-backdrop');
  const adminViews = Array.from(document.querySelectorAll('[data-admin-view]'));
  const adminNav = $('#admin-sidebar-nav');
  let sidebarCloseTimer;
  let documentationPreviewUrls = [];
  let structurePreviewUrl = '';
  let structureData = null;
  let structureEditingId = null;
  let editingId = null;
  let page = 1;
  let trafficDays = 7;

  function showAdminView(viewId, focusView) {
    const activeView = adminViews.find((view) => view.dataset.adminView === viewId) || adminViews[0];
    if (!activeView) return;

    adminViews.forEach((view) => {
      const active = view === activeView;
      view.hidden = !active;
      view.inert = !active;
      view.setAttribute('aria-hidden', String(!active));
    });
    adminNav.querySelectorAll('a[href*="#"]').forEach((link) => {
      const active = link.hash.slice(1) === activeView.dataset.adminView;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (focusView) {
      window.scrollTo({ top: 0, behavior: window.FX && window.FX.reduce ? 'auto' : 'smooth' });
      activeView.focus({ preventScroll: true });
    }
  }

  function currentAdminView() {
    return window.location.hash.slice(1) || 'berita-admin';
  }

  showAdminView(currentAdminView(), false);
  window.addEventListener('hashchange', () => showAdminView(currentAdminView(), true));
  window.addEventListener('popstate', () => showAdminView(currentAdminView(), true));
  adminNav.addEventListener('click', (event) => {
    const link = event.target.closest('a[href*="#"]');
    if (!link || !adminViews.some((view) => view.dataset.adminView === link.hash.slice(1))) return;
    event.preventDefault();
    const nextUrl = link.pathname + link.hash;
    if (sidebarToggle && sidebarToggle.getAttribute('aria-expanded') === 'true') setMobileNavOpen(false);
    if (window.location.pathname + window.location.hash !== nextUrl) {
      history.pushState(null, '', nextUrl);
      showAdminView(link.hash.slice(1), true);
    }
  });

  function setMobileNavOpen(open) {
    if (!sidebar || !sidebarToggle || !sidebarBackdrop) return;
    clearTimeout(sidebarCloseTimer);
    sidebarToggle.setAttribute('aria-expanded', String(open));
    sidebarToggle.setAttribute('aria-label', open ? 'Tutup navigasi admin' : 'Buka navigasi admin');
    document.body.classList.toggle('admin-nav-open', open);
    document.querySelectorAll('body > main, body > section').forEach((section) => {
      section.inert = open || section.hidden;
    });
    if (open) {
      sidebarBackdrop.classList.remove('hidden');
      requestAnimationFrame(() => sidebarBackdrop.classList.remove('opacity-0'));
      sidebar.classList.remove('-translate-x-full');
      $('#admin-sidebar-close').focus();
    } else {
      sidebarBackdrop.classList.add('opacity-0');
      sidebar.classList.add('-translate-x-full');
      sidebarCloseTimer = setTimeout(() => sidebarBackdrop.classList.add('hidden'), 300);
      if (sidebarToggle.offsetParent !== null) sidebarToggle.focus();
    }
  }

  if (sidebarToggle && sidebarBackdrop) {
    sidebarToggle.addEventListener('click', () => {
      setMobileNavOpen(sidebarToggle.getAttribute('aria-expanded') !== 'true');
    });
    $('#admin-sidebar-close').addEventListener('click', () => setMobileNavOpen(false));
    sidebarBackdrop.addEventListener('click', () => setMobileNavOpen(false));
    document.addEventListener('keydown', (event) => {
      if (sidebarToggle.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sidebar.querySelectorAll('a[href], button:not([disabled])'));
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
    matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches && sidebarToggle.getAttribute('aria-expanded') === 'true') setMobileNavOpen(false);
    });
  }

  async function api(url, opts) {
    const r = await fetch(url, opts);
    if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('Sesi berakhir.'); }
    let d;
    try { d = await r.json(); }
    catch { throw new Error('Respons server tidak valid.'); }
    if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan.');
    if (opts && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(opts.method || 'GET').toUpperCase())) {
      setTimeout(() => loadActivity().catch((error) => console.error('Log aktivitas gagal dimuat:', error)), 150);
    }
    return d;
  }

  let toastTimer;
  function toast(msg, ok) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'fixed right-4 top-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ' +
      (ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
  }

  function today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function resetForm() {
    editingId = null;
    form.reset();
    $('#tanggal').value = today();
    $('#form-title').textContent = 'Tulis berita baru';
    $('#submit').textContent = 'Terbitkan';
    $('#cancel').classList.add('hidden');
    $('#gambar-lama').classList.add('hidden');
    $('#galeri-lama').classList.add('hidden');
    $('#galeri-lama-isi').innerHTML = '';
  }

  async function loadKategori() {
    const k = await api('/api/kategori');
    const options = '<option value="">Pilih kategori</option>' +
      k.map((x) => `<option>${esc(x)}</option>`).join('');
    $('#kategori').innerHTML = options;
    $('#dokumentasi-kategori').innerHTML = options;
  }

  async function loadList() {
    const d = await api('/api/berita?limit=10&page=' + page);
    $('#total').textContent = '(' + d.total + ')';
    $('#list').innerHTML = d.items.length ? d.items.map((b) => `
      <li class="flex items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-ink/10">
        ${b.gambar ? `<img src="${esc(b.gambar)}" alt="" class="h-16 w-16 rounded-lg object-cover">`
                   : '<div class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/15 font-bold text-primary-dark">B</div>'}
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-ink">${esc(b.judul)}</p>
          <p class="text-sm text-slate-500">${esc(b.kategori)} &middot; ${esc(b.tanggal)}</p>
        </div>
        <button data-edit="${esc(b.id)}" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent ring-1 ring-accent/40 hover:bg-accent hover:text-white">Edit</button>
        <button data-del="${esc(b.id)}" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-700 hover:text-white">Hapus</button>
      </li>`).join('') : '<li class="rounded-xl bg-white p-8 text-center text-slate-600">Belum ada berita. Tulis berita pertama di formulir.</li>';
    if (window.FX) window.FX.reveal($('#list').children);

    let h = '';
    for (let i = 1; i <= d.pages && d.pages > 1; i++) {
      h += `<button data-p="${i}" class="h-9 w-9 rounded-full text-sm font-semibold ${i === d.page ? 'bg-primary text-ink' : 'bg-white ring-1 ring-ink/15'}">${i}</button>`;
    }
    $('#pager').innerHTML = h;
  }

  async function loadModeration() {
    const filter = $('#komentar-status-filter').value;
    const [reports, comments] = await Promise.all([
      api('/api/admin/laporan-komentar'),
      api('/api/admin/komentar?status=' + encodeURIComponent(filter))
    ]);
    $('#laporan-list').innerHTML = reports.items.length ? reports.items.map((report) => `
      <li class="rounded-xl bg-white p-4 ring-1 ring-ink/10">
        <div class="flex flex-wrap justify-between gap-2">
          <p class="font-semibold text-ink">${esc(report.alasan)} <span class="text-sm font-normal ${report.status === 'baru' ? 'text-red-700' : 'text-slate-500'}">(${report.status === 'baru' ? 'Baru' : 'Ditinjau'})</span></p>
          <time class="text-xs text-slate-500">${esc(new Date(report.createdAt).toLocaleString('id-ID'))}</time>
        </div>
        <p class="mt-1 text-xs text-slate-500">${esc(report.judulBerita)}</p>
        <p class="mt-2 text-sm"><strong>${esc(report.namaKomentar)}:</strong> ${esc(report.isiKomentar)}</p>
        ${report.detail ? `<p class="mt-1 text-sm text-slate-600">Keterangan: ${esc(report.detail)}</p>` : ''}
        <div class="mt-3 flex flex-wrap gap-2">
          ${report.status === 'baru' ? `<button data-review-report="${esc(report.id)}" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary-dark ring-1 ring-primary-dark/30 hover:bg-primary/15">Tandai ditinjau</button>` : ''}
          <button data-delete-reported="${esc(report.commentId)}" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Hapus komentar</button>
          <button data-clear-report="${esc(report.id)}" class="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-ink/15 hover:bg-cream">Hapus laporan</button>
        </div>
      </li>`).join('') : '<li class="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-ink/10">Belum ada laporan.</li>';
    $('#komentar-admin-list').innerHTML = comments.items.length ? comments.items.map((comment) => `
      <li class="rounded-xl bg-white p-4 ring-1 ring-ink/10">
        <div class="flex flex-wrap justify-between gap-2">
          <p class="font-semibold text-ink">${esc(comment.nama)}${comment.parentId ? ' <span class="text-xs font-normal text-slate-500">(balasan)</span>' : ''}</p>
          <time class="text-xs text-slate-500">${esc(new Date(comment.createdAt).toLocaleString('id-ID'))}</time>
        </div>
        <p class="mt-1 text-xs text-slate-500">${esc(comment.judulBerita)}${comment.laporanBaru ? ` · <strong class="text-red-700">${comment.laporanBaru} laporan baru</strong>` : ''}</p>
        <p class="mt-2 whitespace-pre-wrap wrap-break-word text-sm text-slate-700">${esc(comment.isi)}</p>
        <p class="mt-2 text-xs font-semibold ${comment.status === 'pending' ? 'text-amber-700' : comment.status === 'approved' ? 'text-green-700' : 'text-red-700'}">Status: ${comment.status === 'pending' ? 'Menunggu persetujuan' : comment.status === 'approved' ? 'Ditampilkan' : 'Ditolak'}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          ${comment.status !== 'approved' ? `<button data-moderate="${esc(comment.id)}" data-status="approved" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-green-800 ring-1 ring-green-300 hover:bg-green-50">Setujui &amp; tampilkan</button>` : ''}
          ${comment.status !== 'rejected' ? `<button data-moderate="${esc(comment.id)}" data-status="rejected" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Tolak</button>` : ''}
          <button data-delete-comment="${esc(comment.id)}" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Hapus permanen</button>
        </div>
      </li>`).join('') : '<li class="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-ink/10">Belum ada komentar.</li>';
    if (window.FX) {
      window.FX.reveal($('#laporan-list').children);
      window.FX.reveal($('#komentar-admin-list').children);
    }
  }

  async function loadSiteSettings() {
    const settings = await api('/api/admin/site-settings');
    $('#setting-brand').value = settings.brandName;
    $('#setting-organization').value = settings.organizationName;
    $('#setting-district').value = settings.district;
    $('#setting-address').value = settings.address;
    $('#setting-phone').value = settings.phone;
    $('#setting-email').value = settings.email;
    $('#setting-hours').value = settings.serviceHours;
    $('#setting-announcement-enabled').checked = settings.announcementEnabled;
    $('#setting-announcement').value = settings.announcement;
    $('#setting-assistant-enabled').checked = settings.assistantEnabled;
    $('#setting-ai-status').textContent = settings.aiConfigured
      ? 'Kunci AI terpasang di server. Status asisten dapat diubah di sini.'
      : 'Kunci AI belum dikonfigurasi. Asisten hanya dapat menampilkan panduan lokal sampai pengelola server mengatur GROQ_API_KEY.';
  }

  async function loadActivity() {
    const status = $('#activity-status');
    status.textContent = 'Memuat log aktivitas.';
    const data = await api('/api/admin/aktivitas?limit=50');
    const list = $('#activity-list');
    list.innerHTML = data.items.length ? data.items.map((item) => `
      <tr>
        <td class="whitespace-nowrap px-4 py-3 text-xs text-slate-600">${esc(new Date(item.createdAt).toLocaleString('id-ID'))}</td>
        <td class="px-4 py-3">${esc(item.actor)}</td>
        <td class="px-4 py-3 font-semibold text-ink">${esc(item.action)}</td>
        <td class="max-w-xs wrap-break-word px-4 py-3 text-slate-600">${esc(item.detail || '-')}</td>
        <td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold ${item.outcome === 'berhasil' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${esc(item.outcome)}</span></td>
      </tr>`).join('') :
      '<tr><td colspan="5" class="px-4 py-5 text-center text-slate-500">Belum ada aktivitas admin.</td></tr>';
    status.textContent = `${data.items.length} aktivitas terbaru dimuat.`;
  }

  function renderTrafficChart(daily) {
    const root = $('#traffic-chart');
    const week = daily.slice(-7);
    if (!week.length) {
      root.innerHTML = '<p class="p-6 text-center text-sm text-slate-500">Belum ada data trafik.</p>';
      return;
    }

    const width = 720;
    const height = 250;
    const padding = { top: 18, right: 16, bottom: 42, left: 42 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(1, ...week.map((day) => Number(day.views)));
    const bandWidth = chartWidth / week.length;
    const barWidth = Math.min(42, bandWidth * .48);
    const baseline = padding.top + chartHeight;
    const grid = [0, .5, 1].map((fraction) => {
      const y = padding.top + chartHeight * (1 - fraction);
      const value = Math.round(maxValue * fraction);
      return `<g aria-hidden="true"><line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e4ebf2"/><text x="${padding.left - 9}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="10">${value}</text></g>`;
    }).join('');
    const bars = week.map((day, index) => {
      const value = Number(day.views) || 0;
      const visitors = Number(day.visitors) || 0;
      const barHeight = value ? Math.max(3, value / maxValue * chartHeight) : 0;
      const x = padding.left + bandWidth * index + (bandWidth - barWidth) / 2;
      const y = baseline - barHeight;
      const date = new Date(`${day.date}T00:00:00+07:00`);
      const dateLabel = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
      const detail = `${dateLabel}: ${value} tampilan halaman dan ${visitors} pengunjung unik`;
      const label = date.toLocaleDateString('id-ID', { weekday: 'short' });
      return `<g class="traffic-bar" tabindex="0" role="img" aria-label="${esc(detail)}" data-traffic-point="${esc(detail)}"><title>${esc(detail)}</title><rect x="${x}" y="${padding.top}" width="${barWidth}" height="${chartHeight}" rx="9" fill="#f1f5f9"/><rect class="traffic-bar-fill" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="9" fill="#1d4ed8"/><text x="${x + barWidth / 2}" y="${height - 17}" text-anchor="middle" fill="#64748b" font-size="11">${esc(label)}</text></g>`;
    });

    root.innerHTML = `<svg class="traffic-bar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Jumlah tampilan halaman selama tujuh hari terakhir">${grid}<line x1="${padding.left}" y1="${baseline}" x2="${width - padding.right}" y2="${baseline}" stroke="#dbe4ea"/>${bars.join('')}</svg>`;
    root.querySelectorAll('[data-traffic-point]').forEach((bar) => {
      const showDetail = () => { $('#traffic-chart-detail').textContent = bar.dataset.trafficPoint; };
      bar.addEventListener('mouseenter', showDetail);
      bar.addEventListener('focus', showDetail);
    });
  }

  function renderTrafficPages(topPages) {
    const colors = ['#0d9488', '#8b5cf6', '#f97316', '#84cc16', '#6366f1'];
    const pageNames = {
      '/': 'Beranda',
      '/berita.html': 'Berita',
      '/berita-detail.html': 'Detail berita',
      '/aspirasi.html': 'Aspirasi',
      '/kebijakan.html': 'Kebijakan & privasi'
    };
    const pages = topPages.map((item, index) => ({
      name: pageNames[item.path] || item.path,
      views: Number(item.views) || 0,
      color: colors[index % colors.length]
    }));
    const total = pages.reduce((sum, item) => sum + item.views, 0);
    const chart = $('#traffic-category-chart');
    $('#traffic-top-page-name').textContent = pages[0] ? pages[0].name : 'Belum ada data';
    $('#traffic-top-page-views').textContent = pages[0]
      ? `${pages[0].views.toLocaleString('id-ID')} tampilan pada rentang terpilih`
      : 'Belum ada kunjungan';
    $('#traffic-donut-total').textContent = total.toLocaleString('id-ID');
    chart.setAttribute('aria-label', `Diagram kunjungan per halaman, total ${total} tampilan`);

    let progress = 0;
    const gradient = pages.filter((item) => item.views > 0).map((item) => {
      const start = progress;
      progress += item.views / total * 100;
      return `${item.color} ${start.toFixed(2)}% ${progress.toFixed(2)}%`;
    });
    chart.style.background = total
      ? `conic-gradient(${gradient.join(', ')})`
      : 'conic-gradient(#e2e8f0 0% 100%)';
    $('#traffic-top-pages').innerHTML = pages.length ? pages.map((item) => `
      <li class="traffic-page-legend-item">
        <span class="traffic-page-legend-label"><span class="traffic-page-dot" style="--traffic-page-color:${item.color}" aria-hidden="true"></span><span class="truncate">${esc(item.name)}</span></span>
        <strong>${item.views.toLocaleString('id-ID')}</strong>
      </li>`).join('') :
      '<li class="traffic-page-legend-empty">Belum ada kunjungan pada rentang ini.</li>';
  }

  async function loadTraffic() {
    const status = $('#traffic-status');
    status.textContent = 'Memuat ringkasan trafik.';
    const result = await api('/api/admin/traffic?days=' + trafficDays);
    const today = new Date(`${result.overview.local_date}T00:00:00+07:00`);
    const dateLabel = today.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    $('#traffic-period-label').textContent = `${dateLabel} · Bakesbangpol Ponorogo · Ringkasan ${trafficDays} hari terakhir`;
    $('#traffic-chart-subtitle').textContent = 'Tujuh hari terakhir · tampilan halaman';
    $('#traffic-month-label').textContent = `Tampilan ${today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
    $('#traffic-visitors-today').textContent = Number(result.overview.today_visitors).toLocaleString('id-ID');
    const visitorChange = Number(result.overview.today_visitors) - Number(result.overview.yesterday_visitors);
    const changeLabel = visitorChange === 0
      ? 'Sama dengan kemarin'
      : `${visitorChange > 0 ? '+' : '−'}${Math.abs(visitorChange).toLocaleString('id-ID')} dari kemarin`;
    $('#traffic-today-change').textContent = changeLabel;
    $('#traffic-month-views').textContent = Number(result.overview.month_views).toLocaleString('id-ID');
    $('#traffic-views-total').textContent = Number(result.totals.views).toLocaleString('id-ID');
    renderTrafficChart(result.daily);
    renderTrafficPages(result.topPages);
    status.textContent = `Analitik ${trafficDays} hari dimuat.`;
  }

  function clearStructurePhotoPreview() {
    if (structurePreviewUrl) URL.revokeObjectURL(structurePreviewUrl);
    structurePreviewUrl = '';
    $('#struktur-photo-new-preview').classList.add('hidden');
    $('#struktur-photo-new-preview').classList.remove('flex');
    $('#struktur-photo-new-image').removeAttribute('src');
    $('#struktur-photo-new-label').textContent = '';
  }

  function resetStructureForm() {
    structureEditingId = null;
    structureForm.reset();
    clearStructurePhotoPreview();
    $('#struktur-form-kicker').textContent = 'Anggota baru';
    $('#struktur-form-title').textContent = 'Tambah anggota';
    $('#struktur-submit').textContent = 'Simpan anggota';
    $('#struktur-cancel').classList.add('hidden');
    $('#struktur-photo-current').classList.add('hidden');
    $('#struktur-photo-preview').removeAttribute('src');
    $('#struktur-feedback').textContent = '';
    $('#struktur-feedback').className = 'mt-3 text-sm';
  }

  function renderStructure() {
    const root = $('#struktur-admin-list');
    if (!structureData || !Array.isArray(structureData.sections) || !Array.isArray(structureData.members)) {
      root.innerHTML = '<p class="rounded-2xl bg-white p-6 text-sm text-red-700 ring-1 ring-ink/10">Data struktur organisasi tidak valid.</p>';
      return;
    }
    $('#struktur-admin-total').textContent = `${structureData.members.length} anggota · ${structureData.sections.length} bagian`;
    $('#struktur-section').innerHTML = structureData.sections.map((section) =>
      `<option value="${esc(section.id)}">${esc(section.title)}</option>`
    ).join('');
    root.innerHTML = structureData.sections.map((section) => {
      const members = structureData.members.filter((person) => person.sectionId === section.id)
        .sort((a, b) => a.order - b.order);
      return `<section class="admin-card overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/10">
        <header class="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 bg-linear-to-r from-white to-sky-50/80 px-4 py-4 sm:px-5">
          <div class="min-w-0">
            <h3 class="font-bold leading-snug text-ink">${esc(section.title)}</h3>
            <p class="mt-1 text-xs leading-relaxed text-slate-500">${esc(section.description)}</p>
          </div>
          <span class="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary-dark">${members.length} orang</span>
        </header>
        <ul class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">${members.map((person) => `
          <li class="flex min-w-0 items-center gap-3 rounded-xl border border-ink/10 bg-white p-3 transition hover:border-primary/40 hover:shadow-sm">
            ${person.photo
              ? `<img src="${esc(person.photo)}" alt="" class="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-ink/10">`
              : `<span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary-dark">${esc(person.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase())}</span>`}
            <div class="min-w-0 flex-1">
              <p class="line-clamp-2 text-sm font-bold leading-snug text-ink">${esc(person.name)}</p>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">${esc(person.position)}</p>
            </div>
            <div class="flex shrink-0 flex-col gap-1.5">
              <button type="button" data-edit-structure="${esc(person.id)}" class="rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary-dark ring-1 ring-primary-dark/25 hover:bg-primary/15">Edit</button>
              <button type="button" data-delete-structure="${esc(person.id)}" aria-label="Hapus ${esc(person.name)}" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">Hapus</button>
            </div>
          </li>`).join('') || '<li class="rounded-xl bg-cream p-4 text-sm text-slate-500 sm:col-span-2">Belum ada anggota pada bagian ini.</li>'}</ul>
      </section>`;
    }).join('');
    if (window.FX) window.FX.reveal(root.children);
  }

  async function loadStructure() {
    structureData = await api('/api/admin/struktur');
    renderStructure();
  }

  function editStructureMember(member) {
    if (!member) return;
    structureEditingId = member.id;
    structureForm.reset();
    clearStructurePhotoPreview();
    $('#struktur-name').value = member.name;
    $('#struktur-position').value = member.position;
    $('#struktur-section').value = member.sectionId;
    $('#struktur-form-kicker').textContent = 'Perbarui data anggota';
    $('#struktur-form-title').textContent = 'Edit anggota';
    $('#struktur-submit').textContent = 'Simpan perubahan';
    $('#struktur-cancel').classList.remove('hidden');
    $('#struktur-feedback').textContent = '';
    $('#struktur-photo-current').classList.toggle('hidden', !member.photo);
    if (member.photo) $('#struktur-photo-preview').src = member.photo;
    structureForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#struktur-name').focus({ preventScroll: true });
  }

  structurePhotoInput.addEventListener('change', () => {
    clearStructurePhotoPreview();
    const file = structurePhotoInput.files && structurePhotoInput.files[0];
    if (!file) return;
    const feedback = $('#struktur-feedback');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      structurePhotoInput.value = '';
      feedback.textContent = file.size > 3 * 1024 * 1024
        ? 'Ukuran foto maksimal 3 MB.'
        : 'Foto harus berformat JPG, PNG, atau WebP.';
      feedback.className = 'mt-3 text-sm font-semibold text-red-700';
      return;
    }
    structurePreviewUrl = URL.createObjectURL(file);
    $('#struktur-photo-new-image').src = structurePreviewUrl;
    $('#struktur-photo-new-label').textContent = file.name;
    $('#struktur-photo-new-preview').classList.remove('hidden');
    $('#struktur-photo-new-preview').classList.add('flex');
    $('#struktur-remove-photo').checked = false;
    feedback.textContent = '';
  });

  $('#struktur-remove-photo').addEventListener('change', (event) => {
    if (event.target.checked && structurePhotoInput.files.length) {
      structurePhotoInput.value = '';
      clearStructurePhotoPreview();
    }
  });

  structureForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#struktur-submit');
    const feedback = $('#struktur-feedback');
    if (structurePhotoInput.files.length && $('#struktur-remove-photo').checked) {
      feedback.textContent = 'Pilih foto baru atau hapus foto lama, bukan keduanya.';
      feedback.className = 'mt-3 text-sm font-semibold text-red-700';
      return;
    }
    button.disabled = true;
    feedback.textContent = 'Menyimpan data anggota...';
    feedback.className = 'mt-3 text-sm text-slate-600';
    try {
      const endpoint = structureEditingId
        ? '/api/admin/struktur/' + encodeURIComponent(structureEditingId)
        : '/api/admin/struktur';
      await api(endpoint, {
        method: structureEditingId ? 'PUT' : 'POST',
        body: new FormData(structureForm)
      });
      toast(structureEditingId ? 'Data anggota diperbarui.' : 'Anggota ditambahkan.', true);
      resetStructureForm();
      await loadStructure();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.className = 'mt-3 text-sm font-semibold text-red-700';
    } finally {
      button.disabled = false;
    }
  });

  $('#struktur-cancel').addEventListener('click', resetStructureForm);
  $('#struktur-admin-list').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-structure]');
    const remove = event.target.closest('[data-delete-structure]');
    if (edit) {
      editStructureMember(structureData.members.find((member) => member.id === edit.dataset.editStructure));
      return;
    }
    if (!remove || !confirm('Hapus anggota ini dari struktur organisasi?')) return;
    remove.disabled = true;
    try {
      await api('/api/admin/struktur/' + encodeURIComponent(remove.dataset.deleteStructure), { method: 'DELETE' });
      toast('Anggota dihapus dari struktur organisasi.', true);
      if (structureEditingId === remove.dataset.deleteStructure) resetStructureForm();
      await loadStructure();
    } catch (error) {
      remove.disabled = false;
      toast(error.message, false);
    }
  });

  async function loadDocumentation() {
    const data = await api('/api/admin/dokumentasi');
    $('#dokumentasi-total').textContent = '(' + data.total + ')';
    $('#dokumentasi-admin-list').innerHTML = data.items.length ? data.items.map((item) => `
      <li class="flex min-w-0 items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-ink/10">
        <span class="relative shrink-0">
          <img src="${esc(item.gambar)}" alt="" class="h-16 w-16 rounded-lg object-cover">
          ${(1 + (item.galeri || []).length) > 1 ? `<span class="absolute -right-1 -top-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">${1 + (item.galeri || []).length} foto</span>` : ''}
        </span>
        <div class="min-w-0 flex-1">
          <p class="line-clamp-2 text-sm font-semibold text-ink">${esc(item.judul)}</p>
          <p class="mt-1 text-xs text-slate-500">${esc(item.kategori)} · ${esc(item.tanggal)}</p>
        </div>
        <button type="button" data-delete-documentation="${esc(item.id)}" aria-label="Hapus dokumentasi: ${esc(item.judul)}" class="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Hapus</button>
      </li>`).join('') :
      '<li class="rounded-xl bg-white p-5 text-sm text-slate-500 ring-1 ring-ink/10 sm:col-span-2">Belum ada foto dokumentasi.</li>';
    if (window.FX) window.FX.reveal($('#dokumentasi-admin-list').children);
  }

  function clearDocumentationPreview() {
    documentationPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    documentationPreviewUrls = [];
    const preview = $('#dokumentasi-preview');
    preview.replaceChildren();
    preview.classList.remove('grid');
    preview.classList.add('hidden');
  }

  documentationInput.addEventListener('change', () => {
    clearDocumentationPreview();
    const files = Array.from(documentationInput.files || []);
    const feedback = $('#dokumentasi-feedback');
    if (files.length > 10) {
      feedback.textContent = 'Pilih maksimal 10 foto dalam satu postingan.';
      feedback.className = 'text-sm font-semibold text-red-700';
      return;
    }
    if (!files.length) return;
    const preview = $('#dokumentasi-preview');
    preview.innerHTML = files.map((file, index) => {
      const url = URL.createObjectURL(file);
      documentationPreviewUrls.push(url);
      return `
        <span class="relative block aspect-square overflow-hidden rounded-lg bg-cream">
          <img src="${url}" alt="Pratinjau foto ${index + 1}" class="h-full w-full object-cover">
          ${index === 0 ? '<span class="absolute bottom-1 left-1 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">Sampul</span>' : ''}
        </span>`;
    }).join('');
    preview.classList.add('grid');
    preview.classList.remove('hidden');
    feedback.textContent = `${files.length} foto dipilih.`;
    feedback.className = 'text-sm text-slate-600';
  });

  documentationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#dokumentasi-submit');
    const feedback = $('#dokumentasi-feedback');
    if (!documentationInput.files || !documentationInput.files.length || documentationInput.files.length > 10) {
      feedback.textContent = 'Pilih antara 1 sampai 10 foto untuk diposting.';
      feedback.className = 'text-sm font-semibold text-red-700';
      return;
    }
    let saved = false;
    button.disabled = true;
    feedback.textContent = 'Mengunggah...';
    feedback.className = 'text-sm text-slate-600';
    try {
      await api('/api/admin/dokumentasi', {
        method: 'POST',
        body: new FormData(documentationForm)
      });
      saved = true;
      documentationForm.reset();
      clearDocumentationPreview();
      $('#dokumentasi-tanggal').value = today();
      feedback.textContent = 'Postingan dokumentasi berhasil diterbitkan.';
      feedback.className = 'text-sm font-semibold text-green-800';
    } catch (error) {
      feedback.textContent = error.message;
      feedback.className = 'text-sm font-semibold text-red-700';
    } finally {
      button.disabled = false;
    }
    if (saved) loadDocumentation().catch((error) => toast(error.message, false));
  });

  $('#dokumentasi-admin-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-documentation]');
    if (!button || !confirm('Hapus foto dokumentasi ini?')) return;
    button.disabled = true;
    try {
      await api('/api/admin/dokumentasi/' + encodeURIComponent(button.dataset.deleteDocumentation), { method: 'DELETE' });
      toast('Dokumentasi dihapus.', true);
      loadDocumentation().catch((error) => toast(error.message, false));
    } catch (error) {
      button.disabled = false;
      toast(error.message, false);
    }
  });

  $('#site-settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#save-site-settings');
    const feedback = $('#site-settings-feedback');
    button.disabled = true;
    feedback.textContent = 'Menyimpan...';
    feedback.className = 'text-sm text-slate-600';
    const settings = {
      brandName: $('#setting-brand').value,
      organizationName: $('#setting-organization').value,
      district: $('#setting-district').value,
      address: $('#setting-address').value,
      phone: $('#setting-phone').value,
      email: $('#setting-email').value,
      serviceHours: $('#setting-hours').value,
      announcementEnabled: $('#setting-announcement-enabled').checked,
      announcement: $('#setting-announcement').value,
      assistantEnabled: $('#setting-assistant-enabled').checked
    };
    try {
      await api('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      feedback.textContent = 'Pengaturan berhasil disimpan dan sudah diterapkan.';
      feedback.className = 'text-sm font-semibold text-green-800';
    } catch (error) {
      feedback.textContent = error.message;
      feedback.className = 'text-sm font-semibold text-red-700';
    } finally {
      button.disabled = false;
    }
  });

  async function moderateComment(id, status) {
    if (status === 'rejected' && !confirm('Tolak komentar ini beserta semua balasannya?')) return;
    await api('/api/admin/komentar/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    toast(status === 'approved' ? 'Komentar disetujui dan ditampilkan.' : 'Komentar beserta balasannya ditolak.', true);
    await loadModeration();
  }

  async function deleteComment(id) {
    if (!confirm('Hapus komentar ini beserta semua balasannya?')) return;
    await api('/api/admin/komentar/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Komentar dan balasannya dihapus.', true);
    await loadModeration();
  }

  $('#laporan-list').addEventListener('click', async (e) => {
    const review = e.target.closest('[data-review-report]');
    const clear = e.target.closest('[data-clear-report]');
    const remove = e.target.closest('[data-delete-reported]');
    try {
      if (review) {
        await api('/api/admin/laporan-komentar/' + encodeURIComponent(review.dataset.reviewReport), { method: 'PATCH' });
        toast('Laporan ditandai sudah ditinjau.', true);
        await loadModeration();
      } else if (clear) {
        await api('/api/admin/laporan-komentar/' + encodeURIComponent(clear.dataset.clearReport), { method: 'DELETE' });
        toast('Laporan dihapus.', true);
        await loadModeration();
      } else if (remove) {
        await deleteComment(remove.dataset.deleteReported);
      }
    } catch (err) { toast(err.message, false); }
  });

  $('#komentar-admin-list').addEventListener('click', async (e) => {
    const moderate = e.target.closest('[data-moderate]');
    const remove = e.target.closest('[data-delete-comment]');
    if (!moderate && !remove) return;
    try {
      if (moderate) await moderateComment(moderate.dataset.moderate, moderate.dataset.status);
      else await deleteComment(remove.dataset.deleteComment);
    }
    catch (err) { toast(err.message, false); }
  });
  $('#komentar-status-filter').addEventListener('change', () => {
    loadModeration().catch((err) => toast(err.message, false));
  });
  $('#refresh-activity').addEventListener('click', () => {
    loadActivity().catch((err) => {
      $('#activity-status').textContent = 'Log aktivitas gagal dimuat.';
      $('#activity-list').innerHTML = '<tr><td colspan="5" class="px-4 py-5 text-center text-red-700">Log aktivitas gagal dimuat. Silakan coba lagi.</td></tr>';
      toast(err.message, false);
    });
  });
  $('#refresh-traffic').addEventListener('click', () => {
    loadTraffic().catch((error) => {
      $('#traffic-status').textContent = 'Analitik trafik gagal dimuat.';
      $('#traffic-chart').innerHTML = '<p class="p-6 text-center text-sm text-red-700">Data trafik gagal dimuat. Silakan coba lagi.</p>';
      toast(error.message, false);
    });
  });
  document.querySelectorAll('[data-traffic-days]').forEach((button) => {
    button.addEventListener('click', () => {
      trafficDays = Number(button.dataset.trafficDays);
      document.querySelectorAll('[data-traffic-days]').forEach((item) => {
        const selected = item === button;
        item.setAttribute('aria-pressed', String(selected));
        item.className = selected
          ? 'rounded-lg bg-white px-3 py-2 text-xs font-semibold text-primary-dark shadow-sm'
          : 'rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white';
      });
      loadTraffic().catch((error) => {
        $('#traffic-status').textContent = 'Analitik trafik gagal dimuat.';
        toast(error.message, false);
      });
    });
  });

  $('#list').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    try {
      if (ed) {
        const b = await api('/api/berita/' + encodeURIComponent(ed.dataset.edit));
        editingId = b.id;
        form.reset();
        $('#judul').value = b.judul;
        $('#kategori').value = b.kategori;
        $('#tanggal').value = b.tanggal;
        $('#isi').value = b.isi;
        $('#gambar-lama').classList.toggle('hidden', !b.gambar);
        if (b.gambar) $('#gambar-preview').src = b.gambar;
        
        const gal = b.galeri || [];
        $('#galeri-lama').classList.toggle('hidden', !gal.length);
        $('#galeri-lama-isi').innerHTML = gal.map((src) => `
          <label class="block text-sm">
            <img src="${esc(src)}" alt="" class="h-20 w-full rounded-lg object-cover">
            <span class="mt-1 flex items-center gap-1"><input type="checkbox" name="hapus_galeri" value="${esc(src)}"> Hapus</span>
          </label>`).join('');
        $('#form-title').textContent = 'Edit berita';
        $('#submit').textContent = 'Simpan perubahan';
        $('#cancel').classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (del) {
        if (!confirm('Hapus berita ini? Tindakan ini tidak bisa dibatalkan.')) return;
        await api('/api/berita/' + encodeURIComponent(del.dataset.del), { method: 'DELETE' });
        if (editingId === del.dataset.del) resetForm();
        toast('Berita dihapus.', true);
        await loadList();
      }
    } catch (err) { toast(err.message, false); }
  });

  $('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (b) { page = +b.dataset.p; loadList(); }
  });

  $('#cancel').addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submit');
    btn.disabled = true;
    try {
      const url = editingId ? '/api/berita/' + encodeURIComponent(editingId) : '/api/berita';
      await api(url, { method: editingId ? 'PUT' : 'POST', body: new FormData(form) });
      toast(editingId ? 'Perubahan disimpan.' : 'Berita diterbitkan.', true);
      resetForm();
      page = 1;
      await loadList();
    } catch (err) { toast(err.message, false); }
    btn.disabled = false;
  });

  $('#logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/admin/login.html';
  });

  (async function init() {
    try {
      await api('/api/admin/me');
      resetForm();
      await loadKategori();
      await loadList();
      await loadModeration();
      await loadSiteSettings();
      resetStructureForm();
      await loadStructure();
      $('#dokumentasi-tanggal').value = today();
      await loadDocumentation();
      await loadTraffic();
      await loadActivity().catch((error) => {
        $('#activity-status').textContent = 'Log aktivitas tidak tersedia.';
        $('#activity-list').innerHTML = '<tr><td colspan="5" class="px-4 py-5 text-center text-red-700">Log aktivitas tidak dapat dimuat. Periksa pembaruan server dan migrasi database.</td></tr>';
        console.error('Log aktivitas gagal dimuat:', error);
      });
      setInterval(() => {
        if (document.hidden) return;
        loadActivity().catch((error) => console.error('Log aktivitas gagal dimuat:', error));
        loadTraffic().catch((error) => console.error('Analitik trafik gagal dimuat:', error));
      }, 60000);
    } catch (e) {
      if (!location.pathname.endsWith('/login.html')) toast(e.message, false);
    }
  })();
})();
