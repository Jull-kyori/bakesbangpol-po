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
    const d = await r.json().catch(() => ({}));
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
    } catch (e) { /* sudah dialihkan ke halaman login */ }
  })();
})();
