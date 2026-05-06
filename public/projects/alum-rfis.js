async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function statusPill(s){const t=String(s||''); const k=/draft/i.test(t)?'draft':/open/i.test(t)?'open':''; return `<span class="pill ${k}">${esc(t||'—')}</span>`;}
function pct(n,total){return total?`${Math.round((Number(n||0)/total)*100)}%`:'0%';}
function safeStep(item){
  if (/open/i.test(item.Status||'') && item['Due Date']) return `Confirm reviewer response path before ${item['Due Date']}`;
  if (/draft/i.test(item.Status||'')) return 'Validate draft scope, manager, and due date before issuing';
  return 'Keep closed item available for reference only';
}
function rowsFromPairs(pairs){return (pairs||[]).map(([name,count])=>`<tr><td>${esc(name||'Unassigned')}</td><td>${esc(count)}</td></tr>`).join('') || '<tr><td colspan="2">No metadata available.</td></tr>';}
(async()=>{
  const rfi=await loadJson('/data/projects/golden-hill/rfi-summary.json');
  document.querySelector('[data-generated]').textContent=`Generated ${esc(rfi.generatedAt||'from local metadata')}`;
  document.querySelector('[data-queue-summary]').textContent=`${rfi.openCount||0} open/draft of ${rfi.total||0}; ${rfi.overdueOpen||0} overdue.`;
  document.querySelector('[data-impact-summary]').textContent=`${rfi.costImpactYes||0} cost-impact flags; ${rfi.scheduleImpactYes||0} schedule-impact flags.`;
  document.querySelector('[data-team-summary]').textContent=`${(rfi.topManagers||[]).length} manager buckets; ${(rfi.topContractors||[]).length} contractor buckets.`;
  for (const [sel,val] of Object.entries({'[data-total]':rfi.total,'[data-open]':rfi.openCount,'[data-overdue]':rfi.overdueOpen,'[data-seven]':rfi.dueWithin7Days,'[data-cost]':rfi.costImpactYes,'[data-schedule]':rfi.scheduleImpactYes,'[data-nodue]':rfi.openNoDueDate,'[data-closed]':rfi.closedCount})) document.querySelector(sel).textContent=val??0;
  const queue=(rfi.openItems||rfi.recentItems||[]).slice(0,30);
  document.querySelector('[data-rfi-count]').textContent=`${queue.length} shown`;
  document.querySelector('[data-rfi-rows]').innerHTML=queue.map(x=>`<tr><td>${esc(x.Number||'—')}${x.Revision&&x.Revision!=='0'?'.'+esc(x.Revision):''}</td><td>${esc(x.Subject||'')}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Ball In Court']||x['Assigned Id']||x['RFI Manager']||'—')}</td><td>${esc(x['Due Date']||'—')}</td><td class="nextstep">${esc(safeStep(x))}</td></tr>`).join('') || '<tr><td colspan="6">No RFI queue items found in metadata.</td></tr>';
  document.querySelector('[data-manager-rows]').innerHTML=rowsFromPairs(rfi.topManagers);
  document.querySelector('[data-contractor-rows]').innerHTML=rowsFromPairs(rfi.topContractors);
  const statuses=Object.entries(rfi.statusCounts||{}).sort((a,b)=>b[1]-a[1]);
  document.querySelector('[data-status-count]').textContent=`${statuses.length} statuses`;
  document.querySelector('[data-status-rows]').innerHTML=statuses.map(([status,count])=>`<tr><td>${statusPill(status)}</td><td>${esc(count)}</td><td>${pct(count,rfi.total||0)}</td></tr>`).join('') || '<tr><td colspan="3">No status metadata available.</td></tr>';
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Could not load RFI metadata: ${esc(err.message)}</div>`);});
