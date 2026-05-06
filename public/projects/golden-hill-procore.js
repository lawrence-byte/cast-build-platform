async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function statusPill(s){const k=String(s||'').toLowerCase().includes('draft')?'draft':String(s||'').toLowerCase().includes('open')?'open':'';return `<span class="pill ${k}">${esc(s||'—')}</span>`}
function pct(n,total){return total?Math.max(2,Math.round(n/total*100)):0}
function actionRows(rfi,sub){
 const rfiRows=(rfi.openItems||rfi.recentItems||[]).slice(0,5).map(x=>({module:'RFI',item:`#${x.Number||'—'} ${x.Subject||''}`,status:x.Status,owner:x['Ball In Court']||x['Assigned Id']||x['RFI Manager']||'—',due:x['Due Date']||'—',next:'Review response path'}));
 const subRows=(sub.sampleItems||[]).filter(x=>/open|draft|revise/i.test(x.Status||'')).slice(0,4).map(x=>({module:'Submittal',item:`#${x['Submittal Number']||'—'} ${x.Title||''}`,status:x.Status,owner:x['Ball In Court']||x['Responsible Contractor']||'—',due:x['Final Due Date']||'—',next:'Confirm reviewer queue'}));
 return [...rfiRows,...subRows].slice(0,8);
}
(async()=>{
 const [rfi,sub]=await Promise.all([loadJson('/data/projects/golden-hill/rfi-summary.json'),loadJson('/data/projects/golden-hill/submittal-summary.json')]);
 document.querySelector('[data-rfi-total]').textContent=rfi.total;
 document.querySelector('[data-rfi-open]').textContent=rfi.openCount;
 document.querySelector('[data-sub-total]').textContent=sub.total;
 document.querySelector('[data-sub-open]').textContent=sub.openOrDraftCount;
 const openTotal=Math.max(1,rfi.openCount+sub.openOrDraftCount);
 const rfiBar=document.querySelector('[data-rfi-bar]');
 rfiBar.innerHTML=`<span class="seg red" style="width:${pct(rfi.overdueOpen,rfi.openCount)}%"></span><span class="seg yellow" style="width:${pct(rfi.dueWithin7Days,rfi.openCount)}%"></span><span class="seg slate" style="width:${pct(Math.max(0,rfi.openCount-rfi.overdueOpen-rfi.dueWithin7Days),rfi.openCount)}%"></span>`;
 document.querySelector('[data-rfi-view]').textContent=`View All (${rfi.openCount})`;
 const subBar=document.querySelector('[data-sub-bar]');
 const subOpen=sub.statusCounts.Open||0, subDraft=sub.statusCounts.Draft||0, subRevise=sub.statusCounts['Revise & Resubmit']||0;
 subBar.innerHTML=`<span class="seg red" style="width:${pct(subRevise,sub.openOrDraftCount)}%"></span><span class="seg yellow" style="width:${pct(subOpen,sub.openOrDraftCount)}%"></span><span class="seg slate" style="width:${pct(subDraft,sub.openOrDraftCount)}%"></span>`;
 document.querySelector('[data-sub-view]').textContent=`View All (${sub.openOrDraftCount})`;
 document.querySelector('[data-rfi-recent]').innerHTML=(rfi.recentItems||[]).slice(0,6).map(x=>`<tr><td>${esc(x.Number||'(None)')}${x.Revision&&x.Revision!=='0'?'.'+esc(x.Revision):''}</td><td>${esc(x.Subject)}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Ball In Court']||x['Assigned Id']||'—')}</td><td>${esc(x['Due Date']||'—')}</td></tr>`).join('');
 document.querySelector('[data-sub-sample]').innerHTML=(sub.sampleItems||[]).slice(0,6).map(x=>`<tr><td>${esc(x['Submittal Number']||'—')}</td><td>${esc(x.Title||'')}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Responsible Contractor']||'—')}</td><td>${esc(x['Final Due Date']||'—')}</td></tr>`).join('');
 const actions=actionRows(rfi,sub);
 document.querySelector('[data-action-count]').textContent=`${actions.length} queued`;
 document.querySelector('[data-action-queue]').innerHTML=actions.map(x=>`<tr><td>${esc(x.module)}</td><td>${esc(x.item)}</td><td>${statusPill(x.status)}</td><td>${esc(x.owner)}</td><td>${esc(x.due)}</td><td class="nextstep">${esc(x.next)}</td></tr>`).join('') || '<tr><td colspan="6">No metadata-derived action items found.</td></tr>';
 document.querySelector('[data-source-note]').innerHTML=`RFI CSV: ${rfi.total} rows. Submittal XLSX: ${sub.total} rows. Parsed locally from Lawrence's CAST BUILD A.O exports on ${esc(rfi.generatedAt)}. Public navigation links expose summary metadata only; private raw source logs are excluded from build output.`;
})().catch(err=>{document.querySelector('[data-source-note]').textContent='Could not load local project data: '+err.message;});
