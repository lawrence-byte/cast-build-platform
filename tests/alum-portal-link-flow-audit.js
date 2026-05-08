const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const projectDir = path.join(publicDir, 'projects');
const pageFiles = fs.readdirSync(projectDir)
  .filter((name) => /^(alum-|golden-hill).*\.html$/.test(name))
  .map((name) => path.join(projectDir, name));

let failed = false;
function fail(message) {
  console.error(message);
  failed = true;
}

function stripHashAndQuery(value) {
  return value.split('#')[0].split('?')[0];
}
function isExternal(value) {
  return /^(https?:|mailto:|tel:|javascript:|data:)/i.test(value);
}
function publicPathForHref(href) {
  const clean = stripHashAndQuery(href.trim());
  if (!clean || clean === '#') return null;
  if (isExternal(clean)) return null;
  if (clean.startsWith('/api/') || clean.startsWith('/data/') || clean.startsWith('/safe-data/')) return null;
  const withoutSlash = clean.startsWith('/') ? clean.slice(1) : clean;
  if (!withoutSlash || withoutSlash.endsWith('/')) return path.join(publicDir, withoutSlash, 'index.html');
  return path.join(publicDir, withoutSlash);
}
function routeExists(href) {
  const target = publicPathForHref(href);
  if (!target) return true;
  if (fs.existsSync(target)) return true;
  if (!path.extname(target) && fs.existsSync(`${target}.html`)) return true;
  return false;
}
function extractHrefs(text) {
  const out = [];
  const re = /<a\b[^>]*\bhref=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(text))) out.push(match[1]);
  return out;
}

const navScript = '/projects/alum-project-nav.js';
for (const file of pageFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(navScript)) {
    fail(`${rel} missing persistent Alüm nav script`);
  }
  if (/href=["']\/projects\/golden-hill\.html["']/.test(text)) {
    fail(`${rel} links to legacy golden-hill.html instead of golden-hill-procore.html`);
  }
  for (const href of extractHrefs(text)) {
    if (!routeExists(href)) fail(`${rel} has unresolved link: ${href}`);
  }
}

const nav = fs.readFileSync(path.join(projectDir, 'alum-project-nav.js'), 'utf8');
for (const required of [
  '/projects/golden-hill-procore.html',
  '/projects/alum-command-center.html',
  '/projects/alum-open-items.html',
  '/projects/alum-rfis.html',
  '/projects/alum-submittals.html',
  '/projects/alum-schedule.html',
  '/projects/alum-budget.html',
  '/projects/golden-hill-documents.html',
]) {
  if (!nav.includes(required)) fail(`persistent Alüm nav missing primary route: ${required}`);
}
for (const requiredCleanup of [
  '.alum-project-nav-spacer .app .top',
  '.alum-project-nav-spacer .app .tabs',
  '.alum-project-nav-spacer .project-sidebar',
  '.alum-project-nav-spacer .project-main-content',
  '.alum-project-nav-spacer>header.top',
  '.alum-project-nav-spacer>.wrap>.side',
  '.alum-project-nav-spacer>.wrap',
]) {
  if (!nav.includes(requiredCleanup)) fail(`persistent Alüm nav missing cleanup rule: ${requiredCleanup}`);
}
for (const requiredRail of [
  'alum-section-rail',
  'Project Home',
  'Dashboard',
  'Top Level Items',
  'Documents',
  'Financials',
  'Field',
  'Reporting / Operations',
  'alum-section-rail__tabs',
  'alum-section-rail__icon',
  '/assets/brand/icons.svg#',
]) {
  if (!nav.includes(requiredRail)) fail(`persistent Alüm nav missing left section rail item: ${requiredRail}`);
}
if (!nav.includes("brand.href = HOME") || !nav.includes("railBrand.href = HOME")) {
  fail('top-left and left-rail home links must target project home constant');
}
if (!/\.alum-project-nav\{[^}]*justify-content:flex-start;[^}]*padding:10px 22px;/.test(nav)) {
  fail('CAST Build top nav brand must stay left-aligned without the old sidebar-offset padding');
}
if (/padding:10px 22px 10px 296px/.test(nav)) {
  fail('CAST Build top nav must not use old centered/sidebar-offset padding');
}
if (!/\.alum-section-rail\{[^}]*inset:70px auto 0 0;/.test(nav)) {
  fail('Alüm section rail must start below the sticky top bar so ALÜM umlaut is visible');
}

if (failed) process.exit(1);
console.log('Alüm portal link-flow audit passed.');
