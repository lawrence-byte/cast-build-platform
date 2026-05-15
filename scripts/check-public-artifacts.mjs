#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['public', 'dist'];
const blockedDirs = /(^|[/\\])(source-logs|dropbox-intake|source-artifacts|raw|private)([/\\]|$)/i;
const blockedExtensions = new Set(['.pdf', '.xlsx', '.xls', '.csv', '.zip']);
const textExtensions = new Set(['.html', '.js', '.css', '.json', '.txt', '.md', '.svg']);
const privateText = /\/Users\/|CAST Community Dropbox|\/Volumes\/CAST Drive|00_PROCORE DATA TIE|dropbox-intake|source-logs|source-artifacts/i;
const failures = [];

function walk(dir, visitor) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, visitor);
    else visitor(full);
  }
}

for (const rootName of scanRoots) {
  const absoluteRoot = join(root, rootName);
  if (!existsSync(absoluteRoot)) continue;
  walk(absoluteRoot, (file) => {
    const rel = relative(root, file);
    const ext = extname(file).toLowerCase();
    if (blockedDirs.test(rel) || blockedExtensions.has(ext)) {
      failures.push(`${rel}: raw/private artifact must not be deployable`);
      return;
    }
    if (textExtensions.has(ext)) {
      const text = readFileSync(file, 'utf8');
      if (privateText.test(text)) failures.push(`${rel}: private source path/string leaked into deployable text`);
    }
  });
}

if (failures.length) {
  console.error('CAST Build public artifact check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const scanned = scanRoots
  .filter((rootName) => existsSync(join(root, rootName)) && statSync(join(root, rootName)).isDirectory())
  .join(', ');
console.log(`CAST Build public artifact check passed (${scanned || 'no public roots found'}).`);
