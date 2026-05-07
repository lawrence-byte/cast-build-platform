const key='alumDailyLog.v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const today=()=>new Date().toISOString().slice(0,10);
function loadLogs(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
function saveLogs(logs){localStorage.setItem(key,JSON.stringify(logs));}
function pill(s){const c=/closed/i.test(s)?'':/ready/i.test(s)?'open':'draft';return `<span class="pill ${c}">${esc(s||'Draft')}</span>`}
let logs=loadLogs();
function seedDate(){if($('[data-date]')&&!$('[data-date]').value)$('[data-date]').value=today();}
function hasIncident(x){return /incident|injur|safety|damage|delay|block|constraint|impact/i.test(x.blockers||'');}
function render(){
  logs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const totalManpower=logs.reduce((s,x)=>s+(Number(x.manpower)||0),0);
  const openBlockers=logs.filter(x=>x.status!=='Closed' && (x.blockers||'').trim()).length;
  const incidents=logs.filter(hasIncident).length;
  $('[data-days]').textContent=logs.length;
  $('[data-manpower]').textContent=totalManpower;
  $('[data-blockers]').textContent=openBlockers;
  $('[data-incidents]').textContent=incidents;
  $('[data-register-summary]').textContent=logs.length?`${logs.length} local daily logs; ${openBlockers} open blocker flags.`:'No browser-local records yet.';
  $('[data-field-summary]').textContent=`${openBlockers} open blockers; ${incidents} incident/safety/schedule keywords.`;
  $('[data-log-count]').textContent=`${logs.length} rows`;
  $('[data-log-rows]').innerHTML=logs.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.weather||'—')}</td><td>${esc(x.manpower||0)}</td><td>${esc(x.deliveries||'—')}</td><td>${esc(x.inspections||'—')}</td><td>${pill(x.status)}</td><td>${esc(x.blockers||'—')}</td><td><button class="tinybtn" data-edit="${esc(x.id)}">Edit</button> <button class="tinybtn" data-close="${esc(x.id)}">Close</button></td></tr>`).join('')||'<tr><td colspan="8">No local daily logs yet.</td></tr>';
  const review=logs.filter(x=>x.status!=='Closed' && ((x.blockers||'').trim() || /ready/i.test(x.status||''))).slice(0,20);
  $('[data-review-count]').textContent=`${review.length} review items`;
  $('[data-review-rows]').innerHTML=review.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc((x.blockers||x.status||'Needs PM review').slice(0,180))}</td><td class="nextstep">Confirm owner, clearance path, and whether the item belongs in RFI, submittal, schedule, or change-control queue.</td></tr>`).join('')||'<tr><td colspan="3">No PM review signals in local daily logs.</td></tr>';
}
function collect(){return {id:Date.now().toString(36),updatedAt:new Date().toISOString(),date:$('[data-date]').value||today(),weather:$('[data-weather]').value.trim(),manpower:Number($('[data-manpower]').value)||0,deliveries:$('[data-deliveries]').value.trim(),inspections:$('[data-inspections]').value.trim(),status:$('[data-status]').value,notes:$('[data-notes]').value.trim(),blockers:$('[data-blockers]').value.trim()};}
function clearForm(){['[data-weather]','[data-manpower]','[data-deliveries]','[data-inspections]','[data-notes]','[data-blockers]'].forEach(s=>$(s).value=''); $('[data-status]').value='Draft'; seedDate();}
function save(){const row=collect(); const existing=logs.findIndex(x=>x.date===row.date); if(existing>=0) logs[existing]={...logs[existing],...row,id:logs[existing].id}; else logs.unshift(row); saveLogs(logs); clearForm(); render();}
function download(){const blob=new Blob([JSON.stringify({project:'Alüm',exportedAt:new Date().toISOString(),logs},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='alum-daily-log-local-export.json'; a.click(); URL.revokeObjectURL(a.href);}
document.addEventListener('click',e=>{
  if(e.target.matches('[data-save]')) save();
  if(e.target.matches('[data-export]')) download();
  if(e.target.matches('[data-reset]') && confirm('Clear browser-local daily logs?')){logs=[];saveLogs(logs);render();}
  const id=e.target.getAttribute('data-close'); if(id){logs=logs.map(x=>x.id===id?{...x,status:'Closed',updatedAt:new Date().toISOString()}:x);saveLogs(logs);render();}
  const edit=e.target.getAttribute('data-edit'); if(edit){const x=logs.find(r=>r.id===edit); if(x){$('[data-date]').value=x.date||today(); $('[data-weather]').value=x.weather||''; $('[data-manpower]').value=x.manpower||''; $('[data-deliveries]').value=x.deliveries||''; $('[data-inspections]').value=x.inspections||''; $('[data-status]').value=x.status||'Draft'; $('[data-notes]').value=x.notes||''; $('[data-blockers]').value=x.blockers||''; window.location.hash='new';}}
});
$('[data-generated]').textContent=`Local daily-log module ready ${today()}`;
seedDate(); render();
