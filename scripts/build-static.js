const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const required = ['index.html', 'admin.html', 'projects.html', 'procore.html', 'cast-build.css'];
const privateBundlePatterns = [
  `${path.sep}source-logs${path.sep}`,
  `${path.sep}dropbox-intake${path.sep}`,
  `${path.sep}source-artifacts${path.sep}`,
];
const privateDeployExtensions = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.zip']);

const missing = required.filter((file) => !fs.existsSync(path.join(publicDir, file)));
if (missing.length) {
  console.error(`Missing static files: ${missing.join(', ')}`);
  process.exit(1);
}

function isPrivateDeployPath(src) {
  const rel = path.relative(publicDir, src);
  return privateBundlePatterns.some((pattern) => src.includes(pattern))
    || privateDeployExtensions.has(path.extname(src).toLowerCase())
    || /(^|[/\\])source-logs([/\\]|$)/i.test(rel)
    || /(^|[/\\])dropbox-intake([/\\]|$)/i.test(rel)
    || /(^|[/\\])source-artifacts([/\\]|$)/i.test(rel)
    || /(^|[/\\])raw([/\\]|$)/i.test(rel)
    || /(^|[/\\])private([/\\]|$)/i.test(rel);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.cpSync(publicDir, distDir, {
  recursive: true,
  filter(src) {
    return !isPrivateDeployPath(src);
  },
});

const blocked = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (isPrivateDeployPath(full)) blocked.push(path.relative(distDir, full));
  }
}
walk(distDir);
if (blocked.length) {
  console.error(`Private artifacts leaked into dist: ${blocked.join(', ')}`);
  process.exit(1);
}

console.log('CAST Build static scaffold ready. Dist bundle written with private raw/source files excluded.');
