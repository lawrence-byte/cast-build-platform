#!/usr/bin/env node
import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, "docs", "third-party-scripts.json");

const KNOWN_PATTERNS = [
  { name: "Google Tag Manager", pattern: /(?:https?:)?\/\/[^"'\s>]*googletagmanager\.com\b|\bGTM-[A-Z0-9]+\b/gi, gtm: true },
  { name: "Google Analytics", pattern: /(?:https?:)?\/\/[^"'\s>]*google-analytics\.com\b|\bG-[A-Z0-9]+\b|\bUA-\d+-\d+\b/gi },
  { name: "Google Ads", pattern: /(?:https?:)?\/\/[^"'\s>]*(?:googleadservices\.com|doubleclick\.net)\b|\bAW-\d+\b/gi },
  { name: "Segment", pattern: /(?:https?:)?\/\/[^"'\s>]*(?:segment\.com|segment\.io|cdn\.segment\.com)\b/gi },
  { name: "Hotjar", pattern: /(?:https?:)?\/\/[^"'\s>]*(?:hotjar\.com|static\.hotjar\.com|script\.hotjar\.com)\b|\bhj\(['"]/gi },
  { name: "PostHog", pattern: /(?:https?:)?\/\/[^"'\s>]*posthog\.com\b|\bposthog\.init\s*\(/gi },
  { name: "Amplitude", pattern: /(?:https?:)?\/\/[^"'\s>]*amplitude\.com\b|\bamplitude\.init\s*\(/gi },
  { name: "Mixpanel", pattern: /(?:https?:)?\/\/[^"'\s>]*mixpanel\.com\b|\bmixpanel\.init\s*\(/gi },
  { name: "Meta Pixel", pattern: /(?:https?:)?\/\/[^"'\s>]*(?:connect\.facebook\.net|facebook\.com\/tr)\b|\bfbq\s*\(/gi },
  { name: "TikTok Pixel", pattern: /(?:https?:)?\/\/[^"'\s>]*analytics\.tiktok\.com\b|\bttq\.load\s*\(/gi },
  { name: "LinkedIn Insight", pattern: /(?:https?:)?\/\/[^"'\s>]*snap\.licdn\.com\b|\blinkedin_partner_id\b/gi }
];

const SOURCE_ENTRIES = ["public", "src", "api"];
const ARTIFACT_ENTRIES = ["dist", ".next", "out", "build"];
const ROOT_FILE_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);

const IGNORED_DIRS = new Set([".git", "node_modules", ".vercel", "coverage", ".turbo"]);
const IGNORED_FILES = new Set([
  path.normalize("docs/third-party-scripts.json"),
  path.normalize("scripts/check-third-party-scripts.mjs"),
  path.normalize("scripts/check-third-party-scripts.js")
]);

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    fail(["Missing docs/third-party-scripts.json approval manifest."]);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.approvedScripts)) {
    fail(["Manifest must include an approvedScripts array."]);
  }
  const errors = [];
  manifest.approvedScripts.forEach((entry, index) => {
    const prefix = `approvedScripts[${index}]`;
    ["id", "accountOwner", "destination", "namedReader", "approvedBy", "approvedDate"].forEach((field) => {
      if (!entry[field] || typeof entry[field] !== "string") errors.push(`${prefix} missing required string field: ${field}`);
    });
    ["domains", "identifiers", "allowedEnvironments", "allowedScopes"].forEach((field) => {
      if (!Array.isArray(entry[field])) errors.push(`${prefix} missing required array field: ${field}`);
    });
    const isGtm = (entry.domains || []).some((domain) => domain.includes("googletagmanager.com")) ||
      (entry.identifiers || []).some((identifier) => /^GTM-/i.test(identifier));
    if (isGtm && (!Array.isArray(entry.transitiveTags) || entry.transitiveTags.length === 0)) {
      errors.push(`${prefix} approves GTM but does not list transitive child tags. GTM containers must list every child tag.`);
    }
  });
  if (errors.length) fail(errors);
  return manifest;
}

function walk(entry, files = []) {
  const full = path.join(repoRoot, entry);
  if (!fs.existsSync(full)) return files;
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    const base = path.basename(full);
    if (IGNORED_DIRS.has(base)) return files;
    for (const child of fs.readdirSync(full)) walk(path.join(entry, child), files);
    return files;
  }
  if (!stat.isFile()) return files;
  const rel = path.normalize(entry);
  if (IGNORED_FILES.has(rel)) return files;
  const ext = path.extname(full);
  if ([".html", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) files.push(rel);
  return files;
}

function collectFiles() {
  const files = new Set();
  for (const entry of SOURCE_ENTRIES) walk(entry).forEach((file) => files.add(file));
  for (const entry of ARTIFACT_ENTRIES) walk(entry).forEach((file) => files.add(file));
  for (const file of fs.readdirSync(repoRoot)) {
    const full = path.join(repoRoot, file);
    if (fs.statSync(full).isFile() && ROOT_FILE_EXTENSIONS.has(path.extname(file))) files.add(file);
  }
  return Array.from(files).sort();
}

function approvedTokens(manifest) {
  const tokens = new Set();
  for (const entry of manifest.approvedScripts) {
    for (const value of [...(entry.domains || []), ...(entry.identifiers || [])]) {
      if (value) tokens.add(String(value).toLowerCase());
    }
    for (const tag of entry.transitiveTags || []) {
      for (const value of [...(tag.domains || []), ...(tag.identifiers || [])]) {
        if (value) tokens.add(String(value).toLowerCase());
      }
    }
  }
  return tokens;
}

function isApproved(match, tokens) {
  const value = match.toLowerCase();
  for (const token of tokens) {
    if (token && value.includes(token)) return true;
  }
  return false;
}

function scan(files, manifest) {
  const tokens = approvedTokens(manifest);
  const findings = [];
  for (const file of files) {
    const body = fs.readFileSync(path.join(repoRoot, file), "utf8");
    for (const pattern of KNOWN_PATTERNS) {
      pattern.pattern.lastIndex = 0;
      let match;
      while ((match = pattern.pattern.exec(body)) !== null) {
        const value = match[0];
        if (isApproved(value, tokens)) continue;
        const line = body.slice(0, match.index).split(/\r?\n/).length;
        findings.push({ file, line, name: pattern.name, value });
      }
    }
  }
  return findings;
}

function fail(errors) {
  console.error("Third-party script approval check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const manifest = readManifest();
const files = collectFiles();
const findings = scan(files, manifest);
if (findings.length) {
  fail(findings.map((f) => `${f.file}:${f.line} contains unapproved ${f.name} reference: ${f.value}`));
}
console.log(`Third-party script approval check passed (${files.length} files scanned across source and build artifacts).`);
