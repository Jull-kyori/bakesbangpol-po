/* Dashboard E-IDI: tampilkan data dari /api/idi, kelola indikator jika sudah login admin. */
(function () {
  const { esc } = window.BK;
  const $ = (s) => document.querySelector(s);
  let DATA = { aspek: [], tren: [], indikator: [] };
  let isAdmin = false;
  let editingId = null;

  // Kategori skor (sama dengan dashboard asli: >= 80 Baik, < 60 Kurang, selain itu Sedang)
  function kategori(s) {
    if (s >= 80) return { t: 'Baik', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', txt: 'text-emerald-600', bar: 'bg-amber-600', pill: 'bg-emerald-50 text-emerald-600' };
    if (s < 60) return { t: 'Kurang', badge: 'bg-red-100 text-red-800 border-red-300', txt: 'text-red-600', bar: 'bg-red-500', pill: 'bg-red-50 text-red-600' };
    return { t: 'Sedang', badge: 'bg-amber-100 text-amber-800 border-amber-300', txt: 'text-orange-600', bar: 'bg-orange-500', pill: 'bg-orange-50 text-orange-600' };
  }

  // ---- Toast ----
  let toastTimer;
  function toast(judul, isi) {
    const t = $('#toast');
    $('#toastJudul').textContent = judul;
    $('#toastIsi').textContent = isi || '';
    t.classList.remove('translate-y-24', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('translate-y-24', 'opacity-0'), 3500);
  }

  async function api(url, opts) {
    const r = await fetch(url, opts);
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { isAdmin = false; applyRole(); throw new Error('Sesi admin berakhir. Masuk lagi di /admin/.'); }
    if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan.');
    return d;
  }

  // ---- Ringkasan, kartu, grafik ----
  function renderSummary() {
    $('#tahunAnggaran').textContent = DATA.tahun ? 'Tahun Anggaran ' + DATA.tahun : '';
    if (typeof DATA.skorTotal === 'number') {
      const k = kategori(DATA.skorTotal);
      $('#skorTotal').textContent = DATA.skorTotal.toFixed(2) + '%';
      const el = $('#kategoriTotal');
      el.textContent = 'Kategori: ' + k.t;
      el.className = 'mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold ' + k.pill;
    }
    $('#kartuAspek').innerHTML = DATA.aspek.map((a) => {
      const k = kategori(a.skor);
      return `<div class="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
        <div>
          <div class="mb-3 flex items-start justify-between">
            <span class="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">${esc(a.romawi)}</span>
            <div class="rounded-xl bg-amber-50 p-2 text-amber-600"><i class="fa-solid ${esc(a.ikon)} text-lg"></i></div>
          </div>
          <h3 class="text-base font-bold">${esc(a.judul)}</h3>
          <p class="mt-1 text-xs text-amber-900/70">${esc(a.deskripsi)}</p>
        </div>
        <div class="mt-5 flex items-end justify-between border-t border-amber-100 pt-4">
          <div><span class="text-2xl font-black">${Number(a.skor).toFixed(2)}%</span><span class="ml-2 text-xs font-bold ${k.txt}">${k.t}</span></div>
          <div class="h-2 w-24 rounded-full bg-amber-100"><div class="h-2 rounded-full ${k.bar}" style="width:${Math.min(100, Math.max(0, a.skor))}%"></div></div>
        </div>
      </div>`;
    }).join('');

    if (DATA.tren.length) {
      $('#trenJudul').textContent = `Tren Perkembangan IDI (${DATA.tren[0].tahun} - ${DATA.tren[DATA.tren.length - 1].tahun})`;
    }
    const badge = $('#trenBadge');
    if (DATA.sumberTren) { badge.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> ' + esc(DATA.sumberTren); }
    else { badge.remove(); }
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return; // pustaka grafik gagal dimuat
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = '#3b1d05';
    const serif = { family: 'Bitter, Georgia, serif' };

    new Chart($('#radarChart'), {
      type: 'radar',
      data: {
        labels: DATA.aspek.map((a) => a.singkat || a.judul),
        datasets: [{
          data: DATA.aspek.map((a) => a.skor),
          backgroundColor: 'rgba(245, 158, 11, 0.25)', borderColor: '#b45309', borderWidth: 2.5,
          pointBackgroundColor: '#b45309', pointBorderColor: '#fff', pointRadius: 5, pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 50, max: 100, ticks: { stepSize: 10, display: false }, grid: { color: '#fde68a' }, angleLines: { color: '#fde68a' }, pointLabels: { font: { ...serif, size: 11, weight: '700' } } } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#3b1d05', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (c) => ' Skor Capaian: ' + c.parsed.r + '%' } } }
      }
    });

    new Chart($('#lineChart'), {
      type: 'line',
      data: {
        labels: DATA.tren.map((t) => String(t.tahun)),
        datasets: [{
          data: DATA.tren.map((t) => t.nilai),
          borderColor: '#b45309', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 3, fill: true,
          pointBackgroundColor: '#b45309', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7, tension: 0.2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { min: 60, max: 100, ticks: { stepSize: 10, font: { size: 10 } }, grid: { color: '#fef3c7' }, border: { display: false } }, x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#3b1d05', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (c) => ' IDI: ' + c.parsed.y + '%' } } }
      }
    });
  }

  // ---- Tabel ----
  function renderTable() {
    const aspek = $('#filterAspek').value;
    const q = $('#searchInput').value.trim().toLowerCase();
    const rows = DATA.indikator
      .filter((r) => (aspek === 'all' || r.aspek === aspek) && (r.indikator + ' ' + r.catatan).toLowerCase().includes(q))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    $('#tabelKosong').classList.toggle('hidden', rows.length > 0);
    $('#indicatorTableBody').innerHTML = rows.map((r) => {
      const k = kategori(r.skor);
      const dok = r.dokumen
        ? `<a href="${esc(r.dokumen)}" target="_blank" rel="noopener" class="flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950"><i class="fa-regular ${/\.pdf$/i.test(r.dokumen) ? 'fa-file-pdf text-red-600' : 'fa-file-image text-amber-700'} text-sm"></i> ${esc(r.dokumenNama || 'Lihat dokumen')}</a>`
        : '<span class="text-xs text-amber-900/50">Belum ada dokumen</span>';
      const aksi = isAdmin
        ? `<td class="whitespace-nowrap px-6 py-4 text-center align-top">
             <button type="button" data-edit="${esc(r.id)}" class="mx-1 p-1 text-amber-700 hover:text-amber-900" title="Edit" aria-label="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
             <button type="button" data-del="${esc(r.id)}" class="mx-1 p-1 text-red-600 hover:text-red-800" title="Hapus" aria-label="Hapus"><i class="fa-solid fa-trash-can"></i></button>
           </td>` : '';
      return `<tr class="transition-colors hover:bg-amber-50/50">
        <td class="px-6 py-4 align-top font-semibold">${esc(r.aspek)}</td>
        <td class="px-6 py-4 align-top"><span class="font-bold">${esc(r.indikator)}</span><p class="mt-1 text-[11px] text-amber-900/70">${esc(r.catatan || 'Tidak ada catatan tambahan.')}</p></td>
        <td class="px-6 py-4 text-center align-top"><span class="text-base font-black">${Number(r.skor).toFixed(2)}</span></td>
        <td class="px-6 py-4 text-center align-top"><span class="inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold ${k.badge}">${k.t}</span></td>
        <td class="px-6 py-4 align-top">${dok}</td>${aksi}
      </tr>`;
    }).join('');
  }

  function applyRole() {
    $('#adminSection').classList.toggle('hidden', !isAdmin);
    $('#thAksi').classList.toggle('hidden', !isAdmin);
    const b = $('#roleBadge');
    b.textContent = isAdmin ? 'Akses Admin Aktif' : 'Akses Publik';
    b.className = isAdmin ? 'rounded-full bg-amber-800 px-2.5 py-1 font-bold text-amber-100' : 'rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800';
    renderTable();
  }

  async function loadData() {
    DATA = await fetch('/api/idi').then((r) => r.json());
  }

  // ---- Form admin ----
  const form = $('#idiForm');
  function resetEdit() {
    editingId = null;
    form.reset();
    $('#formJudul').textContent = 'Form Pengisian dan Update Indikator IDI';
    $('#btnSimpan span').textContent = 'Simpan dan Perbarui Data';
    $('#btnBatal').classList.add('hidden');
    $('#hapusDokWrap').classList.add('hidden');
    $('#hapusDokWrap').classList.remove('flex');
  }

  $('#indicatorTableBody').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-del]');
    if (ed) {
      const r = DATA.indikator.find((x) => x.id === ed.dataset.edit);
      if (!r) return;
      editingId = r.id;
      form.reset();
      $('#formAspek').value = r.aspek;
      $('#formIndikator').value = r.indikator;
      $('#formSkor').value = r.skor;
      $('#formCatatan').value = r.catatan || '';
      $('#formJudul').textContent = 'Edit Indikator: ' + r.indikator;
      $('#btnSimpan span').textContent = 'Simpan Perubahan';
      $('#btnBatal').classList.remove('hidden');
      const wrap = $('#hapusDokWrap');
      wrap.classList.toggle('hidden', !r.dokumen);
      wrap.classList.toggle('flex', !!r.dokumen);
      $('#adminSection').scrollIntoView({ behavior: 'smooth' });
    } else if (del) {
      const r = DATA.indikator.find((x) => x.id === del.dataset.del);
      if (!r || !confirm('Hapus indikator "' + r.indikator + '"? Tindakan ini tidak bisa dibatalkan.')) return;
      try {
        await api('/api/idi/indikator/' + encodeURIComponent(r.id), { method: 'DELETE' });
        if (editingId === r.id) resetEdit();
        await loadData(); renderTable();
        toast('Data dihapus', 'Indikator dihapus dari tabel rekapitulasi.');
      } catch (err) { toast('Gagal menghapus', err.message); }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btnSimpan');
    btn.disabled = true;
    try {
      const url = editingId ? '/api/idi/indikator/' + encodeURIComponent(editingId) : '/api/idi/indikator';
      const hasil = await api(url, { method: editingId ? 'PUT' : 'POST', body: new FormData(form) });
      toast(editingId ? 'Perubahan disimpan' : 'Indikator disimpan', `"${hasil.indikator}" dengan skor ${hasil.skor}.`);
      resetEdit();
      await loadData(); renderTable();
    } catch (err) { toast('Gagal menyimpan', err.message); }
    btn.disabled = false;
  });
  $('#btnBatal').addEventListener('click', resetEdit);
  $('#btnReset').addEventListener('click', () => setTimeout(resetEdit, 0));

  // ---- Filter, cetak, modal S&K ----
  $('#filterAspek').addEventListener('change', renderTable);
  $('#searchInput').addEventListener('input', renderTable);
  $('#btnPrint').addEventListener('click', () => window.print());

  const modal = $('#skModal');
  const bukaSk = () => { modal.classList.remove('hidden'); modal.classList.add('flex'); };
  const tutupSk = () => { modal.classList.add('hidden'); modal.classList.remove('flex'); };
  $('#btnSk').addEventListener('click', bukaSk);
  $('#skTutup').addEventListener('click', tutupSk);
  modal.addEventListener('click', (e) => { if (e.target === modal) tutupSk(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') tutupSk(); });
  $('#skSetuju').addEventListener('click', () => { $('#termsCheck').checked = true; tutupSk(); toast('Ketentuan disetujui', 'Anda menyetujui syarat dan ketentuan pengisian data.'); });

  // ---- Mulai ----
  (async function init() {
    try {
      const [, sess] = await Promise.all([loadData(), fetch('/api/session').then((r) => r.json()).catch(() => ({}))]);
      isAdmin = !!sess.admin;
      renderSummary();
      renderCharts();
      applyRole();
    } catch (e) {
      $('#tabelKosong').textContent = 'Data IDI belum bisa dimuat. Muat ulang halaman ini beberapa saat lagi.';
      $('#tabelKosong').classList.remove('hidden');
    }
  })();
})();
