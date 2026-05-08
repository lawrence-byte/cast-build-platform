const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
const set=(sel,v)=>{const el=document.querySelector(sel); if(el) el.textContent=v;};
async function loadJson(path){const r=await fetch(path,{credentials:'same-origin',cache:'no-store'}); if(!r.ok) throw new Error(`${path} ${r.status}`); return r.json();}
function getLocal(key,fallback=[]){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
function putLocal(key,value){localStorage.setItem(key,JSON.stringify(value));}
function defaultAttendees(){return [
  {name:'CAST Build PM / Superintendent',role:'Project controls + field status'},
  {name:'Owner representative',role:'Decisions, budget posture, priorities'},
  {name:'Design team',role:'RFI/submittal responses and clarifications'},
  {name:'Key subcontractors',role:'Upcoming work, constraints, procurement'}
];}
function agendaTopic(topic,source,owner,prompt,weight=2){return {topic,source,owner,prompt,weight};}
function buildAgenda(rfi,sub,budget,changes,acct){
  const out=[];
  out.push(agendaTopic('Project posture and action queue','Command Center','CAST Build PM','Confirm highest-priority actions, due dates, and what needs owner/design escalation.',1));
  if(Number(rfi.overdueOpen||0)>0) out.push(agendaTopic(`${rfi.overdueOpen} overdue RFIs and ${rfi.openNoDueDate||0} without due dates`,'RFI Log','Design / PM',`Confirm response dates for overdue RFIs and assign due dates for open/draft items.`,1));
  if(Number(rfi.scheduleImpactYes||0)>0) out.push(agendaTopic(`${rfi.scheduleImpactYes} RFIs marked with schedule impact`,'RFI Log','PM / Superintendent','Identify which responses are driving field sequencing or procurement constraints.',1));
  if(Number(sub.statusCounts?.['Revise & Resubmit']||0)>0) out.push(agendaTopic(`${sub.statusCounts['Revise & Resubmit']} Revise & Resubmit submittals`,'Submittal Log','Submittal manager / contractors','Group by responsible contractor and set resubmittal target dates.',1));
  if(Number(sub.openOrDraftCount||0)>0) out.push(agendaTopic(`${sub.openOrDraftCount} open/draft submittals`,'Submittal Log','Submittal manager','Confirm draft cleanup, routing, and review responsibility before next milestone.',2));
  const ou=Number(budget.metrics?.['Projected over Under']||0);
  if(ou<0) out.push(agendaTopic(`Projected budget overrun ${money(ou)}`,'Budget','Owner / cost controls','Review drivers, offsets, pending cost changes, and whether executive escalation is needed.',1));
  if(Number(budget.metrics?.['Pending Cost Changes']||0)>0) out.push(agendaTopic(`Pending cost changes ${money(budget.metrics['Pending Cost Changes'])}`,'Budget','Cost controls','Confirm status, exposure, and whether any items need owner decision.',2));
  if(Number(changes.totals?.changeCount||0)>0) out.push(agendaTopic(`${changes.totals.changeCount} approved budget changes / ${changes.totals.lineCount||0} lines`,'Change Control','Cost controls','Confirm current approved changes reconcile to current budget and call out large transfers.',3));
  if((acct.exceptions||[]).length>0) out.push(agendaTopic(`${acct.exceptions.length} accounting tie-out exceptions`,'Accounting Tie-Out','Accounting controls','Resolve reconciliation mapping before executive reporting/signoff.',1));
  out.push(agendaTopic('Upcoming constraints and 3-week lookahead','Schedule','Superintendent / PM','Confirm procurement, access, inspections, manpower, and handoffs for the next three weeks.',2));
  out.push(agendaTopic('Closeout readiness by submittal type','Closeout','PM / subs','Confirm O&M, warranties, record drawings, attic stock, and evidence gaps while reviews are active.',3));
  return out.sort((a,b)=>a.weight-b.weight).slice(0,16);
}
function buildRisks(rfi,sub,budget,acct){
  const risks=[];
  if(Number(rfi.overdueOpen||0)>0) risks.push(['RFI response delay',`${rfi.overdueOpen} overdue open RFIs`, 'Name owner and response date in meeting minutes.']);
  if(Number(rfi.scheduleImpactYes||0)>0) risks.push(['Schedule-impact RFI exposure',`${rfi.scheduleImpactYes} RFIs marked schedule impact`, 'Ask field/design team which items block current sequence.']);
  if(Number(sub.statusCounts?.['Revise & Resubmit']||0)>0) risks.push(['Submittal rework queue',`${sub.statusCounts['Revise & Resubmit']} Revise & Resubmit`, 'Assign contractor resubmittal targets and reviewer path.']);
  if(Number(budget.metrics?.['Projected over Under']||0)<0) risks.push(['Budget overrun posture',money(budget.metrics['Projected over Under']), 'Confirm mitigation/offset plan or owner escalation path.']);
  if((acct.exceptions||[]).length>0) risks.push(['Accounting reconciliation gap',`${acct.exceptions.length} tie-out exceptions`, 'Resolve mappings before relying on executive packet totals.']);
  return risks;
}
function buildDecisions(agenda,notes){
  const localDecisionRows=notes.filter(n=>/Decision|Action Item/i.test(n.type)).map(n=>[n.topic,n.owner,n.type,n.body]);
  const generated=agenda.slice(0,6).map(a=>[a.topic,a.owner,'Needs confirmation',a.prompt]);
  return [...localDecisionRows,...generated].slice(0,14);
}
function renderNotes(){
  const notes=getLocal('alumMeetingMinutesNotes');
  document.querySelector('[data-note-rows]').innerHTML=notes.map((n,i)=>`<tr><td><span class="pill ${n.type==='Risk'?'open':n.type==='Action Item'?'draft':''}">${esc(n.type)}</span></td><td>${esc(n.topic)}</td><td>${esc(n.owner)}</td><td>${esc(n.body)}</td><td><button class="tinybtn" data-del-note="${i}">Done</button></td></tr>`).join('')||'<tr><td colspan="5">No local notes yet. Add meeting discussion, decisions, risks, or action items here.</td></tr>';
  document.querySelectorAll('[data-del-note]').forEach(btn=>btn.addEventListener('click',()=>{const rows=getLocal('alumMeetingMinutesNotes').filter((_,i)=>i!==Number(btn.dataset.delNote)); putLocal('alumMeetingMinutesNotes',rows); renderAllWindowState();}));
}
function renderAttendees(){
  const attendees=getLocal('alumMeetingAttendees',defaultAttendees());
  document.querySelector('[data-attendee-rows]').innerHTML=attendees.map((a,i)=>`<tr><td>${esc(a.name)}</td><td>${esc(a.role)}</td><td><button class="tinybtn" data-del-attendee="${i}">Remove</button></td></tr>`).join('');
  document.querySelectorAll('[data-del-attendee]').forEach(btn=>btn.addEventListener('click',()=>{const rows=getLocal('alumMeetingAttendees',defaultAttendees()).filter((_,i)=>i!==Number(btn.dataset.delAttendee)); putLocal('alumMeetingAttendees',rows); renderAllWindowState();}));
}
let currentPacket='';
function renderPacket(agenda,risks,decisions){
  const notes=getLocal('alumMeetingMinutesNotes');
  const attendees=getLocal('alumMeetingAttendees',defaultAttendees());
  currentPacket=[
    'Alüm OAC / Owner Meeting Prep Packet',
    '',
    'ATTENDEES',
    ...attendees.map(a=>`- ${a.name}${a.role?` — ${a.role}`:''}`),
    '',
    'AGENDA',
    ...agenda.map((a,i)=>`${i+1}. ${a.topic} [${a.source}] — ${a.prompt} Owner/party: ${a.owner}`),
    '',
    'LOCAL NOTES / MINUTES',
    ...(notes.length?notes.map(n=>`- ${n.type}: ${n.topic} (${n.owner||'Unassigned'}) — ${n.body}`):['- No local notes entered yet.']),
    '',
    'DECISIONS / FOLLOW-UPS',
    ...decisions.map(d=>`- ${d[0]} | ${d[1]} | ${d[2]} | ${d[3]}`),
    '',
    'RISKS / ESCALATIONS',
    ...risks.map(r=>`- ${r[0]}: ${r[1]} — ${r[2]}`),
    '',
    'Boundary: read-first local prep packet only; no CAST BUILD A.O write-back or external send.'
  ].join('\n');
  document.querySelector('[data-package-preview]').textContent=currentPacket;
}
let cached={agenda:[],risks:[],decisions:[]};
function renderAllWindowState(){renderNotes(); renderAttendees(); cached.decisions=buildDecisions(cached.agenda,getLocal('alumMeetingMinutesNotes')); document.querySelector('[data-decision-rows]').innerHTML=cached.decisions.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join(''); set('[data-decision-count]',`${cached.decisions.length} items`); renderPacket(cached.agenda,cached.risks,cached.decisions);}
(async()=>{
  const [rfi,sub,budget,changes,acct]=await Promise.all([
    loadJson('/safe-data/projects/golden-hill/rfi-summary.json'),
    loadJson('/safe-data/projects/golden-hill/submittal-summary.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget/budget-summary.json'),
    loadJson('/safe-data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json'),
    loadJson('/safe-data/projects/golden-hill/accounting-budget/accounting-budget-tieout.json')
  ]);
  const agenda=buildAgenda(rfi,sub,budget,changes,acct);
  const risks=buildRisks(rfi,sub,budget,acct);
  cached.agenda=agenda; cached.risks=risks; cached.decisions=buildDecisions(agenda,getLocal('alumMeetingMinutesNotes'));
  set('[data-generated]',`Generated from sanitized metadata · ${budget.generatedAt||rfi.generatedAt||'local exports'}`);
  set('[data-open-rfis]',rfi.openCount||0); set('[data-open-submittals]',sub.openOrDraftCount||0); set('[data-budget-ou]',money(budget.metrics?.['Projected over Under']||0)); set('[data-change-count]',changes.totals?.changeCount||0);
  set('[data-agenda-count]',`${agenda.length} topics`); set('[data-escalation-count]',`${risks.length} risks`);
  document.querySelector('[data-agenda-rows]').innerHTML=agenda.map((a,i)=>`<tr><td>${i+1}</td><td>${esc(a.topic)}</td><td>${esc(a.source)}</td><td>${esc(a.owner)}</td><td class="nextstep">${esc(a.prompt)}</td></tr>`).join('');
  document.querySelector('[data-escalation-rows]').innerHTML=risks.map(r=>`<tr><td>${esc(r[0])}</td><td><span class="pill open">${esc(r[1])}</span></td><td class="nextstep">${esc(r[2])}</td></tr>`).join('')||'<tr><td colspan="3">No escalation risks detected from current metadata.</td></tr>';
  document.querySelector('[data-add-note]').addEventListener('click',()=>{const topic=document.querySelector('[data-note-topic]').value.trim(), owner=document.querySelector('[data-note-owner]').value.trim(), type=document.querySelector('[data-note-type]').value, body=document.querySelector('[data-note-body]').value.trim(); if(!topic&&!body) return; const rows=getLocal('alumMeetingMinutesNotes'); rows.unshift({topic:topic||'Untitled',owner,type,body,createdAt:new Date().toISOString()}); putLocal('alumMeetingMinutesNotes',rows.slice(0,80)); document.querySelector('[data-note-topic]').value=''; document.querySelector('[data-note-owner]').value=''; document.querySelector('[data-note-body]').value=''; renderAllWindowState();});
  document.querySelector('[data-reset-notes]').addEventListener('click',()=>{localStorage.removeItem('alumMeetingMinutesNotes'); renderAllWindowState();});
  document.querySelector('[data-add-attendee]').addEventListener('click',()=>{const name=document.querySelector('[data-attendee-name]').value.trim(), role=document.querySelector('[data-attendee-role]').value.trim(); if(!name) return; const rows=getLocal('alumMeetingAttendees',defaultAttendees()); rows.push({name,role}); putLocal('alumMeetingAttendees',rows.slice(0,60)); document.querySelector('[data-attendee-name]').value=''; document.querySelector('[data-attendee-role]').value=''; renderAllWindowState();});
  document.querySelector('[data-reset-attendees]').addEventListener('click',()=>{localStorage.removeItem('alumMeetingAttendees'); renderAllWindowState();});
  document.querySelector('[data-copy-package]').addEventListener('click',async()=>{await navigator.clipboard.writeText(currentPacket); set('[data-copy-status]','Meeting prep packet copied to clipboard. No external send was performed.');});
  renderAllWindowState();
})().catch(e=>document.body.insertAdjacentHTML('afterbegin',`<div class="wide-note"><strong>Meeting minutes metadata unavailable:</strong> Refresh the page or check the latest deployment.</div>`));
