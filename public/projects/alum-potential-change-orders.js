const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const money = (n) => Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
async function loadJson(path) { const r = await fetch(path, { cache: 'no-store' }); if (!r.ok) throw new Error(path); return r.json(); }
function num(row, key) { return Number(row?.[key] || 0); }
function riskFor(amount) { if (amount >= 100000) return ['High', 'pco-risk--high']; if (amount >= 40000) return ['Medium', 'pco-risk--medium']; return ['Watch', 'pco-risk--watch']; }
function contingencyTie(amount, remaining) {
  if (!amount) return 'No quantified draw yet';
  const pct = remaining ? Math.round((amount / remaining) * 100) : 0;
  return `${money(amount)} potential draw · ${pct}% of remaining contingency`;
}
function pcoRowsFromBudget(budget) {
  const rows = [];
  const metrics = budget.metrics || {};
  const pending = Number(metrics['Pending Cost Changes'] || 0);
  if (pending > 0) {
    rows.push({ title: 'Pending cost changes awaiting contract disposition', source: 'Budget metric: Pending Cost Changes', code: 'Multiple / current budget', amount: pending, next: 'Reconcile pending cost changes to a PCO/COR or clear from forecast.' });
  }
  const projectedOver = Math.max(0, -Number(metrics['Projected over Under'] || 0));
  if (projectedOver > 0) {
    rows.push({ title: 'Projected cost overrun requiring change-control decision', source: 'Budget metric: Projected Over/Under', code: 'Project-level forecast', amount: projectedOver, next: 'Decide whether exposure is owner-change, contingency draw, or internal forecast correction.' });
  }
  (budget.topBudgetRiskRows || []).filter((r) => num(r, 'Projected over Under') < 0).slice(0, 8).forEach((r) => {
    rows.push({
      title: `${r.costCodeName || r['Budget Code Description'] || 'Budget risk'} exposure`,
      source: 'Budget risk / EAC exceeds revised budget',
      code: r['Budget Code'] || '—',
      description: r['Budget Code Description'] || r.costCodeName || '',
      amount: Math.abs(num(r, 'Projected over Under')),
      revised: num(r, 'Revised Budget'),
      next: 'Validate backup, identify responsible contract party, and decide PCO vs contingency use.',
    });
  });
  return rows;
}
(async function init() {
  const [room, budget, revisions] = await Promise.all([
    loadJson('/safe-data/projects/golden-hill/alum-data-room-index.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget/budget-summary.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json'),
  ]);
  const metrics = budget.metrics || {};
  const contingency = (budget.rows || []).find((r) => /contingency/i.test(`${r['Budget Code']} ${r['Budget Code Description']} ${r.costCodeName}`)) || {};
  const originalContingency = num(contingency, 'Original Budget Amount');
  const remainingContingency = num(contingency, 'Revised Budget');
  const drawdown = Math.max(0, originalContingency - remainingContingency);
  const pcos = pcoRowsFromBudget(budget).sort((a, b) => b.amount - a.amount);
  const totalExposure = pcos.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const projectedBalance = remainingContingency - totalExposure;
  const changeEvents = room.sections?.find((s) => s.key === '11. CHANGE EVENTS') || {};

  $('[data-generated]').textContent = `Generated ${budget.generatedAt || revisions.generatedAt || room.generatedAt || 'from metadata'}`;
  $('[data-pco-exposure]').textContent = money(totalExposure);
  $('[data-contingency-remaining]').textContent = money(remainingContingency);
  $('[data-coverage-after]').textContent = money(projectedBalance);
  $('[data-coverage-after]').style.color = projectedBalance < 0 ? 'var(--danger)' : 'var(--success)';
  $('[data-coverage-caption]').textContent = projectedBalance < 0 ? 'Potential exposure exceeds contingency' : 'Contingency covers current candidates';
  $('[data-pending-cost]').textContent = money(metrics['Pending Cost Changes'] || 0);
  $('[data-contingency-status]').textContent = `${pcos.length} PCO candidates · ${changeEvents.fileCount || 0} CE files indexed`;
  $('[data-contingency-original]').textContent = money(originalContingency);
  $('[data-contingency-drawdown]').textContent = money(drawdown);
  $('[data-contingency-current]').textContent = money(remainingContingency);
  $('[data-contingency-exposure]').textContent = money(totalExposure);
  $('[data-contingency-balance]').textContent = money(projectedBalance);
  $('[data-contingency-balance]').style.color = projectedBalance < 0 ? 'var(--danger)' : 'var(--success)';
  $('[data-pco-count]').textContent = `${pcos.length} candidates`;

  $('[data-pco-rows]').innerHTML = pcos.map((pco, idx) => {
    const [risk, cls] = riskFor(pco.amount);
    const balance = remainingContingency - pco.amount;
    return `<tr>
      <td><strong>PCO-${String(idx + 1).padStart(3, '0')}</strong><br>${esc(pco.title)}${pco.description ? `<br><span class="cb-td-muted">${esc(pco.description)}</span>` : ''}</td>
      <td>${esc(pco.source)}</td>
      <td>${esc(pco.code)}</td>
      <td class="cb-td-num" style="text-align:right">${money(pco.amount)}</td>
      <td>${esc(contingencyTie(pco.amount, remainingContingency))}<br><span class="cb-td-muted">Balance after this item: ${money(balance)}</span></td>
      <td><span class="pco-risk ${cls}">${risk}</span></td>
      <td>${esc(pco.next)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="padding:24px;color:var(--muted)">No quantified PCO candidates found in current sanitized budget metadata.</td></tr>';

  const riskRows = (budget.topBudgetRiskRows || []).filter((r) => num(r, 'Projected over Under') < 0).slice(0, 10);
  $('[data-budget-code-count]').textContent = `${riskRows.length} rows`;
  $('[data-budget-code-rows]').innerHTML = riskRows.map((r) => `<tr><td>${esc(r['Budget Code'] || '')}</td><td>${esc(r['Budget Code Description'] || r.costCodeName || '')}</td><td class="cb-td-num" style="text-align:right">${money(r['Projected over Under'])}</td><td class="cb-td-num" style="text-align:right">${money(r['Revised Budget'])}</td></tr>`).join('');
})().catch((err) => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="cb-callout cb-callout--danger"><strong>Contracts metadata unavailable:</strong> ${esc(err.message)}</div>`);
});
