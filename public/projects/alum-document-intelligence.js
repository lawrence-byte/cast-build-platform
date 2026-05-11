const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let summary={}, candidates=[], samples=[];
function renderCandidates(){
  const q=document.querySelector('#q').value.toLowerCase();
  const cat=document.querySelector('#category').value;
  const mode=document.querySelector('#candidate').value;
  const rows=candidates.filter(c=>(!cat||c.category===cat)&&(!mode||(mode==='yes'?c.ocrCandidate:c.nativeTextCharsFirst2===0))&&(!q||[c.fileName,c.category,c.subcategory,c.projectPath].join(' ').toLowerCase().includes(q))).slice(0,150);
  document.querySelector('#candidate-count').textContent=`${rows.length} shown`;
  document.querySelector('#rows').innerHTML=rows.map(c=>`<tr><td><strong>${esc(c.fileName)}</strong>${c.ocrCandidate?'<br><span class="pill pending">OCR candidate</span>':''}</td><td>${esc(c.category)}<br><span class="caption">${esc(c.subcategory)}</span></td><td>${esc(c.pages)}</td><td>${esc(c.nativeTextCharsFirst2)} chars</td><td>${esc(c.priority)}</td><td><span class="caption">${esc(c.projectPath)}</span></td></tr>`).join('');
}
function render(){
  document.querySelector('[data-pdfs]').textContent=summary.pdfCount??'—';
  document.querySelector('[data-candidates]').textContent=summary.ocrCandidateCount??'—';
  document.querySelector('[data-zero]').textContent=summary.zeroNativeTextCount??'—';
  document.querySelector('[data-samples]').textContent=summary.sampleOcrCount??'—';
  document.querySelector('[data-generated]').textContent=`Generated ${new Date(summary.generatedAt).toLocaleString()}. Data Tie path: ${summary.dataTieStatus}; current budget folder: ${summary.currentBudgetStatus}.`;
  document.querySelector('#pipeline').innerHTML=(summary.pipeline||[]).map(p=>`<article class="card"><span class="pill approved">${esc(p.status)}</span><h2>${esc(p.step)}</h2><p class="caption">${esc(p.detail)}</p></article>`).join('');
  document.querySelector('#sample-count').textContent=`${samples.length} samples`;
  document.querySelector('#sampleCards').innerHTML=samples.map(s=>`<article class="card span-6"><header><h2>${esc(s.fileName)}</h2><span class="pill approved">${esc(s.extractionStatus.replaceAll('_',' '))}</span></header><div class="body"><p><strong>${esc(s.category)}</strong> · ${esc(s.pagesProcessed)} page(s) OCR’d · ${esc(s.ocrTextChars)} chars recovered</p><p class="caption">${esc(s.projectPath)}</p><div class="note"><strong>Preview:</strong> ${esc(s.textPreview)}</div>${s.extractedTerms?.length?`<p class="caption"><strong>Terms:</strong> ${esc(s.extractedTerms.join(', '))}</p>`:''}${s.reviewFlags?.length?`<ul>${s.reviewFlags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}</div></article>`).join('');
  const cats=[...new Set(candidates.map(c=>c.category))].sort();
  document.querySelector('#category').innerHTML+=cats.map(c=>`<option>${esc(c)}</option>`).join('');
  document.querySelector('#guardrailsList').innerHTML=(summary.guardrails||[]).map(g=>`<li>${esc(g)}</li>`).join('');
  ['q','category','candidate'].forEach(id=>document.querySelector('#'+id).addEventListener('input',renderCandidates));
  renderCandidates();
}
(async()=>{
  const [s,c,o]=await Promise.all([
    fetch('/safe-data/projects/golden-hill/document-intelligence/summary.json').then(r=>r.json()),
    fetch('/safe-data/projects/golden-hill/document-intelligence/ocr-candidates.json').then(r=>r.json()),
    fetch('/safe-data/projects/golden-hill/document-intelligence/ocr-samples.json').then(r=>r.json())
  ]);
  summary=s; candidates=c; samples=o; render();
})().catch(e=>document.body.insertAdjacentHTML('afterbegin',`<div class="note">Refresh the page or check the latest deployment.</div>`));
