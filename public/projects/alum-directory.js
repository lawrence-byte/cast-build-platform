const $=(s)=>document.querySelector(s);
const esc=(v)=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function getJson(url){const r=await fetch(url); if(!r.ok) throw new Error(url); return r.json();}
function splitParty(value){const raw=String(value||'').trim(); const match=raw.match(/^(.*?)\s*\((.*?)\)$/); return match?[match[1],match[2]]:[raw,''];}
(async()=>{
  const [rfi,submittal]=await Promise.all([getJson('/safe-data/projects/golden-hill/rfi-summary.json'),getJson('/safe-data/projects/golden-hill/submittal-summary.json')]);
  const companies=new Map(); const people=[];
  for(const [name,count] of (rfi.topManagers||[])){const [person,company]=splitParty(name); people.push({person,company:company||'Cast Build',role:'Project Management',source:`${count} RFI signals`}); companies.set(company||'Cast Build',{company:company||'Cast Build',role:'Project Management',signals:count,focus:'RFIs'});}
  for(const [company,count] of (rfi.topContractors||[]).filter(([n])=>n && n!=='Unassigned')) companies.set(company,{company,role:'Trade Partner',signals:(companies.get(company)?.signals||0)+count,focus:'RFIs'});
  for(const [company,count] of (submittal.topResponsibleContractors||submittal.topContractors||[]).filter(([n])=>n && n!=='Unassigned')) companies.set(company,{company,role:'Responsible Contractor',signals:(companies.get(company)?.signals||0)+count,focus:'Submittals'});
  const companyRows=[...companies.values()].sort((a,b)=>b.signals-a.signals).slice(0,18);
  $('[data-company-count]').textContent=companyRows.length;
  $('[data-person-count]').textContent=people.length;
  $('[data-company-rows]').innerHTML=companyRows.map(x=>`<tr><td>${esc(x.company)}</td><td>${esc(x.role)}</td><td>${esc(x.signals)}</td><td>${esc(x.focus)}</td></tr>`).join('');
  $('[data-person-rows]').innerHTML=people.map(x=>`<tr><td>${esc(x.person)}</td><td>${esc(x.company)}</td><td>${esc(x.role)}</td><td>${esc(x.source)}</td></tr>`).join('')||'<tr><td colspan="4">No named people in current sanitized summaries.</td></tr>';
})().catch(err=>{console.error(err);});
