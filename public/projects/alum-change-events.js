async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function money(n){return Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});}
function statusPill(s){const t=String(s||''); const k=/approved|open/i.test(t)?'open':/draft/i.test(t)?'draft':''; return `<span class="pill ${k}">${esc(t||'—')}</span>`;}
function safeBucketName(name){return String(name||'Uncategorized').replace(/\.(pdf|xlsx|xls|csv|zip)$/ig,'').replace(/_/g,' ').trim();}
function replicaTreatment(bucket){
  if (/log/i.test(bucket)) return 'Use as dated register metadata; raw log remains private.';
  if (/template/i.test(bucket)) return 'Keep as workflow reference only.';
  return 'Track count/status; require approved extraction before detail view.';
}
(async()=>{
  const [room,revisions]=await Promise.all([
    loadJson('/safe-data/projects/golden-hill/alum-data-room-index.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json')
  ]);
  const ce=room.sections?.find(s=>s.key==='11. CHANGE EVENTS')||{};
  const owner=room.sections?.find(s=>s.key==='12. OWNER CHANGE ORDERS')||{};
  const buckets=Object.entries(ce.childFolders||{}).sort((a,b)=>b[1]-a[1]);
  const logCount=buckets.filter(([k])=>/log/i.test(k)).reduce((sum,entry)=>sum+Number(entry[1]||0),0);
  document.querySelector('[data-generated]').textContent=`Generated ${esc(room.generatedAt||revisions.generatedAt||'from local metadata')}`;
  document.querySelector('[data-ce-summary]').textContent=`${ce.fileCount||0} change-event files across ${buckets.length} buckets.`;
  document.querySelector('[data-budget-summary]').textContent=`${revisions.totals?.changeCount||0} approved revisions; ${money(revisions.totals?.net||0)} net.`;
  document.querySelector('[data-ce-files]').textContent=ce.fileCount||0;
  document.querySelector('[data-ce-folders]').textContent=buckets.length;
  document.querySelector('[data-ce-logs]').textContent=logCount;
  document.querySelector('[data-oco-files]').textContent=owner.fileCount||0;
  document.querySelector('[data-ce-bucket-count]').textContent=`${buckets.length} buckets`;
  document.querySelector('[data-ce-rows]').innerHTML=buckets.map(([name,count])=>`<tr><td>${esc(safeBucketName(name))}</td><td>${esc(count)}</td><td class="nextstep">${esc(replicaTreatment(name))}</td></tr>`).join('') || '<tr><td colspan="3">No change-event buckets found in metadata.</td></tr>';
  const changes=(revisions.changes||[]).slice(-24).reverse();
  document.querySelector('[data-budget-count]').textContent=`${changes.length} shown`;
  document.querySelector('[data-budget-rows]').innerHTML=changes.map(x=>`<tr><td>#${esc(x.number||'—')}</td><td>${esc(x.name||'')}</td><td>${statusPill(x.status||'Approved')}</td><td>${esc(x.adjustmentCount||0)}</td><td>${esc(x.lineCount||0)}</td><td>${money(x.net||0)}</td><td class="nextstep">${x.net===0?'Retain balanced transfer for audit tie-out':'Verify budget impact before owner action'}</td></tr>`).join('') || '<tr><td colspan="7">No approved budget revisions found.</td></tr>';
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Change-event metadata unavailable. Refresh the page or check the latest deployment.</div>`);});
