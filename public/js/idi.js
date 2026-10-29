/* Halaman publik E-IDI: hanya membaca data yang telah dipublikasikan. */
(function () {
  const { esc } = window.BK;
  const $ = (selector) => document.querySelector(selector);
  let data = { aspek: [], tren: [], indikator: [] };

  function kategori(skor) {
    if (skor >= 80) return { nama: 'Baik', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', teks: 'text-emerald-600', bar: 'bg-amber-600', pill: 'bg-emerald-50 text-emerald-600' };
    if (skor < 60) return { nama: 'Kurang', badge: 'bg-red-100 text-red-800 border-red-300', teks: 'text-red-600', bar: 'bg-red-500', pill: 'bg-red-50 text-red-600' };
    return { nama: 'Sedang', badge: 'bg-amber-100 text-amber-800 border-amber-300', teks: 'text-orange-600', bar: 'bg-orange-500', pill: 'bg-orange-50 text-orange-600' };
  }

  function renderSummary() {
    $('#tahunAnggaran').textContent = data.tahun ? 'Tahun Anggaran ' + data.tahun : '';
    if (typeof data.skorTotal === 'number') {
      const scoreCategory = kategori(data.skorTotal);
      $('#skorTotal').textContent = data.skorTotal.toFixed(2) + '%';
      const categoryLabel = $('#kategoriTotal');
      categoryLabel.textContent = 'Kategori: ' + scoreCategory.nama;
      categoryLabel.className = 'mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold ' + scoreCategory.pill;
    }

    $('#kartuAspek').innerHTML = data.aspek.map((aspect) => {
      const scoreCategory = kategori(aspect.skor);
      return `<article class="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
        <div>
          <div class="mb-3 flex items-start justify-between">
            <span class="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">${esc(aspect.romawi)}</span>
            <div class="rounded-xl bg-amber-50 p-2 text-amber-600"><i class="fa-solid ${esc(aspect.ikon)} text-lg" aria-hidden="true"></i></div>
          </div>
          <h2 class="text-base font-bold">${esc(aspect.judul)}</h2>
          <p class="mt-1 text-xs text-amber-900/70">${esc(aspect.deskripsi)}</p>
        </div>
        <div class="mt-5 flex items-end justify-between border-t border-amber-100 pt-4">
          <div><span class="text-2xl font-black">${Number(aspect.skor).toFixed(2)}%</span><span class="ml-2 text-xs font-bold ${scoreCategory.teks}">${scoreCategory.nama}</span></div>
          <div class="h-2 w-24 rounded-full bg-amber-100"><div class="h-2 rounded-full ${scoreCategory.bar}" style="width:${Math.min(100, Math.max(0, aspect.skor))}%"></div></div>
        </div>
      </article>`;
    }).join('');

    if (data.tren.length) {
      $('#trenJudul').textContent = `Tren Perkembangan IDI (${data.tren[0].tahun} - ${data.tren[data.tren.length - 1].tahun})`;
    }
    const trendBadge = $('#trenBadge');
    if (data.sumberTren) trendBadge.innerHTML = '<i class="fa-solid fa-circle-check mr-1"></i> ' + esc(data.sumberTren);
    else trendBadge.remove();
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = '#3b1d05';
    const serif = { family: 'Bitter, Georgia, serif' };

    new Chart($('#radarChart'), {
      type: 'radar',
      data: {
        labels: data.aspek.map((aspect) => aspect.singkat || aspect.judul),
        datasets: [{
          data: data.aspek.map((aspect) => aspect.skor),
          backgroundColor: 'rgba(245, 158, 11, 0.25)', borderColor: '#b45309', borderWidth: 2.5,
          pointBackgroundColor: '#b45309', pointBorderColor: '#fff', pointRadius: 5, pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { min: 50, max: 100, ticks: { stepSize: 10, display: false }, grid: { color: '#fde68a' }, angleLines: { color: '#fde68a' }, pointLabels: { font: { ...serif, size: 11, weight: '700' } } } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#3b1d05', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (context) => ' Skor Capaian: ' + context.parsed.r + '%' } } }
      }
    });

    new Chart($('#lineChart'), {
      type: 'line',
      data: {
        labels: data.tren.map((item) => String(item.tahun)),
        datasets: [{
          data: data.tren.map((item) => item.nilai),
          borderColor: '#b45309', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 3, fill: true,
          pointBackgroundColor: '#b45309', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7, tension: 0.2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { min: 60, max: 100, ticks: { stepSize: 10, font: { size: 10 } }, grid: { color: '#fef3c7' }, border: { display: false } }, x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } } },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#3b1d05', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (context) => ' IDI: ' + context.parsed.y + '%' } } }
      }
    });
  }

  function renderTable() {
    const aspect = $('#filterAspek').value;
    const query = $('#searchInput').value.trim().toLowerCase();
    const rows = data.indikator
      .filter((item) => (aspect === 'all' || item.aspek === aspect) && (item.indikator + ' ' + item.catatan).toLowerCase().includes(query))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    $('#tabelKosong').classList.toggle('hidden', rows.length > 0);
    $('#indicatorTableBody').innerHTML = rows.map((item) => {
      const scoreCategory = kategori(item.skor);
      const documentLink = item.dokumen
        ? `<a href="${esc(item.dokumen)}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950"><i class="fa-regular ${/\.pdf$/i.test(item.dokumen) ? 'fa-file-pdf text-red-600' : 'fa-file-image text-amber-700'} text-sm" aria-hidden="true"></i>${esc(item.dokumenNama || 'Lihat dokumen')}</a>`
        : '<span class="text-xs text-amber-900/50">Belum ada dokumen</span>';
      return `<tr class="transition-colors hover:bg-amber-50/50">
        <td class="px-6 py-4 align-top font-semibold">${esc(item.aspek)}</td>
        <td class="px-6 py-4 align-top"><span class="font-bold">${esc(item.indikator)}</span><p class="mt-1 text-[11px] text-amber-900/70">${esc(item.catatan || 'Tidak ada catatan tambahan.')}</p></td>
        <td class="px-6 py-4 text-center align-top"><span class="text-base font-black">${Number(item.skor).toFixed(2)}</span></td>
        <td class="px-6 py-4 text-center align-top"><span class="inline-block rounded-full border px-2.5 py-1 text-[10px] font-bold ${scoreCategory.badge}">${scoreCategory.nama}</span></td>
        <td class="px-6 py-4 align-top">${documentLink}</td>
      </tr>`;
    }).join('');
  }

  $('#filterAspek').addEventListener('change', renderTable);
  $('#searchInput').addEventListener('input', renderTable);
  $('#btnPrint').addEventListener('click', () => window.print());

  (async function init() {
    try {
      const response = await fetch('/api/idi');
      if (!response.ok) throw new Error('Data IDI belum bisa dimuat.');
      data = await response.json();
      renderSummary();
      renderCharts();
      renderTable();
    } catch (error) {
      $('#tabelKosong').textContent = error.message || 'Data IDI belum bisa dimuat. Muat ulang halaman ini beberapa saat lagi.';
      $('#tabelKosong').classList.remove('hidden');
    }
  })();
})();
