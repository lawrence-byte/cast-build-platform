const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const defaultSource = '/Volumes/CAST Drive/Lawrence Howard/CAST Community/CAST Build/Projects/Golden Hill- Cast Build';
const fallbackSource = path.join(root, 'data/projects/golden-hill/dropbox-intake/extracted-20260506-050901/Alüm');
const sourceRoot = process.env.ALUM_PROJECT_SOURCE_DIR || process.argv[2] || (fs.existsSync(defaultSource) ? defaultSource : fallbackSource);
const dataOut = path.join(root, 'data/projects/golden-hill/project-control-center.json');
const publicOut = path.join(root, 'public/data/projects/golden-hill/project-control-center.json');
const generatedAt = new Date().toISOString();

const managementAreas = [
  { id: 'schedule', label: 'Schedule / Lookahead', terms: [/schedule/i, /lookahead/i, /logistics/i], modules: ['Schedule Brain', 'Trade recovery', 'Lookahead planning'] },
  { id: 'rfi', label: 'RFIs / Design Decisions', terms: [/rfi/i, /request for information/i], modules: ['Open design questions', 'Field blockers', 'Decision turnaround'] },
  { id: 'submittals', label: 'Submittals / Procurement', terms: [/submittal/i, /shop drawing/i, /product data/i, /procurement/i], modules: ['Submittal register', 'Long-lead material status', 'Revise/resubmit pressure'] },
  { id: 'drawings', label: 'Drawings / Specs', terms: [/drawing/i, /plan/i, /spec/i, /permit/i], modules: ['Current set control', 'ASI/bulletin tracking', 'Field reference'] },
  { id: 'financial', label: 'Budget / Commitments / Accounting', terms: [/budget/i, /commitment/i, /contract/i, /change/i, /billing/i, /invoice/i, /accounting/i, /sov/i, /pay app/i], modules: ['Forecast', 'Commitment coverage', 'Change exposure'] },
  { id: 'quality', label: 'Quality / Punch / Inspections', terms: [/quality/i, /punch/i, /inspection/i, /observation/i, /test/i, /commission/i], modules: ['QA/QC', 'Punch readiness', 'Inspection queue'] },
  { id: 'daily', label: 'Daily Logs / Field Reports', terms: [/daily/i, /log/i, /report/i, /photo/i], modules: ['Daily report intelligence', 'Manpower signals', 'Weather / field constraints'] },
  { id: 'closeout', label: 'Closeout / Turnover', terms: [/closeout/i, /warranty/i, /o&m/i, /operation/i, /manual/i, /record drawing/i, /as-built/i], modules: ['O&M / warranties', 'Record drawings', 'Turnover checklist'] },
  { id: 'directory', label: 'Directory / Correspondence', terms: [/directory/i, /contact/i, /correspondence/i, /meeting/i, /minute/i], modules: ['Contacts', 'Meeting minutes', 'Correspondence log'] },
  { id: 'safety', label: 'Safety / Logistics / Site Control', terms: [/safety/i, /site/i, /logistics/i, /crane/i, /pump/i, /osha/i], modules: ['Safety docs', 'Site logistics', 'Access constraints'] },
  { id: 'utilities', label: 'Utilities / Energization', terms: [/utility/i, /sdg/i, /power/i, /gas/i, /water/i, /sewer/i, /meter/i, /energize/i], modules: ['Utility releases', 'Meter/gear path', 'Energization blockers'] }
];
const kindMap = [
  [/\.mpp$/i, 'schedule-source'], [/\.lspx$/i, 'schedule-package'], [/\.xml$/i, 'structured-schedule'],
  [/\.xlsx?$/i, 'spreadsheet'], [/\.csv$/i, 'tabular-export'], [/\.pdf$/i, 'portable-document'], [/\.docx?$/i, 'word-document'],
  [/\.jpe?g$|\.png$/i, 'image'], [/\.dwg$|\.rvt$|\.ifc$/i, 'model-or-cad'], [/\.zip$/i, 'archive'], [/\.json$/i, 'structured-data']
];
function kindFor(name) { return (kindMap.find(([re]) => re.test(name)) || [null, 'other'])[1]; }
function safeName(name) { return path.basename(name).replace(/^\._/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Untitled'; }
function areaFor(rel) { const text = rel.replace(/[/\\]/g, ' '); const hits = managementAreas.filter(a => a.terms.some(t => t.test(text))); return hits[0] || { id: 'documents', label: 'Documents / Data Room', modules: ['Document control'] }; }
function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function walk(dir, visitor, rel = '') { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (entry.name === '.DS_Store' || entry.name.startsWith('._')) continue; const full = path.join(dir, entry.name); const childRel = rel ? `${rel}/${entry.name}` : entry.name; visitor(full, childRel, entry); if (entry.isDirectory()) walk(full, visitor, childRel); } }
function loadJsonMaybe(file) { try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); } catch { return null; } }
function formatMoney(value) { return typeof value === 'number' ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'; }

const result = {
  project_id: 'golden-hill',
  project_name: 'Alüm / Golden Hill',
  generated_at: generatedAt,
  source_status: fs.existsSync(sourceRoot) ? 'indexed' : 'source_unavailable',
  source_basis: 'Full private Alüm project folder scan. Published output is sanitized metadata only: counts, categories, safe titles, management reads, and next actions.',
  scan_scope: { folder_count: 0, file_count: 0, total_bytes: 0 },
  management_areas: [],
  recent_activity: [],
  management_snapshot: {},
  coordination_focus: [],
  control_priorities: [],
  management_needs: [],
  source_gaps: [],
  guardrails: [
    'No raw project files are published.',
    'No private folder paths are published.',
    'External correspondence stays draft-only until approved.',
    'CAST Build stays construction/project-controls only.'
  ]
};
if (!fs.existsSync(sourceRoot)) { writeJson(dataOut, result); writeJson(publicOut, result); console.log('Alüm source unavailable.'); process.exit(0); }

const areas = new Map(managementAreas.concat([{ id: 'documents', label: 'Documents / Data Room', modules: ['Document control'] }]).map(a => [a.id, { id: a.id, label: a.label, modules: a.modules || [], folder_count: 0, file_count: 0, total_bytes: 0, kinds: {}, recent_items: [], management_read: '', next_actions: [] }]));
const folders = [];
walk(sourceRoot, (full, rel, entry) => {
  const area = areaFor(rel);
  const bucket = areas.get(area.id) || areas.get('documents');
  if (entry.isDirectory()) { result.scan_scope.folder_count += 1; bucket.folder_count += 1; folders.push(rel); return; }
  const st = fs.statSync(full);
  const kind = kindFor(entry.name);
  result.scan_scope.file_count += 1; result.scan_scope.total_bytes += st.size;
  bucket.file_count += 1; bucket.total_bytes += st.size; bucket.kinds[kind] = (bucket.kinds[kind] || 0) + 1;
  const item = { title: safeName(entry.name), kind, area: bucket.label, updated_at: st.mtime.toISOString().slice(0, 10), size_kb: Math.round(st.size / 1024) };
  bucket.recent_items.push(item); result.recent_activity.push(item);
});
for (const bucket of areas.values()) bucket.recent_items.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
result.recent_activity.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
result.recent_activity = result.recent_activity.slice(0, 24);

const rfi = loadJsonMaybe('data/projects/golden-hill/rfi-summary.json');
const sub = loadJsonMaybe('data/projects/golden-hill/submittal-summary.json');
const budget = loadJsonMaybe('data/projects/golden-hill/procore-information/budget/budget-summary.json');
const tieout = loadJsonMaybe('data/projects/golden-hill/accounting-budget/accounting-budget-tieout.json');
const schedule = loadJsonMaybe('data/projects/golden-hill/schedule/superintendent-schedule.json');
const docIntel = loadJsonMaybe('data/projects/golden-hill/document-intelligence/summary.json');
const scheduleStatusCounts = (schedule?.work_packages || []).reduce((acc, item) => { acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1; return acc; }, {});
const subTypeCounts = sub?.typeCounts || {};
const closeoutSubmittalCount = (subTypeCounts['Operation & Maintenance Manuals (O&Ms)'] || 0) + (subTypeCounts['Record Drawing'] || 0) + (subTypeCounts['Product Warranty'] || 0) + (subTypeCounts['Attic Stock/Extra Material'] || 0);
const budgetMetrics = budget?.metrics || {};

function setRead(id, read, actions = []) { const b = areas.get(id); if (b) { b.management_read = read; b.next_actions = actions; } }
setRead('schedule', `${schedule?.work_packages?.length || 0} superintendent work packages and ${schedule?.sub_directives?.length || 0} subcontractor directives are available.`, ['Run daily voice updates by trade/location/percent complete.', 'Use recovery-watch drafts for trades that cannot meet current windows.', 'Keep a verified correspondence log before sending notices.']);
setRead('rfi', `${rfi?.openCount ?? rfi?.openItems?.length ?? 'Open'} RFI items should be treated as schedule constraints until cleared.`, ['Rank RFIs by field impact.', 'Push overdue design decisions into weekly OAC agenda.', 'Connect blocker RFIs to affected trade work packages.']);
setRead('submittals', `${sub?.openOrDraftCount ?? 'Open/draft'} submittals plus ${sub?.statusCounts?.['Revise & Resubmit'] ?? 0} revise/resubmit items need procurement pressure.`, ['Separate true procurement blockers from paperwork cleanup.', 'Assign responsible contractor/date for revise-resubmit items.', 'Flag long-lead materials against schedule windows.']);
setRead('financial', budget ? `Budget and forecast data are indexed; tie-out exceptions should feed management priorities before commitments are treated as stable.` : 'Budget/commitment data should be indexed and reconciled.', ['Review budget exceptions.', 'Tie commitments and pending changes to forecast.', 'Escalate accounting tie-out mismatches.']);
setRead('quality', 'Quality, inspections, and punch items should be connected to turnover windows by floor/area.', ['Create inspection readiness queue.', 'Link punch/open observations to responsible trade.', 'Track reinspection/backwalk dates.']);
setRead('daily', 'Daily logs should become field intelligence: manpower, weather, delays, deliveries, and superintendent notes.', ['Capture voice daily logs.', 'Extract manpower by trade.', 'Compare field notes to Schedule Brain work windows.']);
setRead('closeout', `${docIntel?.closeoutSignals?.length || 'Closeout'} signals should be tracked before turnover pressure begins.`, ['Start O&M/warranty matrix.', 'Track attic stock/spares.', 'Request record drawing status by trade.']);
setRead('drawings', 'Drawing/spec folders should drive current-set control and field decision clarity.', ['Identify current drawing set.', 'Track ASIs/bulletins/addenda.', 'Prevent field use of stale sheets.']);
setRead('directory', 'Directory, meeting, and correspondence controls should define who gets which requests and who can approve sends.', ['Build verified recipient map.', 'Create OAC/owner agenda from open controls.', 'Log approved outbound correspondence.']);
setRead('safety', 'Safety and logistics folders should be converted into crane/pump/access/site-flow constraints.', ['Track logistics plans by date.', 'Confirm crane/pump/scaffold access windows.', 'Surface OSHA/site constraints in lookahead.']);
setRead('utilities', 'Utilities and energization are critical turnover constraints and should stay visible until meter/gear/power release is complete.', ['Track SDGE dates.', 'Track transformer/gear/meter inspection dependencies.', 'Tie energization blockers to floor turnover.']);

result.management_areas = [...areas.values()].filter(a => a.file_count || a.folder_count).map(a => ({ ...a, recent_items: a.recent_items.slice(0, 8) })).sort((a,b)=>b.file_count-a.file_count);
result.control_priorities = [
  { priority: 'Schedule recovery / trade pressure', owner: 'Superintendent + Project Controls', signal: schedule ? `${schedule.sub_directives.length} trade directives` : 'Schedule Brain needs refresh', action: 'Use Schedule Brain as daily trade directive/recovery-plan tool.' },
  { priority: 'Design and submittal constraint clearing', owner: 'PM / Design Team', signal: `${rfi?.openCount ?? rfi?.openItems?.length ?? 'Open'} RFIs; ${sub?.openOrDraftCount ?? 'open/draft'} submittals`, action: 'Clear items blocking rough-in, inspections, procurement, and turnover.' },
  { priority: 'Budget / commitment / change control', owner: 'Project Controls + Accounting', signal: budget ? 'Budget metadata indexed' : 'Budget metadata missing', action: 'Reconcile forecast, commitments, pending changes, and accounting tie-out.' },
  { priority: 'Turnover readiness', owner: 'Superintendent + Closeout Lead', signal: 'Closeout/QA docs present in project folder', action: 'Build floor-by-floor closeout and inspection matrix.' },
  { priority: 'Verified communication map', owner: 'CAST Build', signal: 'Correspondence should become approval-gated', action: 'Map each trade/company/contact before any automated notice leaves CAST Build.' }
];
result.management_snapshot = {
  active_work_packages: scheduleStatusCounts.active_now || 0,
  verify_complete_work_packages: scheduleStatusCounts.verify_complete || 0,
  starts_soon_work_packages: scheduleStatusCounts.starts_soon || 0,
  trade_directives: schedule?.sub_directives?.length || 0,
  open_rfis: rfi?.openCount ?? rfi?.openItems?.length ?? 0,
  overdue_rfis: rfi?.overdueOpen || 0,
  open_or_draft_submittals: sub?.openOrDraftCount || 0,
  revise_resubmit_submittals: sub?.statusCounts?.['Revise & Resubmit'] || 0,
  projected_over_under: budgetMetrics['Projected over Under'] ?? null,
  committed_percent_of_revised: budgetMetrics.committedPctOfRevised ?? null,
  closeout_submittal_signals: closeoutSubmittalCount
};
result.coordination_focus = [
  { lane: 'Superintendent trade huddle', owner: 'Superintendent', signal: `${result.management_snapshot.active_work_packages} active, ${result.management_snapshot.verify_complete_work_packages} verify-complete, ${result.management_snapshot.trade_directives} trade directives`, management_move: 'Run the day by trade/location, confirm manpower and blockers, and require recovery plans where dates cannot be met.', link: '/projects/alum-schedule.html' },
  { lane: 'RFI / design blockers', owner: 'PM + Design Team', signal: `${result.management_snapshot.open_rfis} open/draft RFIs; ${result.management_snapshot.overdue_rfis} overdue`, management_move: 'Put overdue and no-due-date RFIs on the OAC agenda with a named decision owner and field impact.', link: '/projects/alum-rfis.html' },
  { lane: 'Submittal / procurement pressure', owner: 'PM + Responsible Contractors', signal: `${result.management_snapshot.open_or_draft_submittals} open/draft; ${result.management_snapshot.revise_resubmit_submittals} revise/resubmit`, management_move: 'Separate procurement blockers from cleanup items, then assign contractor/date for each revise-resubmit or long-lead item.', link: '/projects/alum-submittals.html' },
  { lane: 'Budget / change control', owner: 'Project Controls + Accounting', signal: budget ? `${formatMoney(result.management_snapshot.projected_over_under)} projected over/under; ${result.management_snapshot.committed_percent_of_revised}% committed` : 'Budget source needs refresh', management_move: 'Review exceptions before treating commitments as stable; tie pending changes and accounting mismatches to forecast exposure.', link: '/projects/alum-budget-exceptions.html' },
  { lane: 'Quality / closeout readiness', owner: 'Superintendent + Closeout Lead', signal: `${result.management_snapshot.closeout_submittal_signals} O&M, warranty, record drawing, or attic-stock submittal signals`, management_move: 'Build a floor-by-floor inspection, punch, O&M, warranty, attic stock, and record drawing matrix before turnover pressure peaks.', link: '/projects/alum-closeout.html' }
];
result.management_needs = result.management_areas.map(a => ({ area: a.label, need: a.management_read || 'Review source folder and assign control owner.', next_actions: a.next_actions || [] }));
for (const required of ['schedule','rfi','submittals','financial','quality','closeout','directory']) {
  if (!areas.get(required)?.file_count && !areas.get(required)?.folder_count) result.source_gaps.push(`${required} source folder or artifacts not detected in sanitized scan.`);
}
writeJson(dataOut, result); writeJson(publicOut, result);
console.log(`Alüm project control center indexed ${result.scan_scope.file_count} files / ${result.scan_scope.folder_count} folders.`);
