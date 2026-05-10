(function () {
  'use strict';

  const key = 'cast.alum.safety.v1';
  const seed = [
    { category: 'Toolbox Talk', date: '2026-05-08', location: 'Jobsite', party: 'All trades', status: 'Closed', note: 'Fall protection and housekeeping review.' },
    { category: 'Safety Observation', date: '2026-05-09', location: 'Level 2 corridor', party: 'Framing', status: 'Open', note: 'Verify edge protection and clean access path.' },
    { category: 'Inspection', date: '2026-05-10', location: 'Sitewide', party: 'General', status: 'In Review', note: 'Weekly safety walk items pending PM review.' },
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
    $('[data-open-count]').textContent = items.filter((item) => item.status !== 'Closed').length;
    $('[data-incident-count]').textContent = items.filter((item) => ['Incident', 'Near Miss'].includes(item.category)).length;
    $('[data-talk-count]').textContent = items.filter((item) => item.category === 'Toolbox Talk').length;
    $('[data-safety-count]').textContent = `${items.length} records`;
    $('[data-safety-rows]').innerHTML = items.map((item, index) => `
      <tr>
        <td>${esc(item.category)}</td>
        <td>${esc(item.date || '—')}</td>
        <td>${esc(item.location || '—')}</td>
        <td>${esc(item.party || '—')}</td>
        <td><button class="small-action" data-toggle-status="${index}">${esc(item.status || 'Open')}</button></td>
        <td>${esc(item.note || '—')}</td>
        <td><button class="small-action" data-remove-safety="${index}">Remove</button></td>
      </tr>`).join('');
    document.querySelectorAll('[data-toggle-status]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = records();
        const current = next[Number(button.dataset.toggleStatus)].status;
        next[Number(button.dataset.toggleStatus)].status = current === 'Open' ? 'In Review' : current === 'In Review' ? 'Closed' : 'Open';
        save(next);
        render();
      });
    });
    document.querySelectorAll('[data-remove-safety]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = records();
        next.splice(Number(button.dataset.removeSafety), 1);
        save(next);
        render();
      });
    });
  }

  $('[data-add-safety]')?.addEventListener('click', () => {
    const item = {
      category: $('[data-category]').value,
      date: $('[data-date]').value,
      location: $('[data-location]').value.trim(),
      party: $('[data-party]').value.trim(),
      status: $('[data-status]').value,
      note: $('[data-note]').value.trim(),
    };
    save([item, ...records()]);
    document.querySelectorAll('[data-date],[data-location],[data-party],[data-note]').forEach((input) => { input.value = ''; });
    render();
  });

  $('[data-export-safety]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(records(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'alum-safety-register.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
})();
