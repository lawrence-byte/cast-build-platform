const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mail = (email) => email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : '<span class="directory-muted">—</span>';
const phone = (number) => number ? `<a href="tel:${esc(number.replace(/[^+\d]/g, ''))}">${esc(number)}</a>` : '<span class="directory-muted">—</span>';
const chips = (items, fallback = '—') => (items || []).length ? items.map((x) => `<span class="directory-chip">${esc(x)}</span>`).join('') : `<span class="directory-muted">${esc(fallback)}</span>`;

let directory = null;
let state = { q: '', category: 'All', company: 'All' };

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return r.json();
}

function companyByName(name) {
  return (directory.companies || []).find((c) => c.company === name) || {};
}

function matches(person) {
  const haystack = [person.name, person.company, person.jobTitle, person.email, person.permissionTemplate, ...(person.tags || []), ...(person.projectRoles || []), ...(person.trades || [])].join(' ').toLowerCase();
  return (!state.q || haystack.includes(state.q.toLowerCase()))
    && (state.category === 'All' || person.category === state.category)
    && (state.company === 'All' || person.company === state.company);
}

function renderKpis() {
  const s = directory.summary;
  $('[data-company-count]').textContent = s.companies;
  $('[data-person-count]').textContent = s.people;
  $('[data-internal-count]').textContent = s.internalContacts;
  $('[data-email-count]').textContent = s.withEmail;
  $('[data-source-date]').textContent = directory.generatedAt;
}

function renderFilters() {
  const categories = ['All', ...Object.keys(directory.summary.categories || {})];
  const companies = ['All', ...directory.companies.map((c) => c.company)];
  $('[data-category-filter]').innerHTML = categories.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('[data-company-filter]').innerHTML = companies.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
}

function renderCategoryCards() {
  const counts = directory.summary.categories || {};
  $('[data-category-cards]').innerHTML = Object.entries(counts).map(([name, count]) => `
    <button class="directory-category-card" type="button" data-pick-category="${esc(name)}">
      <strong>${esc(count)}</strong>
      <span>${esc(name)}</span>
    </button>
  `).join('');
  $$('[data-pick-category]').forEach((button) => button.addEventListener('click', () => {
    state.category = button.dataset.pickCategory;
    $('[data-category-filter]').value = state.category;
    renderTables();
  }));
}

function renderCompanyRows(filteredPeople) {
  const visibleCompanies = new Set(filteredPeople.map((p) => p.company));
  const rows = directory.companies
    .filter((c) => visibleCompanies.has(c.company))
    .sort((a, b) => b.contactCount - a.contactCount || a.company.localeCompare(b.company));
  $('[data-visible-company-count]').textContent = rows.length;
  $('[data-company-rows]').innerHTML = rows.map((c) => {
    const lead = directory.people.find((p) => p.company === c.company && (p.jobTitle || p.projectRoles?.length || p.email)) || directory.people.find((p) => p.company === c.company) || {};
    const focus = [...(c.trades || []), ...(c.tags || []), ...(c.roles || [])].slice(0, 4);
    return `<tr>
      <td><strong>${esc(c.company)}</strong><div class="directory-muted">${esc(c.category)}</div></td>
      <td>${esc(c.contactCount)}</td>
      <td>${lead.name ? `${esc(lead.name)}<div class="directory-muted">${esc(lead.jobTitle || lead.projectRoles?.join(', ') || 'Primary contact')}</div>` : '—'}</td>
      <td>${chips(focus, 'No trade/role tags')}</td>
      <td>${(c.permissions || []).map((x) => `<div class="directory-muted">${esc(x)}</div>`).join('') || '—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">No companies match the current filters.</td></tr>';
}

function renderPeopleRows(filteredPeople) {
  $('[data-visible-person-count]').textContent = filteredPeople.length;
  $('[data-person-rows]').innerHTML = filteredPeople.map((p) => `
    <tr>
      <td><strong>${esc(p.name)}</strong><div class="directory-muted">${esc(p.jobTitle || p.projectRoles?.join(', ') || p.category)}</div></td>
      <td>${esc(p.company)}<div class="directory-muted">${esc(companyByName(p.company).category || p.category)}</div></td>
      <td>${mail(p.email)}</td>
      <td>${phone(p.mobilePhone || p.businessPhone)}${p.mobilePhone && p.businessPhone ? `<div class="directory-muted">Office: ${esc(p.businessPhone)}</div>` : ''}</td>
      <td>${chips([...(p.projectRoles || []), ...(p.trades || []), ...(p.tags || [])].slice(0, 5), 'No tags')}</td>
      <td>${esc(p.permissionTemplate || '—')}</td>
    </tr>
  `).join('') || '<tr><td colspan="6">No people match the current filters.</td></tr>';
}

function renderPriorityLists() {
  const cast = directory.people.filter((p) => p.company === 'Cast Build' || p.category === 'Internal CAST Team');
  const design = directory.people.filter((p) => p.category === 'Design / Engineering');
  const noEmail = directory.people.filter((p) => !p.email).slice(0, 10);
  $('[data-cast-team]').innerHTML = cast.map((p) => `<li><strong>${esc(p.name)}</strong><span>${esc(p.jobTitle || p.projectRoles?.join(', ') || 'CAST')}</span>${mail(p.email)}</li>`).join('');
  $('[data-design-team]').innerHTML = design.slice(0, 14).map((p) => `<li><strong>${esc(p.company)}</strong><span>${esc(p.name)}${p.jobTitle ? ` · ${esc(p.jobTitle)}` : ''}</span></li>`).join('');
  $('[data-cleanup-list]').innerHTML = noEmail.map((p) => `<li><strong>${esc(p.name)}</strong><span>${esc(p.company)} · missing email</span></li>`).join('') || '<li><strong>Clean</strong><span>Every listed contact has an email.</span></li>';
}

function renderTables() {
  const filtered = directory.people.filter(matches);
  renderCompanyRows(filtered);
  renderPeopleRows(filtered);
}

(async () => {
  directory = await getJson('/safe-data/projects/golden-hill/project-directory.json');
  renderKpis();
  renderFilters();
  renderCategoryCards();
  renderPriorityLists();
  renderTables();

  $('[data-search]').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderTables(); });
  $('[data-category-filter]').addEventListener('change', (e) => { state.category = e.target.value; renderTables(); });
  $('[data-company-filter]').addEventListener('change', (e) => { state.company = e.target.value; renderTables(); });
  $('[data-reset-filters]').addEventListener('click', () => {
    state = { q: '', category: 'All', company: 'All' };
    $('[data-search]').value = '';
    $('[data-category-filter]').value = 'All';
    $('[data-company-filter]').value = 'All';
    renderTables();
  });
})().catch((err) => {
  console.error(err);
  $('[data-directory-status]').textContent = 'Directory data could not be loaded.';
});
