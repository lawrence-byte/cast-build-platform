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

const textDeployExtensions = new Set(['.html', '.js', '.css', '.json', '.txt', '.md', '.svg']);
function scrubPrivateSourceStrings(file) {
  if (!textDeployExtensions.has(path.extname(file).toLowerCase())) return;
  let text = fs.readFileSync(file, 'utf8');
  text = text
    .replace(/data\/projects\/golden-hill\/dropbox-intake\/extracted-[^"'<>\s]+\/Alüm\//g, '')
    .replace(/data\/projects\/golden-hill\/dropbox-intake\/extracted-[^"'<>\s]+/g, 'private-intake-redacted')
    .replace(/\/Users\/broderick\/Documents\/GitHub\/cast-build-platform\/data\/projects\/golden-hill\/dropbox-intake\/extracted-[^"'<>\s]+\/Alüm\//g, '')
    .replace(/\/Users\/broderick\/Documents\/GitHub\/cast-build-platform\/data\/projects\/golden-hill\/dropbox-intake\/extracted-[^"'<>\s]+/g, 'private-intake-redacted')
    .replace(/\/Users\/lawrencehoward\/CAST Community Dropbox\/CAST Automation\/CAST Build Management Platform\/Alüm\/00_PROCORE DATA TIE[^"'<>\n\r]*/g, 'private-data-tie-redacted')
    .replace(/\/Users\/lawrencehoward\/CAST Community Dropbox[^"'<>\n\r]*/g, 'private-dropbox-path-redacted')
    .replace(/\/Volumes\/CAST Drive[^"'<>\n\r]*/g, 'private-volume-path-redacted')
    .replace(/\/data\/projects\/golden-hill\/source-logs\/[^"'<>\s]+/g, '#private-source-excluded')
    .replace(/data\/projects\/golden-hill\/source-logs\/[^"'<>\s]+/g, 'private-source-excluded')
    .replace(/source-logs/g, 'private-source')
    .replace(/dropbox-intake/g, 'private-intake');
  fs.writeFileSync(file, text);
}

function walkForScrub(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkForScrub(full);
    else scrubPrivateSourceStrings(full);
  }
}
walkForScrub(distDir);

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
