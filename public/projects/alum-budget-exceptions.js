const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
const pct=n=>`${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0})}%`;
let budget, audit, revisions, forecast, exceptions=[];
const flagLabels={overrun:'Projected O/U negative',pending:'Pending cost changes',eac:'EAC exceeds revised budget',lowCommitment:'Low commitment coverage',oddCommitment:'Odd commitment coverage',audit:'Audit/reconciliation issue',forecast:'Forecast overrun'};
function metric(sel,val){const el=document.querySelector(sel);if(el)el.textContent=val}
async function fetchJson(url){const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error(`${url} returned ${r.status}`);return r.json()}
function addFlag(flags,key,severity,detail,action,exposure=0){flags.push({key,severity,detail,action,exposure})}
function coverage(row){const revised=Number(row['Revised Budget']||0);const committed=Number(row['Committed Costs']||0);return revised?committed/revised*100:0}
function revisionMap(){const map=new Map();for(const x of revisions?.byBudgetCode||[])map.set(String(x.budgetCode),x);return map}
function forecastMap(){const map=new Map();for(const x of forecast?.rows||[])map.set(String(x['Budget Code']),x);return map}
function reconciliationIsClear(rec){return rec&&(['pass','matches_current_budget_approved_budget_changes','matches_current_budget'].includes(rec.status)||String(rec.status||'').startsWith('matches_current_budget'))&&!rec.mismatchCount&&!(rec.missingFromCurrentBudget||[]).length}
function reconciliationIssueCodes(){const rec=revisions?.currentBudgetReconciliation;const codes=new Set();for(const x of rec?.mismatches||[])codes.add(String(x.budgetCode||x['Budget Code']||''));for(const x of rec?.missingFromCurrentBudget||[])codes.add(String(x.budgetCode||x['Budget Code']||x||''));return codes}
function buildExceptions(){
  const revs=revisionMap(), fc=forecastMap(), recCodes=reconciliationIssueCodes();
  exceptions=(budget.rows||[]).map(row=>{
    const flags=[];const revised=Number(row['Revised Budget']||0);const eac=Number(row['Estimated Cost at Completion']||0);const ou=Number(row['Projected over Under']||0);const pending=Number(row['Pending Cost Changes']||0);const committed=Number(row['Committed Costs']||0);const jtd=Number(row['Job to Date Costs']||0);const cov=coverage(row);const f=fc.get(String(row['Budget Code']));const forecastOU=Number(f?.['Projected over Under']||0);
    if(ou<0)addFlag(flags,'overrun','critical',`Projected over/under is ${money(ou)}.`,`Confirm EAC, identify funding source, and prepare change/transfer path.`,Math.abs(ou));
    if(pending>0)addFlag(flags,'pending','critical',`${money(pending)} in pending cost changes.`,`Tie pending cost change to PCO/CO status and decide whether budget revision is needed.`,pending);
    if(eac>revised)addFlag(flags,'eac','critical',`EAC exceeds revised budget by ${money(eac-revised)}.`,`Review committed, JTD, and forecast-to-complete assumptions.`,eac-revised);
    if(revised>0&&committed===0&&jtd>0)addFlag(flags,'oddCommitment','warning',`JTD ${money(jtd)} exists with no commitments.`,`Confirm whether this row is direct/self-perform or missing commitment coverage.`);
    else if(revised>25000&&committed>0&&cov<50)addFlag(flags,'lowCommitment','warning',`Commitments cover ${pct(cov)} of revised budget.`,`Check whether procurement/commitment entry is incomplete or intentionally uncommitted.`);
    if(revised>0&&committed>revised*1.15)addFlag(flags,'oddCommitment','review',`Commitments are ${pct(cov)} of revised budget.`,`Confirm buyout/commitment amount and whether an offsetting revision is pending.`,committed-revised);
    if(f&&forecastOU<0&&forecastOU!==ou)addFlag(flags,'forecast','warning',`Forecast export shows ${money(forecastOU)} projected O/U.`,`Compare budget detail and forecast export assumptions.`,Math.abs(forecastOU));
    if(recCodes.has(String(row['Budget Code'])))addFlag(flags,'audit','critical','Budget revision reconciliation references this code.','Review budget revision register mismatch/missing-code detail before external reporting.');
    const rev=revs.get(String(row['Budget Code']));
    return {row,flags,revision:rev,forecast:f,severity:flags.some(x=>x.severity==='critical')?'critical':flags.some(x=>x.severity==='warning')?'warning':'review',exposure:flags.reduce((s,x)=>s+Number(x.exposure||0),0),coverage:cov};
  }).filter(x=>x.flags.length).sort((a,b)=>({critical:0,warning:1,review:2}[a.severity]-{critical:0,warning:1,review:2}[b.severity])||b.exposure-a.exposure);
}
function auditIssues(){
  const issues=[];
  for(const c of audit?.checks||[]) if(c.status!=='pass') issues.push({source:'Budget audit',status:c.status,detail:`${c.label}${c.delta!=null?`: ${c.delta}`:''}`,action:'Resolve source export or parser mismatch before relying on this row.'});
  const rec=revisions?.currentBudgetReconciliation;
  if(!rec) issues.push({source:'Budget revisions',status:'missing',detail:'Revision reconciliation data unavailable.',action:'Run intake:budget-revisions and re-check current budget ties.'});
  else if(!reconciliationIsClear(rec)) issues.push({source:'Budget revisions',status:rec.status,detail:`${rec.mismatchCount||0} mismatches; ${rec.missingFromCurrentBudget?.length||0} revision budget codes missing from current budget.`,action:'Review budget revision register against current budget export.'});
  if(audit&&audit.status!=='pass'&&!issues.some(x=>x.source==='Budget audit')) issues.push({source:'Budget audit',status:audit.status,detail:'Budget audit status is not pass.',action:'Open Budget Input + Audit and investigate failed checks.'});
  return issues;
}
function renderSummary(){
  const critical=exceptions.filter(x=>x.severity==='critical').length;const pending=exceptions.filter(x=>x.flags.some(f=>f.key==='pending')).length;const issues=auditIssues();
  metric('[data-total]',exceptions.length);metric('[data-critical]',critical);metric('[data-pending]',pending);metric('[data-audit-count]',issues.length);metric('[data-audit-caption]',issues.length?'needs review':'audit/revisions clear');
  metric('[data-generated]',`${budget.metrics.rowCount} budget rows checked from ${budget.sourceFile}. Budget generated ${budget.generatedAt}; forecast generated ${forecast?.generatedAt||'unavailable'}.`);
}
function renderActions(){
  const queues=[
    ['Overrun / EAC Review',exceptions.filter(x=>x.flags.some(f=>['overrun','eac','forecast'].includes(f.key))).length,'Validate EAC/forecast assumptions and decide funding path.'],
    ['Pending Cost Change Tie-out',exceptions.filter(x=>x.flags.some(f=>f.key==='pending')).length,'Match each pending amount to PCO/CO status.'],
    ['Commitment Coverage Review',exceptions.filter(x=>x.flags.some(f=>['lowCommitment','oddCommitment'].includes(f.key))).length,'Confirm missing, direct-cost, or over-committed coverage.'],
    ['Audit / Reconciliation',auditIssues().length,'Resolve failed checks before external reporting.']
  ].filter(x=>x[1]>0);
  metric('[data-action-count]',`${queues.length} active queues`);
  document.querySelector('[data-action-rows]').innerHTML=queues.map(x=>`<tr><td><strong>${esc(x[0])}</strong></td><td>${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('')||'<tr><td colspan="3">No active queues.</td></tr>';
  const keys=[...new Set(exceptions.flatMap(x=>x.flags.map(f=>f.key)))];
  document.querySelector('#flagFilter').innerHTML='<option value="">All flags</option>'+keys.map(k=>`<option value="${esc(k)}">${esc(flagLabels[k]||k)}</option>`).join('');
  const mix=keys.map(k=>{const rows=exceptions.filter(x=>x.flags.some(f=>f.key===k));return {k,count:rows.length,exposure:rows.reduce((s,x)=>s+x.flags.filter(f=>f.key===k).reduce((a,f)=>a+Number(f.exposure||0),0),0)}}).sort((a,b)=>b.count-a.count);
  document.querySelector('[data-flag-rows]').innerHTML=mix.map(x=>`<tr><td>${esc(flagLabels[x.k]||x.k)}</td><td>${x.count}</td><td class="money">${money(x.exposure)}</td></tr>`).join('');
}
function renderRows(){
  const q=document.querySelector('#q').value.toLowerCase();const flag=document.querySelector('#flagFilter').value;const sev=document.querySelector('#severityFilter').value;
  const shown=exceptions.filter(x=>(!flag||x.flags.some(f=>f.key===flag))&&(!sev||x.severity===sev)&&(!q||[x.row['Budget Code'],x.row['Budget Code Description'],x.row['Cost Code Tier 1'],x.row['Cost Type'],x.flags.map(f=>f.detail).join(' ')].join(' ').toLowerCase().includes(q)));
  document.querySelector('#rowCount').textContent=`${shown.length} of ${exceptions.length} exception rows`;
  document.querySelector('#exceptionRows').innerHTML=shown.map(x=>{const r=x.row;const action=x.flags.find(f=>f.severity==='critical')||x.flags[0];return `<tr class="severity-${x.severity}"><td><strong>${esc(r['Budget Code'])}</strong><br><span class="caption">${esc(r['Budget Code Description'])}</span><br><span class="caption">${esc(r['Cost Code Tier 1'])} · ${esc(r['Cost Type'])}</span></td><td>${x.flags.map(f=>`<span class="review-pill ${f.severity}">${esc(flagLabels[f.key]||f.key)}</span><br><span class="caption">${esc(f.detail)}</span>`).join('<br>')}</td><td class="money">${money(r['Revised Budget'])}</td><td class="money">${money(r['Estimated Cost at Completion'])}</td><td class="money ${Number(r['Projected over Under'])<0?'bad':'good'}">${money(r['Projected over Under'])}</td><td class="money">${money(r['Pending Cost Changes'])}</td><td>${pct(x.coverage)}<br><span class="caption">${money(r['Committed Costs'])} committed</span></td><td>${esc(action.action)}${x.revision?`<br><span class="caption">Revision net: ${money(x.revision.netAmount)}</span>`:''}</td></tr>`}).join('')||'<tr><td colspan="8">No exception rows match the filters.</td></tr>';
}
function renderAudit(){
  const issues=auditIssues();metric('[data-audit-status]',issues.length?'Needs review':'Audit/reconciliation clear');
  const el=document.querySelector('[data-audit-status]');if(el)el.className=`muted ${issues.length?'bad':'good'}`;
  document.querySelector('[data-audit-rows]').innerHTML=issues.map(x=>`<tr><td>${esc(x.source)}</td><td><span class="audit-pill ${x.status==='pass'?'pass':'fail'}">${esc(x.status)}</span></td><td>${esc(x.detail)}</td><td>${esc(x.action)}</td></tr>`).join('')||'<tr><td>Budget audit</td><td><span class="audit-pill pass">pass</span></td><td>Budget audit passed and revision reconciliation is clear.</td><td>Continue row-level exception review.</td></tr>';
}
(async()=>{[budget,audit,revisions,forecast]=await Promise.all([fetchJson('/data/projects/golden-hill/procore-information/budget/budget-summary.json'),fetchJson('/data/projects/golden-hill/procore-information/budget/budget-audit.json'),fetchJson('/data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json').catch(()=>null),fetchJson('/data/projects/golden-hill/procore-information/budget-forecast/forecast-summary.json').catch(()=>null)]);buildExceptions();renderSummary();renderActions();renderAudit();['q','flagFilter','severityFilter'].forEach(id=>document.querySelector('#'+id).addEventListener('input',renderRows));renderRows();})().catch(e=>document.body.insertAdjacentHTML('afterbegin',`<div class="note"><strong>Budget exceptions failed to load:</strong> ${esc(e.message)}</div>`));
