(function () {
  'use strict';

  const key = 'cast.alum.photosVideos.v1';
  const seed = [
    { type: 'Photo', date: '2026-05-08', title: 'Level 2 framing progress', location: 'Level 2 corridor', trade: 'Framing', link: '', report: true },
    { type: 'Photo', date: '2026-05-09', title: 'MEP rough-in coordination', location: 'East wing', trade: 'MEP', link: '', report: true },
    { type: 'Video', date: '2026-05-10', title: 'Weekly walkthrough clip', location: 'Sitewide', trade: 'General', link: '', report: false },
  ];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function rows() {
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
    const items = rows();
    const photos = items.filter((item) => item.type === 'Photo').length;
    const videos = items.filter((item) => item.type === 'Video').length;
    const report = items.filter((item) => item.report).length;
    $('[data-photo-count]').textContent = photos;
    $('[data-video-count]').textContent = videos;
    $('[data-report-count]').textContent = report;
    $('[data-media-count]').textContent = `${items.length} records`;
    $('[data-media-rows]').innerHTML = items.map((item, index) => `
      <tr>
        <td>${esc(item.type)}</td>
        <td>${esc(item.date || '—')}</td>
        <td><strong>${esc(item.title)}</strong>${item.link ? `<br><a href="${esc(item.link)}">Source</a>` : ''}</td>
        <td>${esc(item.location || '—')}</td>
        <td>${esc(item.trade || '—')}</td>
        <td><button class="small-action" data-toggle-report="${index}">${item.report ? 'Included' : 'Add'}</button></td>
        <td><button class="small-action" data-remove-media="${index}">Remove</button></td>
      </tr>`).join('');
    document.querySelectorAll('[data-toggle-report]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = rows();
        next[Number(button.dataset.toggleReport)].report = !next[Number(button.dataset.toggleReport)].report;
        save(next);
        render();
      });
    });
    document.querySelectorAll('[data-remove-media]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = rows();
        next.splice(Number(button.dataset.removeMedia), 1);
        save(next);
        render();
      });
    });
  }

  $('[data-add-media]')?.addEventListener('click', () => {
    const item = {
      title: $('[data-title]').value.trim() || 'Untitled media record',
      type: $('[data-type]').value,
      location: $('[data-location]').value.trim(),
      date: $('[data-date]').value,
      trade: $('[data-trade]').value.trim(),
      link: $('[data-link]').value.trim(),
      report: false,
    };
    save([item, ...rows()]);
    document.querySelectorAll('[data-title],[data-location],[data-date],[data-trade],[data-link]').forEach((input) => { input.value = ''; });
    render();
  });

  $('[data-export-media]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(rows(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'alum-project-photos-videos.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
})();
