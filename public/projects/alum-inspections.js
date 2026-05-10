(function () {
  'use strict';

  const key = 'cast.alum.inspections.v1';
  const seed = [
    { inspection: 'Framing inspection', date: '2026-05-08', location: 'Level 2', trade: 'Framing', status: 'Passed', note: 'Approved with photo documentation.' },
    { inspection: 'MEP rough-in inspection', date: '2026-05-09', location: 'East wing', trade: 'MEP', status: 'Reinspect', note: 'Correction items need closeout evidence.' },
    { inspection: 'Fire life safety walk', date: '2026-05-10', location: 'Sitewide', trade: 'Fire protection', status: 'Scheduled', note: 'Coordinate access and responsible foreman.' },
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
    $('[data-scheduled-count]').textContent = items.filter((item) => ['Scheduled', 'Requested'].includes(item.status)).length;
    $('[data-reinspect-count]').textContent = items.filter((item) => ['Failed', 'Reinspect'].includes(item.status)).length;
    $('[data-passed-count]').textContent = items.filter((item) => item.status === 'Passed').length;
    $('[data-inspection-count]').textContent = `${items.length} records`;
    $('[data-inspection-rows]').innerHTML = items.map((item, index) => `
      <tr>
        <td>${esc(item.inspection)}</td>
        <td>${esc(item.date || '—')}</td>
        <td>${esc(item.location || '—')}</td>
        <td>${esc(item.trade || '—')}</td>
        <td><button class="small-action" data-cycle-status="${index}">${esc(item.status || 'Scheduled')}</button></td>
        <td>${esc(item.note || '—')}</td>
        <td><button class="small-action" data-remove-inspection="${index}">Remove</button></td>
      </tr>`).join('');
    document.querySelectorAll('[data-cycle-status]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = records();
        const statuses = ['Scheduled', 'Requested', 'Passed', 'Failed', 'Reinspect'];
        const item = next[Number(button.dataset.cycleStatus)];
        item.status = statuses[(statuses.indexOf(item.status) + 1) % statuses.length] || 'Scheduled';
        save(next);
        render();
      });
    });
    document.querySelectorAll('[data-remove-inspection]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = records();
        next.splice(Number(button.dataset.removeInspection), 1);
        save(next);
        render();
      });
    });
  }

  $('[data-add-inspection]')?.addEventListener('click', () => {
    const item = {
      inspection: $('[data-inspection]').value.trim() || 'Untitled inspection',
      date: $('[data-date]').value,
      location: $('[data-location]').value.trim(),
      trade: $('[data-trade]').value.trim(),
      status: $('[data-status]').value,
      note: $('[data-note]').value.trim(),
    };
    save([item, ...records()]);
    document.querySelectorAll('[data-inspection],[data-date],[data-location],[data-trade],[data-note]').forEach((input) => { input.value = ''; });
    render();
  });

  $('[data-export-inspections]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(records(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'alum-inspections-register.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
})();
