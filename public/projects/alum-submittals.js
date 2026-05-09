async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function statusPill(s){const t=String(s||''); const k=/draft/i.test(t)?'draft':/open|revise/i.test(t)?'open':''; return `<span class="pill ${k}">${esc(t||'—')}</span>`;}
function syncPill(s){const t=String(s||'Pending Sync'); const k=/conflict/i.test(t)?'open':/duplicate/i.test(t)?'draft':/server|synced/i.test(t)?'': 'draft'; return `<span class="pill ${k}">${esc(t)}</span>`;}
function pct(n,total){return total?`${Math.round((Number(n||0)/total)*100)}%`:'0%';}
function safeStep(item){
  if (/folder-document/i.test(item.sourceKind||'')) return 'Reconcile folder document to server register before relying on it';
  if (/revise/i.test(item.Status||'')) return 'Confirm revision owner and required resubmittal scope';
  if (/open/i.test(item.Status||'')) return 'Confirm reviewer queue and response target';
  if (/draft/i.test(item.Status||'')) return 'Complete package metadata before routing';
  return 'Keep as reference; no action suggested';
}
function pairRows(pairs){return (pairs||[]).map(([name,count])=>`<tr><td>${esc(name||'Uncategorized')}</td><td>${esc(count)}</td></tr>`).join('') || '<tr><td colspan="2">No metadata available.</td></tr>';}
function asSubmittalRow(x){
  const hasServerId=Boolean(x.server_submittal_id||x.serverSubmittalId||x.Id||x.id);
  const isFolder=/folder-document/i.test(x.sourceKind||'');
  const status=x.Status||'';
  const issued=x.issuedSubmittalLink||x['Issued Submittal Link']||'';
  const returned=x.returnedSubmittalLink||x['Returned Submittal Link']||'';
  const sync=x.server_sync_status || (hasServerId?'Server Source':isFolder?'Pending Sync':'Synced');
  return {...x,_issued:issued,_returned:returned,_lastIssued:x.last_issued_distribution_at||'',_lastReturned:x.last_returned_distribution_at||'',_distributionStatus:x.distribution_status||'Not Distributed',_recipientCount:x.recipient_count||0,_serverSyncStatus:sync,_safeStep:x.nextStep||safeStep(x),_status:status};
}
function matchesFilters(row){
  const link=document.querySelector('[data-filter="link"]')?.value||'';
  const sync=document.querySelector('[data-filter="sync"]')?.value||'';
  if(sync && row._serverSyncStatus!==sync) return false;
  if(link==='has-issued' && !row._issued) return false;
  if(link==='missing-issued' && row._issued) return false;
  if(link==='has-returned' && !row._returned) return false;
  if(link==='missing-returned' && row._returned) return false;
  if(link==='distributed' && row._distributionStatus==='Not Distributed') return false;
  if(link==='not-distributed' && row._distributionStatus!=='Not Distributed') return false;
  if(link==='returned-distributed' && !row._lastReturned) return false;
  if(link==='returned-not-distributed' && row._lastReturned) return false;
  return true;
}
function linkCell(url,label){return url?`<a class="view" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`:'<span class="warn">Missing</span>';}
function renderQueue(allRows){
  const rows=allRows.filter(matchesFilters);
  document.querySelector('[data-submittal-count]').textContent=`${rows.length} of ${allRows.length} shown`;
  const warning=document.querySelector('[data-filter-warning]');
  if(warning) warning.hidden=rows.length===allRows.length;
  document.querySelector('[data-submittal-rows]').innerHTML=rows.map(x=>`<tr><td>${esc(x['Submittal Number']||'—')}${x['Rev.']&&x['Rev.']!=='0'?'.'+esc(x['Rev.']):''}</td><td>${esc(x.Title||'')}</td><td>${esc(x.Type||'—')}</td><td>${statusPill(x.Status)}</td><td>${esc(x['Responsible Contractor']||x['Ball In Court']||x.Division||'—')}</td><td>${esc(x['Final Due Date']||x.modifiedAt?.slice?.(0,10)||'—')}</td><td>${linkCell(x._issued,'Issued')}</td><td>${linkCell(x._returned,'Returned')}</td><td>${esc(x._lastIssued||'—')}</td><td>${esc(x._lastReturned||'—')}</td><td>${esc(x._distributionStatus)}</td><td>${esc(x._recipientCount)}</td><td>${syncPill(x._serverSyncStatus)}</td><td class="nextstep">${esc(x._safeStep)}</td></tr>`).join('') || '<tr><td colspan="14">No submittal items match the current filters.</td></tr>';
}
(async()=>{
  const sub=await loadJson('/safe-data/projects/golden-hill/submittal-summary.json');
  const statuses=sub.statusCounts||{};
  const types=Object.entries(sub.typeCounts||{}).sort((a,b)=>b[1]-a[1]);
  document.querySelector('[data-generated]').textContent=`Generated ${esc(sub.generatedAt||'from local metadata')}`;
  document.querySelector('[data-queue-summary]').textContent=`${sub.openOrDraftCount||0} open/draft of ${sub.total||0}; ${sub.folderDocumentCount||0} folder documents indexed; ${statuses['Revise & Resubmit']||0} revise/resubmit.`;
  document.querySelector('[data-spec-summary]').textContent=`Top section: ${esc((sub.folderTopSpecSections||sub.topSpecSections)?.[0]?.[0]||'not available')}.`;
  document.querySelector('[data-type-summary]').textContent=`${types.length} type buckets; largest is ${esc(types[0]?.[0]||'not available')}.`;
  for (const [sel,val] of Object.entries({'[data-total]':sub.folderDocumentCount||sub.total,'[data-open]':sub.openOrDraftCount,'[data-draft]':statuses.Draft,'[data-revise]':statuses['Revise & Resubmit'],'[data-approved]':(statuses['Approved/No Exceptions']||0)+(statuses['Approved with Comments/Exceptions Noted']||0),'[data-void]':statuses.Void,'[data-bic]':sub.pendingBallInCourtCount,'[data-types]':types.length})) document.querySelector(sel).textContent=val??0;
  const sourceRows=(sub.sampleItems&&sub.sampleItems.length?sub.sampleItems:(sub.folderItems||[]));
  const queue=sourceRows.filter(x=>/open|draft|revise|filed|approved|closed|void|record/i.test(x.Status||'')).slice(0,250).map(asSubmittalRow);
  renderQueue(queue);
  document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('change',()=>renderQueue(queue)));
  document.querySelector('[data-reset-filters]')?.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(el=>el.value=''); renderQueue(queue);});
  document.querySelector('[data-spec-rows]').innerHTML=pairRows(sub.topSpecSections);
  document.querySelector('[data-type-count]').textContent=`${types.length} types`;
  document.querySelector('[data-type-rows]').innerHTML=pairRows(types);
  const statusPairs=Object.entries(statuses).sort((a,b)=>b[1]-a[1]);
  document.querySelector('[data-status-count]').textContent=`${statusPairs.length} statuses`;
  document.querySelector('[data-status-rows]').innerHTML=statusPairs.map(([status,count])=>`<tr><td>${statusPill(status)}</td><td>${esc(count)}</td><td>${pct(count,sub.total||0)}</td></tr>`).join('') || '<tr><td colspan="3">No status metadata available.</td></tr>';
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Submittal metadata unavailable. Refresh the page or check the latest deployment.</div>`); console.error(err);});
