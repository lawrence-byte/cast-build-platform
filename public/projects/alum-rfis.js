// Alüm RFIs — populates the dedicated module page from local metadata.
// Data shape: /safe-data/projects/golden-hill/rfi-summary.json
// Note: this is a read-first document portal. Create RFI saves local draft intake records until backend/auth/write-back exists.

(function () {
  'use strict';

  const LOCAL_RFI_KEY = 'cast-alum-local-rfi-drafts-v1';

  // ---------- helpers ----------
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

  function readLocalDrafts() {
    try { return JSON.parse(localStorage.getItem(LOCAL_RFI_KEY) || '[]'); } catch { return []; }
  }
  function writeLocalDrafts(rows) {
    localStorage.setItem(LOCAL_RFI_KEY, JSON.stringify(rows.slice(0, 100)));
  }
  function localDraftNumber() {
    const d = new Date();
    return `DRAFT-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-5)}`;
  }
  function localDraftToQueue(row) {
    return {
      Number: row.number,
      Revision: '0',
      Subject: row.subject,
      Status: 'Draft (Local)',
      'Ball In Court': row.ball_in_court,
      'RFI Manager': row.rfi_manager,
      'Due Date': row.due_date,
      'Cost Impact': row.cost_impact,
      'Schedule Impact': row.schedule_impact,
      Drawing: row.drawing,
      Spec: row.spec,
      Location: row.location,
      Private: row.private_flag ? 'Yes' : 'No',
      _localDraft: true,
      _createdAt: row.created_at,
    };
  }

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
    if (/open/i.test(item.Status || '') && item['Due Date']) {
      return `Confirm reviewer response path before ${esc(item['Due Date'])}`;
    }
    if (item._localDraft) {
      return 'Review local draft, verify attachments/recipients, then issue through approved backend workflow';
    }
    if (/draft/i.test(item.Status || '')) {
      return 'Validate draft scope, manager, and due date before issuing';
    }
    return 'Reference only — no action required';
  }

  function rowsFromPairs(pairs, emptyLabel) {
    if (!pairs || !pairs.length) {
      return `<tr><td colspan="2"><div class="cb-empty" style="padding:32px"><h3>${esc(emptyLabel || 'No data')}</h3><p>This view will populate once metadata is exported from CAST BUILD A.O.</p></div></td></tr>`;
    }
    return pairs.map(([name, count]) =>
      `<tr><td>${esc(name || 'Unassigned')}</td><td class="cb-td-num">${fmtNum(count)}</td></tr>`
    ).join('');
  }

  function rowEmpty(colspan, title, sub) {
    return `<tr><td colspan="${colspan}"><div class="cb-empty" style="padding:32px;border:none"><h3>${esc(title)}</h3><p>${esc(sub || '')}</p></div></td></tr>`;
  }

  // ---------- KPI / metric writers ----------
  function setText(sel, value, fallback) {
    const el = document.querySelector(sel);
    if (!el) return;
    if (value === undefined || value === null) {
      el.textContent = fallback ?? '—';
    } else {
      el.textContent = typeof value === 'number' ? fmtNum(value) : String(value);
    }
  }

  // ---------- tabs ----------
  function setupTabs() {
    const tabs = document.querySelectorAll('.cb-tabs [data-tab]');
    const panels = document.querySelectorAll('.cb-tab-panel');
    function activate(name, push) {
      tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
      panels.forEach((p) => { p.hidden = (p.id !== name); });
      if (push) history.replaceState(null, '', '#' + name);
    }
    tabs.forEach((t) => t.addEventListener('click', (e) => {
      e.preventDefault();
      activate(t.dataset.tab, true);
    }));
    const initial = (window.location.hash || '').replace('#', '') || 'queue';
    if ([...panels].some((p) => p.id === initial)) activate(initial, false);
    else activate('queue', false);
  }

  // ---------- filters / search ----------
  function setupFilters(getRows, render) {
    const statusSel = document.querySelector('[data-filter="status"]');
    const impactSel = document.querySelector('[data-filter="impact"]');
    const search = document.querySelector('[data-cb-search]');

    function apply() {
      let rows = getRows().slice();
      const s = (statusSel && statusSel.value) || '';
      const imp = (impactSel && impactSel.value) || '';
      const q = (search && search.value || '').trim().toLowerCase();

      if (s) {
        rows = rows.filter((r) => String(r.Status || '').toLowerCase().includes(s));
      }
      if (imp === 'cost') rows = rows.filter((r) => /yes/i.test(r['Cost Impact'] || ''));
      else if (imp === 'schedule') rows = rows.filter((r) => /yes/i.test(r['Schedule Impact'] || ''));
      else if (imp === 'overdue') rows = rows.filter((r) => r._overdue);
      else if (imp === 'due7') rows = rows.filter((r) => r._due7);
      if (q) {
        rows = rows.filter((r) => {
          const hay = `${r.Subject || ''} ${r['Ball In Court'] || ''} ${r['RFI Manager'] || ''} ${r.Number || ''}`.toLowerCase();
          return hay.includes(q);
        });
      }
      render(rows);
    }
    if (statusSel) statusSel.addEventListener('change', apply);
    if (impactSel) impactSel.addEventListener('change', apply);
    if (search) search.addEventListener('input', apply);
    return apply;
  }


  function setupCreateRfi(onCreate) {
    const form = document.querySelector('[data-rfi-create-form]');
    const msg = document.querySelector('[data-rfi-create-message]');
    const clear = document.querySelector('[data-clear-local-rfis]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const draft = {
        id: `local_${Date.now()}`,
        number: localDraftNumber(),
        subject: String(fd.get('subject') || '').trim(),
        question: String(fd.get('question') || '').trim(),
        ball_in_court: String(fd.get('ball_in_court') || '').trim() || 'Unassigned',
        rfi_manager: String(fd.get('rfi_manager') || '').trim() || 'Unassigned',
        due_date: String(fd.get('due_date') || '').trim(),
        priority: String(fd.get('priority') || 'Normal'),
        cost_impact: String(fd.get('cost_impact') || 'No'),
        schedule_impact: String(fd.get('schedule_impact') || 'No'),
        drawing: String(fd.get('drawing') || '').trim(),
        spec: String(fd.get('spec') || '').trim(),
        location: String(fd.get('location') || '').trim(),
        private_flag: fd.get('private_flag') === 'true',
        created_at: new Date().toISOString(),
      };
      if (!draft.subject || !draft.question) return;
      const drafts = readLocalDrafts();
      drafts.unshift(draft);
      writeLocalDrafts(drafts);
      form.reset();
      if (msg) {
        msg.style.display = 'block';
        msg.innerHTML = `<strong>${esc(draft.number)} saved.</strong> Local draft created in the Documents RFI portal. Issuing/distribution still requires backend/auth approval workflow.`;
      }
      onCreate();
      location.hash = 'queue';
    });
    if (clear) clear.addEventListener('click', () => {
      if (!readLocalDrafts().length) return;
      if (!confirm('Clear locally saved draft RFIs from this browser?')) return;
      writeLocalDrafts([]);
      if (msg) { msg.style.display = 'block'; msg.textContent = 'Local draft RFIs cleared from this browser.'; }
      onCreate();
    });
  }

  // ---------- main ----------
  (async () => {
    let rfi;
    try {
      rfi = await loadJson('/safe-data/projects/golden-hill/rfi-summary.json');
    } catch (err) {
      const tbody = document.querySelector('[data-rfi-rows]');
      if (tbody) tbody.innerHTML = rowEmpty(6, 'RFI metadata unavailable', 'The data file is being refreshed.');
      console.error('[rfi]', err);
      return;
    }

    // Generated stamp
    const genEl = document.querySelector('[data-generated]');
    if (genEl) genEl.textContent = `Generated ${rfi.generatedAt || 'from local metadata'} · Source: ${rfi.source || 'CAST BUILD A.O export'}`;

    // KPIs
    setText('[data-total]', rfi.folderRfiPdfCount || rfi.total);
    setText('[data-open]', (rfi.openCount || 0) + (rfi.draftCount || 0));
    setText('[data-overdue]', rfi.overdueOpen);
    setText('[data-seven]', rfi.dueWithin7Days);

    // Captions
    setText('[data-total-caption]', `Across ${Object.keys(rfi.statusCounts || {}).length || 0} statuses`);
    setText('[data-open-caption]', `${rfi.openCount || 0} open · ${rfi.draftCount || 0} draft`);
    const overdueCaptionEl = document.querySelector('[data-overdue-caption]');
    if (overdueCaptionEl) {
      const o = rfi.overdueOpen || 0;
      overdueCaptionEl.textContent = o ? 'Past due — review immediately' : 'On track';
      overdueCaptionEl.style.color = o ? 'var(--danger)' : 'var(--success)';
    }
    setText('[data-seven-caption]', (rfi.dueWithin7Days || 0) ? 'Coming up — confirm responders' : 'No imminent deadlines');

    // Secondary metrics
    setText('[data-cost]', rfi.costImpactYes);
    setText('[data-schedule]', rfi.scheduleImpactYes);
    setText('[data-nodue]', rfi.openNoDueDate);
    setText('[data-closed]', rfi.closedCount);

    // Action queue rows — annotate with overdue/due7 flags for filtering
    const today = new Date();
    let queueRaw = [...readLocalDrafts().map(localDraftToQueue), ...(((rfi.openItems && rfi.openItems.length) ? rfi.openItems : (rfi.folderItems || rfi.recentItems || [])) || [])];
    queueRaw.forEach((x) => {
      const d = x['Due Date'] ? new Date(x['Due Date']) : null;
      x._overdue = d && d < today && /open|draft/i.test(x.Status || '');
      x._due7 = d && (d - today) >= 0 && (d - today) < 7 * 86400000;
    });

    const tbody = document.querySelector('[data-rfi-rows]');
    const countEl = document.querySelector('[data-rfi-count]');
    function renderQueue(rows) {
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = rowEmpty(6, 'No matching RFIs', 'Adjust filters or clear the search to see more.');
        if (countEl) countEl.textContent = '0 shown';
        return;
      }
      tbody.innerHTML = rows.map((x) => {
        const num = `${esc(x.Number || '—')}${x.Revision && x.Revision !== '0' ? '.' + esc(x.Revision) : ''}`;
        const due = x['Due Date']
          ? `<span style="color:${x._overdue ? 'var(--danger)' : x._due7 ? 'var(--warning)' : 'inherit'}">${esc(x['Due Date'])}</span>`
          : '<span class="cb-td-muted">—</span>';
        const ball = x['Ball In Court'] || x['Assigned Id'] || x['RFI Manager'] || x.sourceKind || '—';
        return `<tr>
          <td>${num}</td>
          <td><strong style="color:var(--dark)">${esc(x.Subject || '')}</strong>${x._localDraft ? '<br><span class="cb-td-muted">Local draft · not issued</span>' : ''}</td>
          <td>${statusPill(x.Status)}</td>
          <td>${esc(ball)}</td>
          <td class="cb-td-num">${due}</td>
          <td class="cb-td-muted">${safeStep(x)}</td>
        </tr>`;
      }).join('');
      if (countEl) countEl.textContent = `${rows.length} of ${queueRaw.length} shown`;
    }
    function annotateQueueRows() {
      queueRaw.forEach((x) => {
        const d = x['Due Date'] ? new Date(x['Due Date']) : null;
        x._overdue = d && d < today && /open|draft/i.test(x.Status || '');
        x._due7 = d && (d - today) >= 0 && (d - today) < 7 * 86400000;
      });
    }
    let applyFilters = () => renderQueue(queueRaw);
    function refreshQueueFromDrafts() {
      queueRaw = [...readLocalDrafts().map(localDraftToQueue), ...(((rfi.openItems && rfi.openItems.length) ? rfi.openItems : (rfi.folderItems || rfi.recentItems || [])) || [])];
      annotateQueueRows();
      applyFilters();
    }
    renderQueue(queueRaw);
    applyFilters = setupFilters(() => queueRaw, renderQueue);
    setupCreateRfi(refreshQueueFromDrafts);

    // Status distribution
    const statuses = Object.entries(rfi.statusCounts || {}).sort((a, b) => b[1] - a[1]);
    const statusBody = document.querySelector('[data-status-rows]');
    if (statusBody) {
      statusBody.innerHTML = statuses.length
        ? statuses.map(([status, count]) =>
          `<tr><td>${statusPill(status)}</td><td class="cb-td-num">${fmtNum(count)}</td><td class="cb-td-num">${pct(count, rfi.total || 0)}</td></tr>`
        ).join('')
        : rowEmpty(3, 'No status data', 'Status breakdown will appear once metadata is loaded.');
    }

    // Managers / contractors
    const mgrBody = document.querySelector('[data-manager-rows]');
    if (mgrBody) mgrBody.innerHTML = rowsFromPairs(rfi.topManagers, 'No manager data');
    const subBody = document.querySelector('[data-contractor-rows]');
    if (subBody) subBody.innerHTML = rowsFromPairs(rfi.topContractors, 'No contractor data');

    setupTabs();
  })();
})();
