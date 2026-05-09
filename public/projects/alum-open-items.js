async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function money(n){return Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});}
function statusPill(s){const k=String(s||'').toLowerCase().includes('draft')?'draft':String(s||'').toLowerCase().includes('open')||String(s||'').toLowerCase().includes('approved')?'open':'';return `<span class="pill ${k}">${esc(s||'—')}</span>`;}
function dueStep(due){return due&&due!=='—'?`Confirm owner/reviewer path before ${due}`:'Confirm owner/reviewer path';}
function changeStep(change){return change.net===0?'Keep for audit trail; monitor tied budget codes':'Verify non-zero budget impact with accounting';}
function severityPill(s){return `<span class="pill ${s==='critical'?'open':s==='warning'?'draft':''}">${esc(s)}</span>`;}
function rfiPriority(x){return {priority:String(x.Aging||'').includes('Overdue')?'critical':/draft/i.test(x.Status||'')?'review':'warning',module:'RFI',item:`${x.Number||'—'} · ${x.Subject||''}`,owner:x['Ball In Court']||x['Assigned Id']||x['RFI Manager']||'—',signal:x['Due Date']||x.Status||'—',next:String(x.Aging||'').includes('Overdue')?'Escalate reviewer path and confirm response date.':dueStep(x['Due Date'])};}
function subPriority(x){return {priority:/revise/i.test(x.Status||'')?'warning':/draft/i.test(x.Status||'')?'review':'warning',module:'Submittal',item:`${x['Submittal Number']||'—'} · ${x.Title||''}`,owner:x['Responsible Contractor']||x['Ball In Court']||'—',signal:x['Final Due Date']||x.Status||'—',next:/revise/i.test(x.Status||'')?'Confirm revision owner and resubmittal scope.':dueStep(x['Final Due Date'])};}
function changePriority(x){return {priority:Number(x.net||0)!==0?'warning':'review',module:'Change Control',item:`#${x.number||'—'} · ${x.name||''}`,owner:'Budget controls',signal:money(x.net||0),next:changeStep(x)};}
function rank(p){return {critical:0,warning:1,review:2,monitor:3}[p]??4;}
function xPriority(x){return x.priority||x.severity||'review';}
(async()=>{
  const [rfi,sub,changes,budget,acct,doc]=await Promise.all([
    loadJson('/safe-data/projects/golden-hill/rfi-summary.json'),
    loadJson('/safe-data/projects/golden-hill/submittal-summary.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget/budget-summary.json').catch(()=>({})),
    loadJson('/safe-data/projects/golden-hill/accounting-budget/accounting-budget-tieout.json'),
    loadJson('/safe-data/projects/golden-hill/document-intelligence/summary.json').catch(()=>({}))
  ]);
  document.querySelector('[data-generated]').textContent=`Generated from exports · ${esc(rfi.generatedAt||sub.generatedAt||changes.generatedAt||'local metadata')}`;
  document.querySelector('[data-rfi-summary]').textContent=`${rfi.openCount||0} open/draft of ${rfi.total||0}; ${rfi.overdueOpen||0} overdue.`;
  document.querySelector('[data-submittal-summary]').textContent=`${sub.openOrDraftCount||0} open/draft of ${sub.total||0}.`;
  document.querySelector('[data-change-summary]').textContent=`${changes.totals?.changeCount||0} approved budget changes; ${money(changes.totals?.net||0)} net.`;
  document.querySelector('[data-exec-summary]').textContent=`${(acct.exceptions||[]).length} accounting exceptions; executive report rolls up all queues.`;

  const rfiQueue=(rfi.openItems||rfi.recentItems||[]).slice(0,20);
  document.querySelector('[data-rfi-count]').textContent=`${rfiQueue.length} shown`;
  document.querySelector('[data-rfi-open]').textContent=rfi.openCount||0;
  document.querySelector('[data-rfi-overdue]').textContent=rfi.overdueOpen||0;
  document.querySelector('[data-rfi-seven]').textContent=rfi.dueWithin7Days||0;
  document.querySelector('[data-rfi-total]').textContent=rfi.total||0;
  document.querySelector('[data-rfi-queue]').innerHTML=rfiQueue.map(x=>`<tr><td>${esc(x.Number||'—')}</td><td>${esc(x.Subject||'')}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Ball In Court']||x['Assigned Id']||x['RFI Manager']||'—')}</td><td>${esc(x['Due Date']||'—')}</td><td class="nextstep">${esc(dueStep(x['Due Date']))}</td></tr>`).join('') || '<tr><td colspan="6">No open RFI items found in metadata.</td></tr>';

  const subQueue=(sub.sampleItems||[]).filter(x=>/open|draft|revise/i.test(x.Status||'')).slice(0,20);
  document.querySelector('[data-submittal-count]').textContent=`${subQueue.length} shown`;
  document.querySelector('[data-sub-open]').textContent=sub.openOrDraftCount||0;
  document.querySelector('[data-sub-total]').textContent=sub.total||0;
  document.querySelector('[data-sub-draft]').textContent=sub.statusCounts?.Draft||0;
  document.querySelector('[data-sub-revise]').textContent=sub.statusCounts?.['Revise & Resubmit']||0;
  document.querySelector('[data-submittal-queue]').innerHTML=subQueue.map(x=>`<tr><td>${esc(x['Submittal Number']||'—')}</td><td>${esc(x.Title||'')}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Responsible Contractor']||x['Ball In Court']||'—')}</td><td>${esc(x['Final Due Date']||'—')}</td><td class="nextstep">${esc(dueStep(x['Final Due Date']))}</td></tr>`).join('') || '<tr><td colspan="6">No open submittal items found in sample metadata.</td></tr>';

  const changeQueue=(changes.changes||[]).slice(-12).reverse();
  document.querySelector('[data-change-count]').textContent=`${changeQueue.length} shown`;
  document.querySelector('[data-change-queue]').innerHTML=changeQueue.map(x=>`<tr><td>#${esc(x.number||'—')}</td><td>${esc(x.name||'')}</td><td>${statusPill(x.status)}</td><td>${esc(x.adjustmentCount||0)} groups · ${esc(x.lineCount||0)} lines</td><td>${money(x.net||0)}</td><td class="nextstep">${esc(changeStep(x))}</td></tr>`).join('') || '<tr><td colspan="6">No budget revisions found.</td></tr>';

  const critical=(window.AlumCriticalItems?.buildCriticalItems?.({rfi,sub,budget,acct,doc})||[...rfiQueue.map(rfiPriority),...subQueue.map(subPriority),...changeQueue.filter(x=>Number(x.net||0)!==0).map(changePriority),...(acct.exceptions||[]).map(e=>({priority:e.severity==='high'?'critical':'warning',module:'Accounting',item:e.check||'Tie-out exception',owner:'Accounting controls',signal:money(e.delta),next:e.nextStep||'Review reconciliation mapping.'}))]).sort((a,b)=>rank(xPriority(a))-rank(xPriority(b))).slice(0,30);
  document.querySelector('[data-priority-count]').textContent=`${critical.length} critical items`;
  document.querySelector('[data-priority-queue]').innerHTML=critical.map(x=>`<tr><td>${severityPill(xPriority(x))}</td><td>${esc(x.area||x.module)}</td><td><a class="view" href="${esc(x.link||'#')}">${esc(x.item||x.title)}</a>${x.reason?`<br><span class="muted">${esc(x.reason)}</span>`:''}</td><td>${esc(x.owner)}</td><td>${esc(x.signal)}</td><td class="nextstep">${esc(x.next)}</td></tr>`).join('') || '<tr><td colspan="6">No critical items found in metadata.</td></tr>';
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Open-item metadata unavailable. Refresh the page or check the latest deployment.</div>`);});
