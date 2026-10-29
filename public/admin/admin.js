(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const form = $('#form');
  let editingId = null;
  let page = 1;

  async function api(url, opts) {
    const r = await fetch(url, opts);
    if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('Sesi berakhir.'); }
    let d;
    try { d = await r.json(); }
    catch { throw new Error('Respons server tidak valid.'); }
    if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan.');
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
    $('#kategori').innerHTML = '<option value="">Pilih kategori</option>' +
      k.map((x) => `<option>${esc(x)}</option>`).join('');
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
        <p class="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">${esc(comment.isi)}</p>
        <p class="mt-2 text-xs font-semibold ${comment.status === 'pending' ? 'text-amber-700' : comment.status === 'approved' ? 'text-green-700' : 'text-red-700'}">Status: ${comment.status === 'pending' ? 'Menunggu persetujuan' : comment.status === 'approved' ? 'Ditampilkan' : 'Ditolak'}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          ${comment.status !== 'approved' ? `<button data-moderate="${esc(comment.id)}" data-status="approved" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-green-800 ring-1 ring-green-300 hover:bg-green-50">Setujui &amp; tampilkan</button>` : ''}
          ${comment.status !== 'rejected' ? `<button data-moderate="${esc(comment.id)}" data-status="rejected" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Tolak</button>` : ''}
          <button data-delete-comment="${esc(comment.id)}" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50">Hapus permanen</button>
        </div>
      </li>`).join('') : '<li class="rounded-xl bg-white p-4 text-sm text-slate-500 ring-1 ring-ink/10">Belum ada komentar.</li>';
  }

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
    } catch (e) {
      if (!location.pathname.endsWith('/login.html')) toast(e.message, false);
    }
  })();
})();
