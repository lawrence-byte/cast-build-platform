async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
const key='alumMeetingMinutes.v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>new Date().toISOString().slice(0,10);
function loadItems(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
function saveItems(items){localStorage.setItem(key,JSON.stringify(items));}
function pill(s){const c=/closed/i.test(s)?'':/pending/i.test(s)?'draft':'open';return `<span class="pill ${c}">${esc(s||'Open')}</span>`}
function isPastDue(x){return x.status!=='Closed' && x.due && x.due<today();}
let items=[];
let agenda=[];
function agendaRows(){return agenda.map(x=>`<tr><td>${esc(x.topic)}</td><td>${esc(x.source)}</td><td>${esc(x.owner||'—')}</td><td class="nextstep">${esc(x.question)}</td></tr>`).join('')||'<tr><td colspan="4">No agenda signals available.</td></tr>';}
function render(){
  const actions=items.filter(x=>x.kind==='Action');
  const decisions=items.filter(x=>x.kind!=='Action');
  $('[data-open-actions]').textContent=actions.filter(x=>x.status!=='Closed').length;
  $('[data-decisions]').textContent=items.filter(x=>x.kind==='Decision').length;
  $('[data-hot-topics]').textContent=agenda.length;
  $('[data-overdue-actions]').textContent=actions.filter(isPastDue).length;
  $('[data-action-summary]').textContent=`${actions.filter(x=>x.status!=='Closed').length} open local follow-ups.`;
  $('[data-decision-summary]').textContent=`${items.filter(x=>x.kind==='Decision').length} decisions logged locally.`;
  $('[data-action-count]').textContent=`${actions.length} actions`;
  $('[data-decision-count]').textContent=`${decisions.length} decisions / notes`;
  $('[data-action-rows]').innerHTML=actions.map(x=>`<tr><td>${esc(x.topic)}</td><td>${esc(x.owner||'—')}</td><td>${esc(x.due||'—')}</td><td>${pill(x.status)}</td><td>${esc(x.notes||'')}</td><td><button class="tinybtn" data-toggle="${esc(x.id)}">${x.status==='Closed'?'Reopen':'Close'}</button></td></tr>`).join('')||'<tr><td colspan="6">No local action items yet.</td></tr>';
  $('[data-decision-rows]').innerHTML=decisions.map(x=>`<tr><td>${esc(x.kind)}</td><td>${esc(x.topic)}</td><td>${esc(x.owner||'—')}</td><td>${esc(x.notes||'')}</td><td><button class="tinybtn" data-delete="${esc(x.id)}">Remove</button></td></tr>`).join('')||'<tr><td colspan="5">No local decisions or notes yet.</td></tr>';
}
function addItem(){
  const topic=$('[data-topic]').value.trim(); if(!topic) return;
  items.unshift({id:Date.now().toString(36),createdAt:new Date().toISOString(),kind:$('[data-kind]').value,status:$('[data-status]').value,topic,owner:$('[data-owner]').value.trim(),due:$('[data-due]').value.trim(),notes:$('[data-notes]').value.trim()});
  saveItems(items); ['[data-topic]','[data-owner]','[data-due]','[data-notes]'].forEach(s=>$(s).value=''); render();
}
function download(){const blob=new Blob([JSON.stringify({project:'Alüm',exportedAt:new Date().toISOString(),items},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='alum-meeting-minutes-local-export.json'; a.click(); URL.revokeObjectURL(a.href);}
(async()=>{
  items=loadItems();
  const [rfi,sub,changes,budget]=await Promise.all([
    loadJson('/data/projects/golden-hill/rfi-summary.json'),
    loadJson('/data/projects/golden-hill/submittal-summary.json'),
    loadJson('/data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json'),
    loadJson('/data/projects/golden-hill/procore-information/budget/budget-summary.json')
  ]);
  agenda=[
    {topic:'RFI closeout / overdue responses',source:`${rfi.openCount||0} open, ${rfi.overdueOpen||0} overdue`,owner:'RFI Manager / Design Team',question:'Which open RFIs need a committed answer date before the next OAC?'},
    {topic:'Submittal review queue',source:`${sub.openOrDraftCount||0} open/draft submittals`,owner:'Submittal Manager / Trade Partners',question:'Which packages are blocking procurement or field sequencing?'},
    {topic:'Budget revisions and current reconciliation',source:`${(changes.changes||[]).length} budget revisions indexed`,owner:'Cost Control',question:'Which changes need owner context before the next forecast update?'},
    {topic:'Top budget risk rows',source:`${(budget.topBudgetRiskRows||[]).length} risk rows indexed`,owner:'PM / Accounting',question:'Which exposure items need contingency, buyout, or scope confirmation?'}
  ];
  $('[data-generated]').textContent=`Generated ${rfi.generatedAt||sub.generatedAt||'from local metadata'}`;
  $('[data-agenda-summary]').textContent=`${agenda.length} generated agenda signals from RFIs, submittals, and cost data.`;
  $('[data-agenda-count]').textContent=`${agenda.length} agenda topics`;
  $('[data-agenda-rows]').innerHTML=agendaRows();
  document.addEventListener('click',e=>{
    if(e.target.matches('[data-add]')) addItem();
    if(e.target.matches('[data-export]')) download();
    if(e.target.matches('[data-reset]') && confirm('Clear browser-local meeting items?')){items=[];saveItems(items);render();}
    const t=e.target.getAttribute('data-toggle'); if(t){items=items.map(x=>x.id===t?{...x,status:x.status==='Closed'?'Open':'Closed'}:x);saveItems(items);render();}
    const d=e.target.getAttribute('data-delete'); if(d){items=items.filter(x=>x.id!==d);saveItems(items);render();}
  });
  render();
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Could not load meeting metadata: ${esc(err.message)}</div>`); items=loadItems(); render();});
