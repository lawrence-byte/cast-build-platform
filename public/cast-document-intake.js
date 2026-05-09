// CAST Document Intake — client-side intelligent filing desk scaffold.
// This classifies and queues files locally, then calls /api/document-intake for approved server filing.
// Production storage requires backend auth + storage env; see api/_lib/document-intake-api.js.
(function(){
  'use strict';
  const MODULES=['Documents','Contracts','Financials','Field','Drawings','RFIs','Submittals','Change Orders','Pay Applications','Invoices','Insurance','Permits','Meeting Minutes','Closeout','Uncategorized'];
  const PROJECTS=[{id:'golden-hill',name:'Alüm',aliases:['alum','alüm','golden hill','1101','25th']},{id:'overlook',name:'Overlook',aliases:['overlook']}];
  const STORE='castDocumentIntakeQueue.v1';
  const LOGO='/assets/cast-upload-logo.png';
  const keywords=[
    ['RFIs',/\brfi\b|request for information|clarification|rfi response/i,'/projects/alum-rfis.html'],
    ['Submittals',/submittal|shop drawing|product data|sample|revise and resubmit|approved as noted/i,'/projects/alum-submittals.html'],
    ['Drawings',/drawing|plan set|sheet\s*[a-z]?\d|architectural|structural|mep|markup|sketch|\.dwg$/i,'/projects/cast-drawing-log.html'],
    ['Meeting Minutes',/meeting minutes|oac|agenda|minutes|meeting packet/i,'/projects/alum-meeting-minutes.html'],
    ['Change Orders',/change order|cco|pco|change event|budget change|ASI|SSI|COR/i,'/projects/alum-change-events.html'],
    ['Pay Applications',/pay app|payment application|application for payment|g702|g703|retainage/i,'/projects/alum-owner-billings.html'],
    ['Invoices',/invoice|bill|statement|remittance/i,'/projects/alum-accounting-tieout.html'],
    ['Contracts',/contract|agreement|proposal|scope of work|sov|commitment|purchase order|subcontract/i,'/projects/alum-contracts.html'],
    ['Insurance',/insurance|coi|certificate of insurance|additional insured|policy/i,'/projects/alum-contracts.html'],
    ['Permits',/permit|inspection card|city approval|county approval/i,'/projects/alum-quality.html'],
    ['Field',/daily report|daily log|field report|inspection|observation|incident|safety|photo|punch/i,'/projects/alum-daily-log.html'],
    ['Closeout',/closeout|warranty|o&m|operation and maintenance|as-built|record drawing|lien release|manual/i,'/projects/alum-closeout.html'],
    ['Financials',/budget|forecast|cost|lien release|schedule of values|financial/i,'/projects/alum-budget.html'],
  ];
  const extModules={pdf:'Documents',doc:'Documents',docx:'Documents',xls:'Financials',xlsx:'Financials',csv:'Financials',jpg:'Field',jpeg:'Field',png:'Field',heic:'Field',dwg:'Drawings',dxf:'Drawings',eml:'Documents',msg:'Documents'};
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function id(){return 'doc_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
  function ext(name){return (String(name).split('.').pop()||'').toLowerCase();}
  function readQueue(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}}
  function writeQueue(rows){localStorage.setItem(STORE,JSON.stringify(rows.slice(0,250)));}
  function currentUser(){
    const configured=window.CastDocumentIntakeConfig?.currentUser || window.CastAuth?.currentUser;
    if(configured) return configured;
    try{const stored=JSON.parse(localStorage.getItem('castCurrentUser')||'null'); if(stored) return stored;}catch{}
    // Static CAST project pages currently represent an authenticated project-control shell.
    // Replace this scaffold with the production auth provider before enabling server writes.
    return {id:'static-cast-admin',name:'CAST Admin',role:'CAST Admin',authenticated:true,permissions:['document:upload','document:override']};
  }
  function canUpload(){const u=currentUser();return !!(u&&u.authenticated!==false&&(u.permissions||[]).includes('document:upload')||['CAST Admin','Owner Admin','Project Manager','Project Engineer','Document Controller'].includes(u?.role));}
  function projectGuess(name){const hay=String(name).toLowerCase();return PROJECTS.find(p=>p.aliases.some(a=>hay.includes(a)))||PROJECTS[0];}
  function classify(file){
    const name=file.name||''; const type=file.type||''; const hay=`${name} ${type}`; const e=ext(name);
    let module=extModules[e]||'Uncategorized', route='/projects/golden-hill-documents.html', confidence=.42, reason=`Extension ${e||'unknown'} suggests ${module}.`;
    for(const [m,re,r] of keywords){if(re.test(hay)){module=m;route=r;confidence=.86;reason=`Filename/type matched ${m} construction-control language.`;break;}}
    if(/lien release/i.test(hay)){module='Closeout';route='/projects/alum-closeout.html';confidence=.82;}
    if(/signed|executed/i.test(hay)&&/agreement|contract|proposal/i.test(hay)){module='Contracts';route='/projects/alum-contracts.html';confidence=.9;}
    const project=projectGuess(name);
    const folder=`/projects/${project.id}/${module.toLowerCase().replace(/\s+/g,'-')}/${new Date().getFullYear()}`;
    const linked=[];
    const rfi=name.match(/\bRFI[-_\s#]*(\d{1,4})\b/i); if(rfi) linked.push(`RFI ${rfi[1]}`);
    const sub=name.match(/\bSUB(?:MITTAL)?[-_\s#]*(\d{1,4})\b/i); if(sub) linked.push(`Submittal ${sub[1]}`);
    const drawing=name.match(/\b([A-Z]{1,3}[-.]?\d{1,4}(?:\.\d+)?)\b/); if(drawing&&module==='Drawings') linked.push(`Drawing ${drawing[1]}`);
    return {module,projectId:project.id,projectName:project.name,folder,route,confidence,reason,linkedRecords:linked,status:'Ready for confirmation'};
  }
  function ensureUi(){
    if(document.querySelector('.cast-intake-overlay')) return;
    const overlay=document.createElement('div');overlay.className='cast-intake-overlay';overlay.setAttribute('aria-hidden','true');overlay.innerHTML=`<aside class="cast-intake-panel" role="dialog" aria-modal="true" aria-labelledby="cast-intake-title"><header class="cast-intake-head"><div><div class="cast-intake-eyebrow">Universal Document Control Desk</div><h2 id="cast-intake-title">CAST Document Intake</h2><p>Drop project files here. CAST reviews the file name/type, recommends the project/module/folder/linked records, then waits for confirmation before filing.</p></div><button class="cast-intake-close" data-intake-close aria-label="Close">×</button></header><div class="cast-intake-body"><label class="cast-intake-drop" data-intake-drop><input type="file" multiple data-intake-input><strong>Drop files for intelligent filing</strong><span>PDF, Word, Excel, CSV, images, drawings, emails, agreements, RFIs, submittals, invoices, permits, schedules, closeout docs.</span><span class="cast-intake-small">Manual select also supported. Files are not sent until you confirm filing.</span></label><div class="cast-intake-toolbar"><button class="cast-intake-btn secondary" data-intake-pick>Select Files</button><button class="cast-intake-btn secondary" data-intake-retry>Retry Failed</button><button class="cast-intake-btn warn" data-intake-clear>Clear Local Queue</button></div><div class="cast-intake-grid"><section class="cast-intake-card"><h3>Intake Queue</h3><div data-intake-list><p class="cast-intake-muted">No files queued yet.</p></div></section><section class="cast-intake-card"><h3>Review + Confirm Filing</h3><div data-intake-detail><p class="cast-intake-muted">Select a queued file to review classification, preview, and filing recommendation.</p></div></section></div><div class="cast-intake-status" data-intake-status>Secure server filing is approval-gated. Static mode queues locally if backend storage is not configured.</div></div></aside>`;document.body.appendChild(overlay);
  }
  let items=[], selected=null;
  function render(){
    const list=document.querySelector('[data-intake-list]'); if(!list)return;
    list.innerHTML=items.length?items.map((it,i)=>`<div class="cast-intake-file ${selected===it.id?'is-selected':''}"><button data-intake-select="${esc(it.id)}"><strong>${esc(it.name)}</strong><span class="cast-intake-muted">${esc(it.classification.module)} · ${esc(it.classification.projectName)} · ${Math.round(it.classification.confidence*100)}% confidence</span><div class="cast-intake-progress"><span style="width:${it.progress||0}%"></span></div><span class="cast-intake-pill">${esc(it.status)}</span></button></div>`).join(''):'<p class="cast-intake-muted">No files queued yet.</p>';
    const it=items.find(x=>x.id===selected); const detail=document.querySelector('[data-intake-detail]');
    if(!it){detail.innerHTML='<p class="cast-intake-muted">Select a queued file to review classification, preview, and filing recommendation.</p>';return;}
    const c=it.classification;
    detail.innerHTML=`<div class="cast-intake-preview" data-preview>${it.preview?`<img src="${esc(it.preview)}" alt="Preview of ${esc(it.name)}">`:`<span class="cast-intake-muted">Preview unavailable for this file type</span>`}</div><p><strong>${esc(it.name)}</strong><br><span class="cast-intake-muted">${esc(it.sizeLabel)} · ${esc(it.type||'unknown type')}</span></p><p><span class="cast-intake-pill">${esc(c.module)}</span><span class="cast-intake-pill">${esc(c.projectName)}</span><span class="cast-intake-pill">${Math.round(c.confidence*100)}% confidence</span></p><form class="cast-intake-form" data-intake-confirm-form><label>Project<select name="projectId">${PROJECTS.map(p=>`<option value="${p.id}" ${p.id===c.projectId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>Module<select name="module">${MODULES.map(m=>`<option ${m===c.module?'selected':''}>${esc(m)}</option>`).join('')}</select></label><label class="wide">Suggested Folder<input name="folder" value="${esc(c.folder)}"></label><label class="wide">Linked Records<input name="linkedRecords" value="${esc((c.linkedRecords||[]).join(', '))}" placeholder="RFI 12, Submittal 034, Drawing A2.01"></label><label class="wide">Admin Override / Filing Note<textarea name="note" rows="3" placeholder="Reason for override, access restrictions, routing note"></textarea></label><div class="wide"><button class="cast-intake-btn" type="submit">Confirm and File</button> <button class="cast-intake-btn secondary" type="button" data-intake-remove="${esc(it.id)}">Remove</button></div></form><p class="cast-intake-muted">Reason: ${esc(c.reason)}. Final filing requires user confirmation and admin override is captured before server storage.</p>`;
  }
  function setStatus(msg){const el=document.querySelector('[data-intake-status]');if(el)el.textContent=msg;}
  function addFiles(files){for(const file of files){const it={id:id(),name:file.name,size:file.size,type:file.type,sizeLabel:`${Math.max(1,Math.round(file.size/1024)).toLocaleString()} KB`,status:'Processing',progress:12,classification:classify(file),file};items.unshift(it);if(file.type&&file.type.startsWith('image/')){const reader=new FileReader();reader.onload=()=>{it.preview=reader.result;render();};reader.readAsDataURL(file);}setTimeout(()=>{it.progress=100;it.status='Ready for confirmation';render();},350);}selected=items[0]?.id||selected;writeQueue(items.map(({file,preview,...rest})=>rest));render();setStatus(`${files.length} file(s) classified. Review and confirm before filing.`)}
  async function confirmFile(it, form){const fd=new FormData(form); const payload={id:it.id,fileName:it.name,fileSize:it.size,mimeType:it.type,projectId:fd.get('projectId'),module:fd.get('module'),folder:fd.get('folder'),linkedRecords:String(fd.get('linkedRecords')||'').split(',').map(s=>s.trim()).filter(Boolean),adminOverrideNote:fd.get('note'),classification:it.classification,confirmedAt:new Date().toISOString()};it.status='Filing…';it.progress=100;render();try{const res=await fetch('/api/document-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.message||body.error||`Server returned ${res.status}`);it.status='Filed';setStatus(`Filed ${it.name} to ${payload.folder}.`);}catch(err){it.status='Queued locally';const q=readQueue();q.unshift({...payload,status:'queued-local',error:err.message});writeQueue(q);setStatus(`Server filing unavailable: ${err.message}. ${it.name} was queued locally for retry.`);}render();}
  function open(){ensureUi();document.querySelector('.cast-intake-overlay').classList.add('is-open');document.querySelector('.cast-intake-overlay').setAttribute('aria-hidden','false');render();}
  function close(){document.querySelector('.cast-intake-overlay')?.classList.remove('is-open');document.querySelector('.cast-intake-overlay')?.setAttribute('aria-hidden','true');}
  function mountButton(container){if(!canUpload()||document.querySelector('.cast-intake-button'))return;ensureUi();const btn=document.createElement('button');btn.className='cast-intake-button';btn.type='button';btn.setAttribute('aria-label','Upload and File Document');btn.title='Upload and File Document';btn.innerHTML=`<img src="${LOGO}" alt="CAST upload">`;btn.addEventListener('click',open);container.appendChild(btn);}
  document.addEventListener('click',e=>{if(e.target.closest('[data-intake-close]'))close();if(e.target.classList.contains('cast-intake-overlay'))close();const pick=e.target.closest('[data-intake-pick]');if(pick)document.querySelector('[data-intake-input]')?.click();const sel=e.target.closest('[data-intake-select]');if(sel){selected=sel.dataset.intakeSelect;render();}const rem=e.target.closest('[data-intake-remove]');if(rem){items=items.filter(x=>x.id!==rem.dataset.intakeRemove);selected=items[0]?.id||null;render();}if(e.target.closest('[data-intake-clear]')){items=[];selected=null;localStorage.removeItem(STORE);render();setStatus('Local intake queue cleared.')}if(e.target.closest('[data-intake-retry]'))setStatus('Retry is available after backend storage is configured; locally queued records remain in browser storage.');});
  document.addEventListener('submit',e=>{const form=e.target.closest('[data-intake-confirm-form]');if(!form)return;e.preventDefault();const it=items.find(x=>x.id===selected);if(it)confirmFile(it,form);});
  document.addEventListener('change',e=>{if(e.target.matches('[data-intake-input]'))addFiles([...e.target.files]);});
  document.addEventListener('dragover',e=>{const d=e.target.closest('[data-intake-drop]');if(d){e.preventDefault();d.classList.add('is-over');}});
  document.addEventListener('dragleave',e=>{const d=e.target.closest('[data-intake-drop]');if(d)d.classList.remove('is-over');});
  document.addEventListener('drop',e=>{const d=e.target.closest('[data-intake-drop]');if(d){e.preventDefault();d.classList.remove('is-over');addFiles([...e.dataTransfer.files]);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  window.CastDocumentIntake={mountButton,open,close,classify,canUpload};
})();
