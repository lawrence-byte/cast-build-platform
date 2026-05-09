// Alüm RFIs — populates the dedicated module page from local metadata.
// Data shape: /safe-data/projects/golden-hill/rfi-summary.json
// Note: this is a read-first replica. No write actions, no CAST BUILD A.O auth.

(function () {
  'use strict';

  async function loadJson(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error('metadata unavailable');
    return r.json();
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
  }
  function pct(n, total) { return total ? `${Math.round((Number(n || 0) / total) * 100)}%` : '0%'; }
  function fmtNum(n) { return Number(n || 0).toLocaleString(); }
  function daysBetween(a, b) { return Math.max(0, Math.ceil((b - a) / 86400000)); }

  function statusPill(s) {
    const t = String(s || '');
    const lower = t.toLowerCase();
    let kind = 'neutral';
    if (lower.includes('open')) kind = 'open';
    else if (lower.includes('draft')) kind = 'draft';
    else if (lower.includes('closed')) kind = 'closed';
    else if (lower.includes('progress')) kind = 'progress';
    else if (lower.includes('overdue')) kind = 'overdue';
    return `<span class="cb-pill cb-pill--${kind}">${esc(t || 'Unknown')}</span>`;
  }

  function safeStep(item) {
    if (/folder-rfi/i.test(item.sourceKind || '')) return 'Tie folder PDF back to current server RFI register before relying on it';
    if (/open/i.test(item.Status || '') && item['Due Date']) return `Confirm reviewer response path before ${esc(item['Due Date'])}`;
    if (/draft/i.test(item.Status || '')) return 'Validate draft scope, manager, and due date before issuing';
    if (/closed|responded/i.test(item.Status || '')) return 'Reference response package and closeout history';
    return 'Reference only — no action required';
  }

  function rowsFromPairs(pairs, emptyLabel) {
    if (!pairs || !pairs.length) return `<tr><td colspan="2"><div class="cb-empty" style="padding:32px"><h3>${esc(emptyLabel || 'No data')}</h3><p>This view will populate once metadata is exported from CAST BUILD A.O.</p></div></td></tr>`;
    return pairs.map(([name, count]) => `<tr><td>${esc(name || 'Unassigned')}</td><td class="cb-td-num">${fmtNum(count)}</td></tr>`).join('');
  }

  function rowEmpty(colspan, title, sub) {
    return `<tr><td colspan="${colspan}"><div class="cb-empty" style="padding:32px;border:none"><h3>${esc(title)}</h3><p>${esc(sub || '')}</p></div></td></tr>`;
  }

  function setText(sel, value, fallback) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.textContent = value === undefined || value === null ? (fallback ?? '—') : (typeof value === 'number' ? fmtNum(value) : String(value));
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('.cb-tabs [data-tab]');
    const panels = document.querySelectorAll('.cb-tab-panel');
    function activate(name, push) {
      tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
      panels.forEach((p) => { p.hidden = (p.id !== name); });
      if (push) history.replaceState(null, '', '#' + name);
    }
    tabs.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); activate(t.dataset.tab, true); }));
    const initial = (window.location.hash || '').replace('#', '') || 'queue';
    if (document.getElementById(initial)) activate(initial, false);
  }

  function normalizeRow(x) {
    const issued = x.issuedRfiLink || x.issued_rfi_link || x['Issued RFI Link'] || '';
    const responded = x.respondedRfiLink || x.responded_rfi_link || x['Responded RFI Link'] || '';
    const distributed = x.last_distributed_at || x.lastDistributedAt || x['Last Distributed'] || '';
    const responseDistributed = x.last_response_distributed_at || x.lastResponseDistributedAt || x['Last Response Distributed'] || '';
    const dateCreated = x['Date Created'] || x.date_created || x.createdAt || '';
    const dueDate = x['Due Date'] || x.due_date || '';
    const closedDate = x['Date Closed'] || x.date_closed || '';
    const respondedDate = x['Date Responded'] || x.date_responded || x.response_date || '';
    const today = new Date();
    const due = dueDate ? new Date(dueDate) : null;
    const start = dateCreated ? new Date(dateCreated) : null;
    const closed = closedDate ? new Date(closedDate) : null;
    const activeEnd = closed || today;
    return {
      ...x,
      _issued: issued,
      _responded: responded,
      _distributed: distributed,
      _responseDistributed: responseDistributed,
      _assignees: x.Assignees || x['Assigned Id'] || '',
      _manager: x['RFI Manager'] || x.rfi_manager || '',
      _responsible: x['Responsible Contractor'] || x.responsible_contractor || x.Division || '',
      _receivedFrom: x['Received From'] || x.received_from || '',
      _priority: x.Priority || x.priority || 'Normal',
      _private: Boolean(x.private_flag || x.Private || x['Private Flag']),
      _currentRevision: x.current_revision_flag !== false,
      _overdue: due && due < today && /open|draft|returned|responded|revised/i.test(x.Status || ''),
      _due7: due && (due - today) >= 0 && (due - today) < 7 * 86400000,
      _daysOpen: start ? daysBetween(start, activeEnd) : '',
      _daysOverdue: due && due < today && !closed ? daysBetween(due, today) : '',
    };
  }

  function linkCell(url, label) {
    return url ? `<a class="view" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : '<span class="cb-td-muted">Missing</span>';
  }

  function setupFilters(allRows, render) {
    const statusSel = document.querySelector('[data-filter="status"]');
    const impactSel = document.querySelector('[data-filter="impact"]');
    const linkSel = document.querySelector('[data-filter="links"]');
    const showRevisions = document.querySelector('[data-show-revisions]');
    const search = document.querySelector('[data-cb-search]');
    const reset = document.querySelector('[data-reset-filters]');

    function apply() {
      let rows = allRows.slice();
      const s = statusSel?.value || '';
      const imp = impactSel?.value || '';
      const link = linkSel?.value || '';
      const q = (search?.value || '').trim().toLowerCase();
      const allRevisions = Boolean(showRevisions?.checked);

      if (!allRevisions) rows = rows.filter((r) => r._currentRevision);
      if (s) rows = rows.filter((r) => String(r.Status || '').toLowerCase().includes(s));
      if (imp === 'cost') rows = rows.filter((r) => /yes/i.test(r['Cost Impact'] || ''));
      else if (imp === 'schedule') rows = rows.filter((r) => /yes/i.test(r['Schedule Impact'] || ''));
      else if (imp === 'overdue') rows = rows.filter((r) => r._overdue);
      else if (imp === 'due7') rows = rows.filter((r) => r._due7);
      if (link === 'has-issued') rows = rows.filter((r) => r._issued);
      else if (link === 'missing-issued') rows = rows.filter((r) => !r._issued);
      else if (link === 'has-responded') rows = rows.filter((r) => r._responded);
      else if (link === 'missing-responded') rows = rows.filter((r) => !r._responded);
      else if (link === 'distributed') rows = rows.filter((r) => r._distributed);
      else if (link === 'not-distributed') rows = rows.filter((r) => !r._distributed);
      else if (link === 'response-distributed') rows = rows.filter((r) => r._responseDistributed);
      else if (link === 'response-not-distributed') rows = rows.filter((r) => !r._responseDistributed);
      if (q) rows = rows.filter((r) => `${r.Subject || ''} ${r.Question || ''} ${r['Ball In Court'] || ''} ${r._manager || ''} ${r.Number || ''}`.toLowerCase().includes(q));

      const filtered = rows.length !== allRows.length || s || imp || link || q || allRevisions;
      const warning = document.querySelector('[data-filter-warning]');
      if (warning) warning.hidden = !filtered;
      render(rows);
    }

    [statusSel, impactSel, linkSel, showRevisions, search].forEach((el) => el?.addEventListener(el === search ? 'input' : 'change', apply));
    reset?.addEventListener('click', () => {
      if (statusSel) statusSel.value = '';
      if (impactSel) impactSel.value = '';
      if (linkSel) linkSel.value = '';
      if (showRevisions) showRevisions.checked = false;
      if (search) search.value = '';
      apply();
    });
    return apply;
  }

  (async () => {
    let rfi;
    try { rfi = await loadJson('/safe-data/projects/golden-hill/rfi-summary.json'); }
    catch (err) {
      const tbody = document.querySelector('[data-rfi-rows]');
      if (tbody) tbody.innerHTML = rowEmpty(23, 'RFI metadata unavailable', 'The data file is being refreshed.');
      console.error('[rfi]', err);
      return;
    }

    const genEl = document.querySelector('[data-generated]');
    if (genEl) genEl.textContent = `Generated ${rfi.generatedAt || 'from local metadata'} · Source: ${rfi.source || 'CAST BUILD A.O export'}`;

    setText('[data-total]', rfi.folderRfiPdfCount || rfi.total);
    setText('[data-open]', (rfi.openCount || 0) + (rfi.draftCount || 0));
    setText('[data-overdue]', rfi.overdueOpen);
    setText('[data-seven]', rfi.dueWithin7Days);
    setText('[data-total-caption]', `Across ${Object.keys(rfi.statusCounts || {}).length || 0} statuses`);
    setText('[data-open-caption]', `${rfi.openCount || 0} open · ${rfi.draftCount || 0} draft`);
    const overdueCaptionEl = document.querySelector('[data-overdue-caption]');
    if (overdueCaptionEl) {
      const o = rfi.overdueOpen || 0;
      overdueCaptionEl.textContent = o ? 'Past due — review immediately' : 'On track';
      overdueCaptionEl.style.color = o ? 'var(--danger)' : 'var(--success)';
    }
    setText('[data-seven-caption]', (rfi.dueWithin7Days || 0) ? 'Coming up — confirm responders' : 'No imminent deadlines');
    setText('[data-cost]', rfi.costImpactYes);
    setText('[data-schedule]', rfi.scheduleImpactYes);
    setText('[data-nodue]', rfi.openNoDueDate);
    setText('[data-closed]', rfi.closedCount);

    const today = new Date();
    const primaryRows = (rfi.recentItems && rfi.recentItems.length ? rfi.recentItems : []).concat(rfi.openItems || []);
    const fallbackRows = rfi.folderItems || [];
    const byKey = new Map();
    [...primaryRows, ...fallbackRows].forEach((row) => {
      const key = `${row.Number || row.Subject || row.fileName || ''}|${row.Revision || row['Rev.'] || '0'}|${row.Status || ''}`;
      if (!byKey.has(key)) byKey.set(key, normalizeRow(row));
    });
    const queueRaw = [...byKey.values()].slice(0, 303);
    queueRaw.forEach((x) => {
      const d = x['Due Date'] ? new Date(x['Due Date']) : null;
      x._overdue = x._overdue || (d && d < today && /open|draft/i.test(x.Status || ''));
      x._due7 = x._due7 || (d && (d - today) >= 0 && (d - today) < 7 * 86400000);
    });

    const tbody = document.querySelector('[data-rfi-rows]');
    const countEl = document.querySelector('[data-rfi-count]');
    function renderQueue(rows) {
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = rowEmpty(23, 'No matching RFIs', 'Adjust filters or clear the search to see more.');
        if (countEl) countEl.textContent = '0 shown';
        return;
      }
      tbody.innerHTML = rows.map((x) => {
        const due = x['Due Date'] ? `<span style="color:${x._overdue ? 'var(--danger)' : x._due7 ? 'var(--warning)' : 'inherit'}">${esc(x['Due Date'])}</span>` : '<span class="cb-td-muted">—</span>';
        return `<tr>
          <td>${esc(x.Number || '—')}</td>
          <td>${esc(x.Revision || '0')}</td>
          <td><strong style="color:var(--dark)">${esc(x.Subject || '')}</strong><div class="cb-td-muted">${esc((x.Question || '').slice(0, 90))}</div></td>
          <td>${statusPill(x.Status)}</td>
          <td>${esc(x._priority)}</td>
          <td>${esc(x['Ball In Court'] || x['Assigned Id'] || x._manager || '—')}</td>
          <td>${esc(x._assignees || '—')}</td>
          <td>${esc(x._manager || '—')}</td>
          <td>${esc(x._responsible || '—')}</td>
          <td class="cb-td-num">${due}</td>
          <td>${esc(x['Date Issued'] || x.date_issued || '—')}</td>
          <td>${esc(x['Date Responded'] || x.date_responded || '—')}</td>
          <td>${esc(x['Date Closed'] || x.date_closed || '—')}</td>
          <td>${linkCell(x._issued, 'Issued')}</td>
          <td>${linkCell(x._responded, 'Responded')}</td>
          <td>${esc(x._distributed || '—')}</td>
          <td>${esc(x._responseDistributed || '—')}</td>
          <td>${esc(x['Cost Impact'] || '—')}</td>
          <td>${esc(x['Schedule Impact'] || '—')}</td>
          <td>${esc(x._daysOpen || '—')}</td>
          <td>${esc(x._daysOverdue || '—')}</td>
          <td>${x._private ? 'Yes' : 'No'}</td>
          <td class="cb-td-muted">${safeStep(x)}</td>
        </tr>`;
      }).join('');
      if (countEl) countEl.textContent = `${rows.length} of ${queueRaw.length} shown`;
    }
    renderQueue(queueRaw);
    setupFilters(queueRaw, renderQueue);

    const statuses = Object.entries(rfi.statusCounts || {}).sort((a, b) => b[1] - a[1]);
    const statusBody = document.querySelector('[data-status-rows]');
    if (statusBody) statusBody.innerHTML = statuses.length ? statuses.map(([status, count]) => `<tr><td>${statusPill(status)}</td><td class="cb-td-num">${fmtNum(count)}</td><td class="cb-td-num">${pct(count, rfi.total || 0)}</td></tr>`).join('') : rowEmpty(3, 'No status data', 'Status breakdown will appear once metadata is loaded.');

    const mgrBody = document.querySelector('[data-manager-rows]');
    if (mgrBody) mgrBody.innerHTML = rowsFromPairs(rfi.topManagers, 'No manager data');
    const subBody = document.querySelector('[data-contractor-rows]');
    if (subBody) subBody.innerHTML = rowsFromPairs(rfi.topContractors, 'No contractor data');

    setupTabs();
  })();
})();
