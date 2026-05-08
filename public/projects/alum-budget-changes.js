const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=n=>Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
let register={changes:[],byBudgetCode:[],totals:{}};
let lines=[];
function flattenLines(){
  lines=[];
  for(const c of register.changes||[]) for(const a of c.adjustments||[]) for(const l of a.lines||[]) lines.push({changeNumber:c.number,changeName:c.name,adjustmentNumber:a.adjustmentNumber,comment:a.comment||'',...l});
}
function renderLines(){
  const q=document.querySelector('#q').value.toLowerCase();
  const change=document.querySelector('#change').value;
  const dir=document.querySelector('#direction').value;
  const rows=lines.filter(l=>(!change||String(l.changeNumber)===change)&&(!dir||(dir==='positive'?l.amount>0:l.amount<0))&&(!q||[l.changeNumber,l.changeName,l.adjustmentNumber,l.budgetCode,l.description,l.comment].join(' ').toLowerCase().includes(q)));
  document.querySelector('#count').textContent=`${rows.length} lines shown`;
  document.querySelector('#rows').innerHTML=rows.map(l=>`<tr><td><strong>${l.changeNumber}</strong></td><td>${esc(l.changeName)}</td><td>${esc(l.adjustmentNumber)}</td><td><strong>${esc(l.budgetCode)}</strong></td><td>${esc(l.description)}${l.comment?`<br><span class="caption">${esc(l.comment)}</span>`:''}</td><td class="money ${l.amount<0?'neg':'pos'}">${money(l.amount)}</td></tr>`).join('');
}
function renderCodes(){
  const rows=(register.byBudgetCode||[]).slice().sort((a,b)=>Math.abs(b.netAmount)-Math.abs(a.netAmount));
  document.querySelector('#code-count').textContent=`${rows.length} budget codes`;
  document.querySelector('#code-rows').innerHTML=rows.map(b=>`<tr><td><strong>${esc(b.budgetCode)}</strong></td><td>${esc(b.description)}</td><td>${esc(b.changes.join(', '))}</td><td class="money pos">${money(b.positiveAmount)}</td><td class="money neg">${money(b.negativeAmount)}</td><td class="money ${b.netAmount<0?'neg':'pos'}">${money(b.netAmount)}</td></tr>`).join('');
}
(async()=>{
  const r=await fetch('/safe-data/projects/golden-hill/procore-information/budget-changes/budget-revisions-register.json');
  if(!r.ok)throw new Error('Budget revisions register missing. Run npm run intake:budget-revisions.');
  register=await r.json();
  flattenLines();
  const t=register.totals||{};
  document.querySelector('[data-total]').textContent=t.changeCount??'—';
  document.querySelector('[data-adjustments]').textContent=t.adjustmentCount??'—';
  document.querySelector('[data-lines]').textContent=t.lineCount??'—';
  document.querySelector('[data-net]').textContent=money(t.net||0);
  const rec=register.currentBudgetReconciliation;
  const recText=rec?` Reconciliation: ${rec.status.replaceAll('_',' ')} against ${rec.currentBudgetRows} current-budget rows; ${rec.mismatchCount} mismatches.`:'';
  document.querySelector('[data-generated]').textContent=`Generated ${new Date(register.generatedAt).toLocaleString()} from ${register.source}. Positive transfers total ${money(t.positiveTotal)} and negative transfers total ${money(t.negativeTotal)}.${recText}`;
  document.querySelector('#change').innerHTML+=(register.changes||[]).map(c=>`<option value="${esc(c.number)}">#${esc(c.number)} — ${esc(c.name)}</option>`).join('');
  ['q','change','direction'].forEach(id=>document.querySelector('#'+id).addEventListener('input',renderLines));
  renderLines(); renderCodes();
})().catch(e=>document.body.insertAdjacentHTML('afterbegin',`<div class="note">Refresh the page or check the latest deployment.</div>`));
