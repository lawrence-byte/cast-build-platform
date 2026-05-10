(function () {
  'use strict';

  const key = 'cast.alum.qualityControlReport.v1';
  const seed = [
    { type: 'Inspection', date: '2026-05-08', location: 'Level 2 corridor', trade: 'Framing', status: 'In Review', note: 'Inspection photos and follow-up notes ready for QC packet.' },
    { type: 'Deficiency', date: '2026-05-09', location: 'East wing', trade: 'MEP', status: 'Open', note: 'Coordinate rough-in correction evidence before closeout.' },
    { type: 'Photo Evidence', date: '2026-05-10', location: 'Sitewide', trade: 'General', status: 'Accepted', note: 'Progress photos selected for owner report.' },
  ];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function records() {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(parsed) ? parsed : seed;
    } catch (_) {
      return seed;
    }
  }

  function save(items) {
    localStorage.setItem(key, JSON.stringify(items));
  }

  function render() {
    const items = records();
    $('[data-open-qc]').textContent = items.filter((item) => !['Accepted', 'Closed'].includes(item.status)).length;
    $('[data-inspections]').textContent = items.filter((item) => item.type === 'Inspection').length;
    $('[data-report-ready]').textContent = items.filter((item) => ['Accepted', 'Closed'].includes(item.status)).length;
    $('[data-qc-count]').textContent = `${items.length} records`;
    $('[data-qc-rows]').innerHTML = items.map((item, index) => `
      <tr>
        <td>${esc(item.type)}</td>
        <td>${esc(item.date || '—')}</td>
        <td>${esc(item.location || '—')}</td>
        <td>${esc(item.trade || '—')}</td>
        <td><button class="small-action" data-cycle-status="${index}">${esc(item.status || 'Open')}</button></td>
        <td>${esc(item.note || '—')}</td>
        <td><button class="small-action" data-remove-qc="${index}">Remove</button></td>
      </tr>`).join('');
    document.querySelectorAll('[data-cycle-status]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = records();
        const statuses = ['Open', 'In Review', 'Accepted', 'Closed'];
        const item = next[Number(button.dataset.cycleStatus)];
        item.status = statuses[(statuses.indexOf(item.status) + 1) % statuses.length] || 'Open';
        save(next);
        render();
      });
    });
    document.querySelectorAll('[data-remove-qc]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = records();
        next.splice(Number(button.dataset.removeQc), 1);
        save(next);
        render();
      });
    });
  }

  $('[data-add-qc]')?.addEventListener('click', () => {
    const item = {
      type: $('[data-type]').value,
      date: $('[data-date]').value,
      location: $('[data-location]').value.trim(),
      trade: $('[data-trade]').value.trim(),
      status: $('[data-status]').value,
      note: $('[data-note]').value.trim(),
    };
    save([item, ...records()]);
    document.querySelectorAll('[data-date],[data-location],[data-trade],[data-note]').forEach((input) => { input.value = ''; });
    render();
  });

  $('[data-export-qc]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(records(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'alum-quality-control-report.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
})();
