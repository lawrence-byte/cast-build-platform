async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function statusPill(s){const t=String(s||''); const k=/draft/i.test(t)?'draft':/open|revise/i.test(t)?'open':''; return `<span class="pill ${k}">${esc(t||'—')}</span>`;}
function pct(n,total){return total?`${Math.round((Number(n||0)/total)*100)}%`:'0%';}
function safeStep(item){
  if (/revise/i.test(item.Status||'')) return 'Confirm revision owner and required resubmittal scope';
  if (/open/i.test(item.Status||'')) return 'Confirm reviewer queue and response target';
  if (/draft/i.test(item.Status||'')) return 'Complete package metadata before routing';
  return 'Keep as reference; no action suggested';
}
function pairRows(pairs){return (pairs||[]).map(([name,count])=>`<tr><td>${esc(name||'Uncategorized')}</td><td>${esc(count)}</td></tr>`).join('') || '<tr><td colspan="2">No metadata available.</td></tr>';}
(async()=>{
  const sub=await loadJson('/data/projects/golden-hill/submittal-summary.json');
  const statuses=sub.statusCounts||{};
  const types=Object.entries(sub.typeCounts||{}).sort((a,b)=>b[1]-a[1]);
  document.querySelector('[data-generated]').textContent=`Generated ${esc(sub.generatedAt||'from local metadata')}`;
  document.querySelector('[data-queue-summary]').textContent=`${sub.openOrDraftCount||0} open/draft of ${sub.total||0}; ${sub.folderDocumentCount||0} folder documents indexed; ${statuses['Revise & Resubmit']||0} revise/resubmit.`;
  document.querySelector('[data-spec-summary]').textContent=`Top section: ${esc((sub.folderTopSpecSections||sub.topSpecSections)?.[0]?.[0]||'not available')}.`;
  document.querySelector('[data-type-summary]').textContent=`${types.length} type buckets; largest is ${esc(types[0]?.[0]||'not available')}.`;
  for (const [sel,val] of Object.entries({'[data-total]':sub.folderDocumentCount||sub.total,'[data-open]':sub.openOrDraftCount,'[data-draft]':statuses.Draft,'[data-revise]':statuses['Revise & Resubmit'],'[data-approved]':(statuses['Approved/No Exceptions']||0)+(statuses['Approved with Comments/Exceptions Noted']||0),'[data-void]':statuses.Void,'[data-bic]':sub.pendingBallInCourtCount,'[data-types]':types.length})) document.querySelector(sel).textContent=val??0;
  const queue=(sub.folderItems&&sub.folderItems.length?sub.folderItems:(sub.sampleItems||[])).filter(x=>/open|draft|revise|filed|approved/i.test(x.Status||'')).slice(0,120);
  document.querySelector('[data-submittal-count]').textContent=`${queue.length} shown`;
  document.querySelector('[data-submittal-rows]').innerHTML=queue.map(x=>`<tr><td>${esc(x['Submittal Number']||'—')}${x['Rev.']&&x['Rev.']!=='0'?'.'+esc(x['Rev.']):''}</td><td>${esc(x.Title||'')}</td><td>${esc(x.Type||'—')}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Responsible Contractor']||x['Ball In Court']||x.Division||'—')}</td><td>${esc(x['Final Due Date']||x.modifiedAt?.slice?.(0,10)||'—')}</td><td class="nextstep">${esc(x.nextStep||safeStep(x))}</td></tr>`).join('') || '<tr><td colspan="7">No open submittal items found in sample metadata.</td></tr>';
  document.querySelector('[data-spec-rows]').innerHTML=pairRows(sub.topSpecSections);
  document.querySelector('[data-type-count]').textContent=`${types.length} types`;
  document.querySelector('[data-type-rows]').innerHTML=pairRows(types);
  const statusPairs=Object.entries(statuses).sort((a,b)=>b[1]-a[1]);
  document.querySelector('[data-status-count]').textContent=`${statusPairs.length} statuses`;
  document.querySelector('[data-status-rows]').innerHTML=statusPairs.map(([status,count])=>`<tr><td>${statusPill(status)}</td><td>${esc(count)}</td><td>${pct(count,sub.total||0)}</td></tr>`).join('') || '<tr><td colspan="3">No status metadata available.</td></tr>';
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Could not load submittal metadata: ${esc(err.message)}</div>`);});
