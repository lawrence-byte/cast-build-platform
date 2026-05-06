const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
const pct=n=>`${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1})}%`;
const cls=n=>Number(n)<0?'bad':Number(n)>0?'good':'';
let data, audit, rows=[];
function metric(sel,val){const el=document.querySelector(sel); if(el) el.textContent=val}
function renderSummary(){const m=data.metrics;metric('[data-revised]',money(m['Revised Budget']));metric('[data-eac]',money(m['Estimated Cost at Completion']));metric('[data-overunder]',money(m['Projected over Under']));document.querySelector('[data-overunder]').className=`metric ${cls(m['Projected over Under'])}`;metric('[data-jtd]',money(m['Job to Date Costs']));metric('[data-owner]',money(m['Owner Invoiced cost to date']));metric('[data-committed]',money(m['Committed Costs']));metric('[data-pct]').textContent=`Committed ${pct(m.committedPctOfRevised)} · JTD ${pct(m.jtdPctOfRevised)}`;document.querySelector('[data-generated]').textContent=`${m.rowCount} active CAST BUILD A.O budget rows indexed from ${data.sourceFile}. Generated ${data.generatedAt}.`}
function renderBreakdowns(){document.querySelector('#divisionRows').innerHTML=(data.byDivision||[]).map(x=>`<tr><td><strong>${esc(x.key)}</strong><br><span class="caption">${esc(x.name)}</span></td><td class="money">${money(x['Revised Budget'])}</td><td class="money">${money(x['Estimated Cost at Completion'])}</td><td class="money ${cls(x['Projected over Under'])}">${money(x['Projected over Under'])}</td></tr>`).join('');document.querySelector('#riskRows').innerHTML=(data.topBudgetRiskRows||[]).slice(0,10).map(x=>`<tr><td><strong>${esc(x['Budget Code'])}</strong><br>${esc(x['Budget Code Description'])}</td><td>${esc(x['Cost Code Tier 1'])}</td><td class="money">${money(x['Revised Budget'])}</td><td class="money">${money(x['Estimated Cost at Completion'])}</td><td class="money bad">${money(x['Projected over Under'])}</td></tr>`).join('')}
function renderAudit(){
  const checks=audit?.checks||[];
  metric('[data-audit-status]', audit?.status==='pass'?'Audit passed':'Audit needs review');
  const statusEl=document.querySelector('[data-audit-status]'); if(statusEl) statusEl.className=`muted ${audit?.status==='pass'?'good':'bad'}`;
  metric('[data-input-source]', `${data.metrics?.rowCount||0} budget rows · revised budget ${money(data.metrics?.['Revised Budget'])} · EAC ${money(data.metrics?.['Estimated Cost at Completion'])}`);
  metric('[data-audit-summary]', audit?`${audit.summary.checkCount} checks · ${audit.summary.failedCheckCount} failed · ${audit.generatedAt}`:'Audit file unavailable; page is using embedded budget data.');
  const rev=(checks.find(x=>x.id==='budget-revisions-reconcile')||{});
  metric('[data-revision-audit]', rev.status==='pass'?'Approved budget revisions reconcile to current budget export.':'Revision reconciliation needs review or audit data is missing.');
  const rowsHtml=checks.map(x=>`<tr><td>${esc(x.label)}</td><td><span class="audit-pill ${x.status==='pass'?'pass':'fail'}">${esc(x.status)}</span></td><td>${esc(x.delta!=null?x.delta:(x.status||''))}</td></tr>`).join('');
  document.querySelector('[data-audit-rows]').innerHTML=rowsHtml||'<tr><td colspan="3">Budget audit data unavailable.</td></tr>';
}
function renderRows(){const q=document.querySelector('#q').value.toLowerCase();const div=document.querySelector('#divisionFilter').value;const type=document.querySelector('#typeFilter').value;let out=rows.filter(r=>(!div||r.division===div)&&(!type||r.costTypeCode===type)&&(!q||[r['Budget Code'],r['Budget Code Description'],r['Cost Code Tier 1'],r['Sub Job'],r['Cost Type']].join(' ').toLowerCase().includes(q)));document.querySelector('#rowCount').textContent=`${out.length} of ${rows.length} rows`;document.querySelector('#budgetRows').innerHTML=out.map(r=>`<tr><td><strong>${esc(r['Budget Code'])}</strong><br><span class="caption">${esc(r['Budget Code Description'])}</span></td><td>${esc(r['Cost Code Tier 1'])}</td><td><span class="pill">${esc(r.costTypeCode)}</span><br><span class="caption">${esc(r.costTypeName)}</span></td><td class="money">${money(r['Revised Budget'])}</td><td class="money">${money(r['Committed Costs'])}</td><td class="money">${money(r['Job to Date Costs'])}</td><td class="money">${money(r['Estimated Cost at Completion'])}</td><td class="money ${cls(r['Projected over Under'])}">${money(r['Projected over Under'])}</td></tr>`).join('')}
function opts(sel,arr,label){sel.innerHTML=`<option value="">${label}</option>`+arr.map(x=>`<option value="${esc(x.key||x)}">${esc(x.key||x)}${x.name?' - '+esc(x.name):''}</option>`).join('')}
async function fetchJson(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'}); if(!r.ok) throw new Error(`${url} returned ${r.status}`); return r.json();}
async function loadBudget(){
  if(window.__ALUM_BUDGET_SUMMARY__) return window.__ALUM_BUDGET_SUMMARY__;
  const urls=['/data/projects/golden-hill/procore-information/budget/budget-summary.json','../data/projects/golden-hill/procore-information/budget/budget-summary.json'];
  let lastErr;
  for(const url of urls){try{return await fetchJson(url)}catch(e){lastErr=e}}
  throw lastErr||new Error('Budget summary missing');
}
async function loadAudit(){try{return await fetchJson('/data/projects/golden-hill/procore-information/budget/budget-audit.json')}catch(_){return null}}
(async()=>{[data,audit]=await Promise.all([loadBudget(),loadAudit()]);rows=data.rows||[];renderSummary();renderBreakdowns();renderAudit();opts(document.querySelector('#divisionFilter'),data.byDivision||[],'All divisions');opts(document.querySelector('#typeFilter'),data.byCostType||[],'All cost types');['q','divisionFilter','typeFilter'].forEach(id=>document.querySelector('#'+id).addEventListener('input',renderRows));renderRows();})().catch(e=>document.body.insertAdjacentHTML('afterbegin',`<div class="note"><strong>Budget failed to load:</strong> ${esc(e.message)}</div>`));
