const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['public/index.html', 'public/admin.html', 'public/projects.html', 'public/procore.html', 'docs/cast-build-platform-map.md', 'docs/procore-integration-plan.md'];
let failed = false;
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Missing ${file}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  if (/APIFY_TOKEN|PROCORE_CLIENT_SECRET|password\s*=|sk-[A-Za-z0-9]/.test(text)) {
    console.error(`Potential secret pattern in ${file}`);
    failed = true;
  }
}
const procorePage = fs.readFileSync(path.join(root, 'public/procore.html'), 'utf8');
if (!/no CAST BUILD A.O authentication/i.test(procorePage) || !/write API calls/i.test(procorePage)) {
  console.error('CAST BUILD A.O page must state integration guardrails.');
  failed = true;
}
const alumReplicaPage = fs.readFileSync(path.join(root, 'public/projects/golden-hill-procore.html'), 'utf8');
if (/source-logs\//i.test(alumReplicaPage)) {
  console.error('Alüm replica page must not link directly to private source-log artifacts.');
  failed = true;
}
if (!/CAST BUILD A\.O Module Map/.test(alumReplicaPage) || !/Action Queue/.test(alumReplicaPage)) {
  console.error('Alüm replica page must include module map and action queue.');
  failed = true;
}
const distDir = path.join(root, 'dist');
if (fs.existsSync(distDir)) {
  const leaked = [];
  function walkDist(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDist(full);
      else if (/(^|[/\\])source-logs([/\\]|$)/.test(path.relative(distDir, full))) leaked.push(path.relative(distDir, full));
    }
  }
  walkDist(distDir);
  if (leaked.length) {
    console.error(`Build bundle leaked source logs: ${leaked.join(', ')}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('Static platform audit passed.');
