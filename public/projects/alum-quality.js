const $=(s)=>document.querySelector(s);
const esc=(v)=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const key='cast.alum.quality.observations.v1';
let rows=[];
function load(){try{rows=JSON.parse(localStorage.getItem(key)||'[]')}catch{rows=[]}}
function save(){localStorage.setItem(key,JSON.stringify(rows));}
function render(){
  $('[data-observation-count]').textContent=`${rows.length} items`;
  $('[data-observation-rows]').innerHTML=rows.map((x,i)=>`<tr><td>${esc(x.location)}</td><td>${esc(x.trade)}</td><td>${esc(x.severity)}</td><td>${esc(x.due)}</td><td>${esc(x.note)}</td><td><button class="small-action" data-close="${i}">Close</button></td></tr>`).join('')||'<tr><td colspan="6">No local observations captured.</td></tr>';
}
async function init(){
 const [idx,quality,inspections,safety]=await Promise.all([
  fetch('/safe-data/projects/golden-hill/alum-data-room-index.json').then(r=>r.json()),
  fetch('/safe-data/projects/golden-hill/folder-registers/quality-folder-index.json').then(r=>r.ok?r.json():null).catch(()=>null),
  fetch('/safe-data/projects/golden-hill/folder-registers/inspections-folder-index.json').then(r=>r.ok?r.json():null).catch(()=>null),
  fetch('/safe-data/projects/golden-hill/folder-registers/safety-folder-index.json').then(r=>r.ok?r.json():null).catch(()=>null)
 ]);
 const find=(name)=>idx.sections.find(s=>s.key.includes(name))?.fileCount||0;
 $('[data-qc-count]').textContent=quality?.totalFiles||find('QUALITY CONTROL'); $('[data-inspection-count]').textContent=inspections?.totalFiles||find('INSPECTIONS'); $('[data-safety-count]').textContent=safety?.totalFiles||find('SAFETY'); load(); render();
}
document.addEventListener('click',e=>{
 if(e.target.matches('[data-add-observation]')){rows.unshift({location:$('[data-location]').value,trade:$('[data-trade]').value,severity:$('[data-severity]').value,due:$('[data-due]').value,note:$('[data-note]').value,createdAt:new Date().toISOString()}); save(); render();}
 if(e.target.matches('[data-close]')){rows.splice(Number(e.target.dataset.close),1); save(); render();}
 if(e.target.matches('[data-export-observations]')){const blob=new Blob([JSON.stringify({project:'Alüm',observations:rows},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='alum-observations-local-export.json'; a.click(); URL.revokeObjectURL(a.href);}
});
init().catch(console.error);
