(function () {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const form = $('#idiForm');
  let data = { indikator: [] };
  let editingId = null;
  let toastTimer;

  function toast(message, success) {
    const element = $('#toast');
    element.textContent = message;
    element.className = 'fixed right-4 top-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ' +
      (success ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.add('hidden'), 4500);
  }

  async function api(url, options) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      location.href = '/admin/login.html?next=%2Fadmin%2Fidi.html';
      throw new Error('Sesi admin berakhir. Silakan masuk kembali.');
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Respons server tidak valid.'); }
    if (!response.ok) throw new Error(result.error || 'Terjadi kesalahan.');
    return result;
  }

  function kategori(skor) {
    if (skor >= 80) return { text: 'Baik', color: 'bg-emerald-100 text-emerald-800' };
    if (skor < 60) return { text: 'Kurang', color: 'bg-red-100 text-red-800' };
    return { text: 'Sedang', color: 'bg-amber-100 text-amber-800' };
  }

  async function loadData() {
    const result = await api('/api/idi');
    data = result;
    $('#stat-tahun').textContent = result.tahun
      ? result.tahun + (result.periodeData ? ' (data utama ' + result.periodeData + ')' : '')
      : '-';
    $('#stat-skor').textContent = typeof result.skorTotal === 'number' ? result.skorTotal.toFixed(2) + '%' : '-';
    $('#stat-jumlah').textContent = result.indikator.length;
    renderTable();
  }

  function renderTable() {
    const aspect = $('#filterAspek').value;
    const query = $('#searchInput').value.trim().toLowerCase();
    const rows = data.indikator.filter((item) =>
      (aspect === 'all' || item.aspek === aspect) &&
      (item.indikator + ' ' + (item.catatan || '')).toLowerCase().includes(query)
    ).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    $('#tabelKosong').classList.toggle('hidden', rows.length > 0);
    const tableBody = $('#indicatorTableBody');
    tableBody.innerHTML = rows.map((item) => {
      const scoreCategory = kategori(item.skor);
      const documentLink = item.dokumen
        ? `<a href="${esc(item.dokumen)}" target="_blank" rel="noopener noreferrer" class="font-semibold text-primary-dark underline">${esc(item.dokumenNama || 'Lihat dokumen')}</a>`
        : '<span class="text-slate-400">Belum ada</span>';
      return `<tr class="align-top hover:bg-amber-50/60">
        <td class="px-4 py-4 font-medium">${esc(item.aspek)}</td>
        <td class="px-4 py-4"><p class="font-semibold">${esc(item.indikator)}</p><p class="mt-1 whitespace-pre-wrap text-xs text-slate-500">${esc(item.catatan || 'Tidak ada catatan.')}</p></td>
        <td class="px-4 py-4 text-center"><span class="font-bold">${Number(item.skor).toFixed(2)}</span><span class="mt-1 block rounded-full px-2 py-0.5 text-xs font-semibold ${scoreCategory.color}">${scoreCategory.text}</span></td>
        <td class="max-w-40 break-words px-4 py-4">${documentLink}</td>
        <td class="whitespace-nowrap px-4 py-4 text-center">
          <button type="button" data-edit="${esc(item.id)}" class="rounded-lg px-3 py-2 font-semibold text-primary-dark hover:bg-amber-100" aria-label="Edit ${esc(item.indikator)}">Edit</button>
          <button type="button" data-delete="${esc(item.id)}" class="rounded-lg px-3 py-2 font-semibold text-red-700 hover:bg-red-50" aria-label="Hapus ${esc(item.indikator)}">Hapus</button>
        </td>
      </tr>`;
    }).join('');
    if (window.FX) window.FX.reveal(tableBody.children);
  }

  function resetForm() {
    editingId = null;
    form.reset();
    $('#formJudul').textContent = 'Tambah indikator E-IDI';
    $('#btnSimpan span').textContent = 'Simpan indikator';
    $('#btnBatal').classList.add('hidden');
    $('#hapusDokWrap').classList.add('hidden');
    $('#docHelp').classList.add('hidden');
  }

  function beginEdit(id) {
    const item = data.indikator.find((row) => row.id === id);
    if (!item) return;
    editingId = item.id;
    form.reset();
    $('#formAspek').value = item.aspek;
    $('#formIndikator').value = item.indikator;
    $('#formSkor').value = item.skor;
    $('#formCatatan').value = item.catatan || '';
    $('#formJudul').textContent = 'Edit indikator';
    $('#btnSimpan span').textContent = 'Simpan perubahan';
    $('#btnBatal').classList.remove('hidden');
    $('#hapusDokWrap').classList.toggle('hidden', !item.dokumen);
    $('#docHelp').classList.toggle('hidden', !item.dokumen);
    form.removeAttribute('data-motion');
    requestAnimationFrame(() => form.setAttribute('data-motion', 'enter'));
    form.scrollIntoView({ behavior: window.FX && window.FX.reduce ? 'auto' : 'smooth', block: 'start' });
    $('#formAspek').focus({ preventScroll: true });
  }

  $('#indicatorTableBody').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');
    if (edit) return beginEdit(edit.dataset.edit);
    if (!remove) return;
    const item = data.indikator.find((row) => row.id === remove.dataset.delete);
    if (!item || !confirm(`Hapus indikator "${item.indikator}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api('/api/idi/indikator/' + encodeURIComponent(item.id), { method: 'DELETE' });
      if (editingId === item.id) resetForm();
      await loadData();
      toast('Indikator berhasil dihapus.', true);
    } catch (error) {
      toast(error.message, false);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#btnSimpan');
    const buttonLabel = button.querySelector('span');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    buttonLabel.textContent = 'Menyimpan...';
    try {
      const endpoint = editingId
        ? '/api/idi/indikator/' + encodeURIComponent(editingId)
        : '/api/idi/indikator';
      const result = await api(endpoint, {
        method: editingId ? 'PUT' : 'POST',
        body: new FormData(form)
      });
      resetForm();
      await loadData();
      toast(`Data indikator "${result.indikator}" berhasil disimpan.`, true);
    } catch (error) {
      toast(error.message, false);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      buttonLabel.textContent = editingId ? 'Simpan perubahan' : 'Simpan indikator';
    }
  });

  $('#btnBatal').addEventListener('click', resetForm);
  $('#btnReset').addEventListener('click', () => setTimeout(resetForm, 0));
  $('#filterAspek').addEventListener('change', renderTable);
  $('#searchInput').addEventListener('input', renderTable);
  $('#logout').addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
      location.href = '/admin/login.html';
    } catch (error) {
      toast(error.message, false);
    }
  });

  (async function init() {
    try {
      await api('/api/admin/me');
      await loadData();
    } catch (error) {
      if (!location.pathname.endsWith('/login.html')) toast(error.message, false);
    }
  })();
})();
