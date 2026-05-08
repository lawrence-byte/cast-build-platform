// Alüm — project home dashboard.
// Loads RFI summary, submittal summary, and project control center; renders KPIs,
// Chart.js donut/bar/line charts, coordination focus list, recent activity table.
// Read-first replica. No write actions.

(function () {
  'use strict';

  // ---------- helpers ----------
  async function loadJson(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status} ${path}`);
    return r.json();
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString(); }
  function fmtMoney(n, opts) {
    const o = opts || {};
    const sign = n < 0 ? '-' : (o.alwaysSign ? '+' : '');
    const abs = Math.abs(Number(n || 0));
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'k';
    return sign + '$' + abs.toFixed(0);
  }
  function setText(sel, v, fallback) {
    const el = document.querySelector(sel);
    if (!el) return;
    if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) {
      el.textContent = fallback ?? '—';
    } else {
      el.textContent = typeof v === 'number' ? fmtNum(v) : String(v);
    }
  }
  function setHTML(sel, html) {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = html;
  }
  function statusPill(s) {
    const t = String(s || '');
    const lower = t.toLowerCase();
    let k = 'neutral';
    if (lower.includes('open')) k = 'open';
    else if (lower.includes('draft')) k = 'draft';
    else if (lower.includes('closed') || lower.includes('approved')) k = 'closed';
    else if (lower.includes('progress') || lower.includes('revise')) k = 'progress';
    else if (lower.includes('overdue') || lower.includes('void')) k = 'neutral';
    return `<span class="cb-pill cb-pill--${k}">${esc(t || 'Unknown')}</span>`;
  }

  // ---------- chart helpers ----------
  // Brand-aligned palette
  const PALETTE = {
    bison:    '#45282C',
    sand:     '#BFB8A2',
    sandLite: '#D4C9B2',
    info:     '#7A8B9A',
    success:  '#5A7A5A',
    warning:  '#A68B4B',
    danger:   '#8B4A4A',
    graphite: '#3D3D3D',
    muted:    '#666666',
    ivory:    '#F5F3EF',
    linen:    '#EEE9DF',
  };
  const PIE_COLORS = [
    PALETTE.bison, PALETTE.info, PALETTE.warning, PALETTE.success,
    PALETTE.sand, PALETTE.danger, PALETTE.graphite, PALETTE.sandLite,
  ];

  // Wait for Chart.js (it's loaded with `defer`, so may arrive after this file).
  function whenChart(cb) {
    if (window.Chart) return cb(window.Chart);
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (window.Chart) { clearInterval(t); cb(window.Chart); }
      else if (n > 60) { clearInterval(t); console.warn('Chart.js never loaded'); }
    }, 100);
  }

  function setChartDefaults(Chart) {
    Chart.defaults.font.family = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = PALETTE.graphite;
    Chart.defaults.borderColor = 'rgba(212, 201, 178, 0.4)';
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.legend.labels.font = { size: 10 };
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(20, 20, 20, 0.92)';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 0;
    Chart.defaults.plugins.tooltip.titleFont = { size: 11, weight: '600' };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 11 };
  }

  function donut(ctx, labels, data, Chart) {
    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
          borderColor: PALETTE.ivory,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            align: 'center',
            labels: { boxWidth: 8, boxHeight: 8, padding: 10, font: { size: 10 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${fmtNum(ctx.raw)} (${Math.round(ctx.raw / data.reduce((a,b) => a+b, 0) * 100)}%)`,
            },
          },
        },
      },
    });
  }

  function horizontalBar(ctx, labels, data, Chart) {
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE.bison,
          borderRadius: 0,
          barThickness: 14,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(212,201,178,.4)', drawBorder: false },
            ticks: { font: { size: 10 } },
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10 } },
          },
        },
      },
    });
  }

  function lineChart(ctx, labels, data, Chart) {
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Updates',
          data,
          borderColor: PALETTE.bison,
          backgroundColor: 'rgba(69, 40, 44, 0.08)',
          tension: 0.32,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: PALETTE.bison,
          borderWidth: 1.6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(212,201,178,.4)', drawBorder: false },
            ticks: { font: { size: 10 }, precision: 0 },
          },
        },
      },
    });
  }

  // ---------- main ----------
  (async () => {
    let rfi, sub, pcc;
    try {
      [rfi, sub, pcc] = await Promise.all([
        loadJson('/data/projects/golden-hill/rfi-summary.json'),
        loadJson('/data/projects/golden-hill/submittal-summary.json'),
        loadJson('/data/projects/golden-hill/project-control-center.json'),
      ]);
    } catch (err) {
      console.error('[home] data load failed', err);
      const main = document.querySelector('.project-main-content');
      if (main) {
        main.insertAdjacentHTML('afterbegin',
          `<div class="cb-callout cb-callout--danger"><strong>Could not load metadata</strong> ${esc(err.message)}</div>`);
      }
      return;
    }

    const ms = (pcc && pcc.management_snapshot) || {};
    const recent = (pcc && pcc.recent_activity) || [];

    // ------- generated stamp -------
    setText('[data-generated]', `Generated ${pcc.generated_at || rfi.generatedAt || 'from local metadata'}`);

    // ------- KPI cards -------
    setText('[data-kpi-rfis]', ms.open_rfis ?? rfi.openCount ?? 0);
    setText('[data-kpi-rfis-caption]', `${rfi.draftCount || 0} draft · ${rfi.total || 0} total`);

    const overdueAll = (ms.overdue_rfis || 0) + (sub.revise_resubmit_submittals || 0);
    setText('[data-kpi-overdue]', overdueAll || ms.overdue_rfis || 0);
    const overdueEl = document.querySelector('[data-kpi-overdue-caption]');
    if (overdueEl) {
      overdueEl.textContent = (ms.overdue_rfis || 0) ? `${ms.overdue_rfis} RFI · ${rfi.dueWithin7Days || 0} due 7d` : 'On track';
      overdueEl.style.color = (ms.overdue_rfis || 0) ? 'var(--danger)' : 'var(--success)';
    }

    setText('[data-kpi-submittals]', ms.open_or_draft_submittals ?? sub.openOrDraftCount ?? 0);
    setText('[data-kpi-submittals-caption]', `${ms.revise_resubmit_submittals || 0} revise/resubmit · ${sub.total || 0} total`);

    setText('[data-kpi-workpkgs]', ms.active_work_packages ?? '—');
    setText('[data-kpi-workpkgs-caption]', `${ms.starts_soon_work_packages || 0} starts soon · ${ms.verify_complete_work_packages || 0} to verify`);

    const variance = ms.projected_over_under;
    const varEl = document.querySelector('[data-kpi-variance]');
    if (varEl) {
      varEl.textContent = (variance == null) ? '—' : fmtMoney(variance);
      varEl.style.color = variance < 0 ? 'var(--danger)' : variance > 0 ? 'var(--success)' : 'var(--graphite)';
    }
    setText('[data-kpi-variance-caption]', variance == null ? '—' : variance < 0 ? 'Projected over budget' : 'Projected under budget');

    setText('[data-kpi-committed]', ms.committed_percent_of_revised == null ? '—' : `${ms.committed_percent_of_revised.toFixed(1)}%`);
    setText('[data-kpi-committed-caption]', 'Buyout coverage vs revised budget');

    // ------- charts -------
    whenChart((Chart) => {
      setChartDefaults(Chart);

      // RFI status donut
      const rfiEntries = Object.entries(rfi.statusCounts || {}).sort((a, b) => b[1] - a[1]);
      const rfiCanvas = document.getElementById('chart-rfi-status');
      if (rfiCanvas && rfiEntries.length) {
        donut(rfiCanvas, rfiEntries.map(([k]) => k), rfiEntries.map(([_, v]) => v), Chart);
        setText('[data-chart-rfi-count]', `${fmtNum(rfi.total || 0)} total`);
      }

      // Submittal status donut — collapse "Void" since it's the dominant bucket and dwarfs the rest
      const subEntries = Object.entries(sub.statusCounts || {})
        .filter(([k]) => k.toLowerCase() !== 'void')
        .sort((a, b) => b[1] - a[1]);
      const subCanvas = document.getElementById('chart-sub-status');
      if (subCanvas && subEntries.length) {
        donut(subCanvas, subEntries.map(([k]) => k), subEntries.map(([_, v]) => v), Chart);
        setText('[data-chart-sub-count]', `${fmtNum(sub.total || 0)} total · void hidden`);
      }

      // Activity by area bar
      const areaCounts = {};
      recent.forEach((r) => { areaCounts[r.area || 'Other'] = (areaCounts[r.area || 'Other'] || 0) + 1; });
      const areaEntries = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const areaCanvas = document.getElementById('chart-activity-area');
      if (areaCanvas && areaEntries.length) {
        horizontalBar(areaCanvas,
          areaEntries.map(([k]) => k.length > 32 ? k.slice(0, 30) + '…' : k),
          areaEntries.map(([_, v]) => v),
          Chart);
      }

      // Activity over time — bucket by week
      if (recent.length) {
        const buckets = {};
        recent.forEach((r) => {
          const d = new Date(r.updated_at);
          if (isNaN(d)) return;
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay()); // Sunday start
          const key = weekStart.toISOString().slice(0, 10);
          buckets[key] = (buckets[key] || 0) + 1;
        });
        const sortedKeys = Object.keys(buckets).sort();
        const timeCanvas = document.getElementById('chart-activity-time');
        if (timeCanvas && sortedKeys.length) {
          lineChart(timeCanvas,
            sortedKeys.map((k) => {
              const d = new Date(k);
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            sortedKeys.map((k) => buckets[k]),
            Chart);
        }
      }
    });

    // ------- top spec sections -------
    const specRows = (sub.topSpecSections || []).slice(0, 8).map(([name, count]) =>
      `<tr><td style="font-size:.78rem">${esc(name)}</td><td class="cb-td-num" style="text-align:right">${fmtNum(count)}</td></tr>`
    ).join('');
    setHTML('[data-spec-rows]', specRows || '<tr><td colspan="2" style="padding:18px;color:var(--muted)">No spec section data yet.</td></tr>');

    // ------- coordination focus -------
    const cf = pcc.coordination_focus || [];
    if (cf.length) {
      const html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;padding-top:6px">${
        cf.map((f) => `
          <a href="${esc(f.link || '#')}" style="text-decoration:none;color:inherit;display:block;border:1px solid var(--sand-light);border-left:3px solid var(--bison);padding:18px 18px 16px;background:var(--white);transition:box-shadow .2s ease" onmouseover="this.style.boxShadow='0 12px 28px rgba(20,20,20,.06)'" onmouseout="this.style.boxShadow='none'">
            <div style="font-family:var(--font-caption);font-size:.62rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--bison);margin-bottom:8px">${esc(f.lane || '')}</div>
            <div style="font-family:var(--font-heading);font-size:1.05rem;color:var(--dark);margin-bottom:6px;line-height:1.35">${esc(f.signal || '')}</div>
            <div style="font-size:.84rem;color:var(--muted);line-height:1.55;margin-bottom:10px">${esc(f.management_move || '')}</div>
            <div style="font-family:var(--font-caption);font-size:.6rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--graphite);opacity:.7">Owner: ${esc(f.owner || '—')}</div>
          </a>`).join('')
      }</div>`;
      setHTML('[data-coord-focus]', html);
    } else {
      setHTML('[data-coord-focus]', '<div class="cb-empty" style="border:none;padding:32px"><h3>No coordination items</h3><p>Coordination focus will appear once project metadata is generated.</p></div>');
    }

    // ------- recent activity feed (top 12) -------
    const recentTop = recent.slice(0, 12);
    setText('[data-recent-count]', `${recent.length} updates · top ${recentTop.length} shown`);
    const tbody = document.querySelector('[data-recent-rows]');
    if (tbody) {
      tbody.innerHTML = recentTop.length
        ? recentTop.map((r) => `<tr>
            <td style="font-variant-numeric:tabular-nums;color:var(--muted);font-size:.82rem">${esc(r.updated_at || '—')}</td>
            <td><span class="cb-pill cb-pill--neutral">${esc((r.area || 'Other').split('/')[0].trim())}</span></td>
            <td style="font-size:.88rem">${esc(r.title || '')}</td>
            <td class="cb-td-num cb-td-muted" style="text-align:right">${r.size_kb ? fmtNum(r.size_kb) + ' KB' : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--muted)">No recent activity available.</td></tr>';
    }
  })();
})();
