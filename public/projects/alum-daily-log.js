async function loadJson(path){const r=await fetch(path); if(!r.ok) throw new Error(path); return r.json();}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
(async()=>{
  const room=await loadJson('/data/projects/golden-hill/alum-data-room-index.json');
  const dailySections=(room.sections||[]).filter(s=>/daily|field log|superintendent/i.test(`${s.key||''} ${s.name||''} ${s.topFolder||''}`));
  const dailyFileCount=dailySections.reduce((sum,s)=>sum+Number(s.fileCount||0),0);
  document.querySelector('[data-generated]').textContent=`Generated ${esc(room.generatedAt||'from local metadata')}`;
  document.querySelector('[data-state]').textContent=dailyFileCount?`${dailyFileCount} candidate daily-log files found for approved extraction.`:'No dedicated daily-log export found in the current metadata index.';
  document.querySelector('[data-total-files]').textContent=room.totalFiles||0;
  document.querySelector('[data-daily-files]').textContent=dailyFileCount;
  document.querySelector('[data-sections]').textContent=room.sectionCount||dailySections.length||0;
  document.querySelector('[data-ready]').textContent=0;
})().catch(err=>{document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note">Could not load daily-log placeholder metadata: ${esc(err.message)}</div>`);});
