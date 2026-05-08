const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = path.join(__dirname, '..');
const defaultSource = '/Volumes/CAST Drive/Lawrence Howard/CAST Community/CAST Build/Projects/Golden Hill- Cast Build/15. SCHEDULE';
const sourceDir = process.env.ALUM_SCHEDULE_SOURCE_DIR || process.argv[2] || defaultSource;
const outData = path.join(root, 'data/projects/golden-hill/schedule/superintendent-schedule.json');
const outPublic = path.join(root, 'public/data/projects/golden-hill/schedule/superintendent-schedule.json');
const asOf = new Date(process.env.SCHEDULE_AS_OF || '2026-05-08T08:00:00-07:00');
const horizon = new Date(asOf); horizon.setDate(horizon.getDate() + 84);

function writeJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function parseDate(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function iso(d) { return d ? d.toISOString().slice(0, 10) : null; }
function fmt(d) { return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'; }
function cleanName(name) { return String(name || '').replace(/\s+/g, ' ').trim(); }
function stripExtTitle(file) { return path.basename(file).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function walk(dir, out = []) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (entry.name.startsWith('._') || entry.name === '.DS_Store') continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, out); else out.push(full); } return out; }
function findLatestExcel(dir) { return walk(dir).filter(f => /\.xlsx$/i.test(f) && /schedule/i.test(f)).sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]; }
function findLatestUpdatePdf(dir) { return walk(dir).filter(f => /\.pdf$/i.test(f) && /schedule update|GH Schedule/i.test(f)).sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]; }
function tradeFor(name) {
  const n = name.toLowerCase();
  if (/sdge|meter|energize|electrical|feeder|lighting|fire alarm|call box|efi/.test(n)) return 'Electrical / SDGE';
  if (/fire sprinkler|sprinkler|fs rough/.test(n)) return 'Fire Sprinkler';
  if (/plumbing|hot water|toilet|shower|pool|gas/.test(n)) return 'Plumbing';
  if (/hvac|mechanical|condenser|boiler|ac units/.test(n)) return 'Mechanical / HVAC';
  if (/frame|framing|drywall|taping|ceiling|soffit|insulation|pre-rock/.test(n)) return 'Framing / Drywall';
  if (/paint|touch-up|baseboard/.test(n)) return 'Paint / Finish Carpentry';
  if (/cabinet|millwork|countertop|backsplash/.test(n)) return 'Millwork / Counters';
  if (/tile|waterproof|flooring|shower door/.test(n)) return 'Tile / Flooring';
  if (/door|hardware|hollow metal/.test(n)) return 'Doors / Hardware';
  if (/appliance/.test(n)) return 'Appliances';
  if (/window|glazing|shade/.test(n)) return 'Glazing / Shades';
  if (/stucco|plaster|lath|scratch|brown|color|scaffold/.test(n)) return 'Exterior Plaster / Scaffold';
  if (/elevator|car lift|manlift/.test(n)) return 'Elevator / Vertical Transport';
  if (/site|curb|sidewalk|alley|irrigation|planting|soil/.test(n)) return 'Sitework / Landscape';
  if (/roof|tpo|cricket/.test(n)) return 'Roofing';
  if (/inspection|punch|clean|commission|test/.test(n)) return 'QC / Inspection / Closeout';
  return 'General Construction';
}
function locationFor(name) {
  const m = name.match(/\bL(?:evel)?\s*-?\s*(\d)\b|Level\s+(\d)|\bL(\d)\b/i);
  if (m) return `Level ${m[1] || m[2] || m[3]}`;
  if (/corridor/i.test(name)) return 'Corridors';
  if (/roof/i.test(name)) return 'Roof';
  if (/pool/i.test(name)) return 'Level 7 Pool';
  if (/amen/i.test(name)) return 'Amenities';
  if (/north/i.test(name)) return 'North Elevation';
  if (/south/i.test(name)) return 'South Courtyard';
  if (/east/i.test(name)) return 'East Elevation';
  if (/utility/i.test(name)) return 'Utility Room';
  if (/25th/i.test(name)) return '25th Street';
  if (/c street/i.test(name)) return 'C Street';
  return 'Project-wide';
}
function phaseFor(name) {
  const n = name.toLowerCase();
  if (/rough|pre-rock|feeder|ceiling|soffit|framing inspection|drops/.test(n)) return 'Rough-in / pre-rock';
  if (/drywall|taping|paint|waterproof|tile|cabinet|counter|flooring|appliance|baseboard|trim|fixture/.test(n)) return 'Interior finishes';
  if (/punch|clean|inspection|commission|energize|startup|test/.test(n)) return 'Inspection / turnover';
  if (/lath|scratch|brown|color|scaffold|plaster|stucco/.test(n)) return 'Exterior skin';
  if (/curb|sidewalk|alley|irrigation|planting|site/.test(n)) return 'Sitework';
  return 'Field work';
}
function weekOf(d) { const x = new Date(d); const day = (x.getDay()+6)%7; x.setDate(x.getDate()-day); return iso(x); }
function durationDays(duration) { const m = String(duration || '').match(/([0-9.]+)\s*(day|days|wk|wks|week|weeks)/i); if (!m) return null; const n = Number(m[1]); return /wk|week/i.test(m[2]) ? n * 5 : n; }
function isSummaryTask(t) { const name = t.title; const d = durationDays(t.duration); if (d !== null && d > 35) return true; return /^(OWNER\/CONTRACTOR ACTIVITIES|OWNER|MILESTONES|PENDING MILESTONES|COMPLETE MILESTONES|CONSTRUCTION|\s*CONSTRUCTION|Interior Construction|Level \d$|Rough-In$|Finishes -? L?\d?$|Finishes|Corridors|Balconies|Project Closeout|Utilities|Procurement|Mechanical|Electrical|Fire \/ Fire alarm|Site Development|Manlift\/Elevator\/CarLift\/Chute|Manlift Construction|Elevator Construction|Elevator Installation and Inspection|Car Lift Construction|Trash Chute|Scaffolding \/ Plaster|Scaffolding|Stucco\/ Plaster|Amenity Buildout|Level \d Amenity|Level \d Interior Amenity Space|Level \d Pool|Level \d Pool Deck|Roof Activities|Utility Room Buildout|Energizing and Commissioning)$/i.test(name); }
function statusFor(start, finish) { if (finish < asOf) return 'verify_complete'; if (start <= asOf && finish >= asOf) return 'active_now'; const d14 = new Date(asOf); d14.setDate(d14.getDate()+14); if (start <= d14) return 'starts_soon'; return 'upcoming'; }
function directiveVerb(trade) {
  if (/Electrical|SDGE/.test(trade)) return 'Confirm manpower, inspections, release dates, gear/meter dependencies, and any blocker by area.';
  if (/Framing|Drywall/.test(trade)) return 'Confirm area is ready, crew count, daily production target, inspection dates, and blocker list.';
  if (/Plumbing|Fire Sprinkler|Mechanical/.test(trade)) return 'Confirm rough-in/trim dates, inspection readiness, material status, and dependencies needed from other trades.';
  if (/Exterior|Roofing|Sitework/.test(trade)) return 'Confirm access, scaffold/logistics, weather exposure, manpower, and daily production targets.';
  return 'Confirm start date, finish date, manpower, blockers, and recovery plan if dates cannot be met.';
}
function recoveryText(pkg) {
  return `${pkg.trade}: ${pkg.location} — ${pkg.title} is scheduled ${pkg.start_label} to ${pkg.finish_label}. Please confirm manpower, materials, and blockers. If you cannot meet this window, provide a written recovery plan with added manpower, corrected dates, and required decisions by end of next business day.`;
}

let result = {
  project_id: 'golden-hill',
  module: 'schedule-brain',
  generated_at: new Date().toISOString(),
  as_of: iso(asOf),
  source_status: 'source_unavailable',
  source_basis: 'Private Alüm schedule folder; sanitized output only.',
  superintendent_intent: 'Let the superintendent run the job while CAST Build turns schedule data into clear trade work directives, blocker asks, and recovery-plan pressure.',
  current_read: [],
  work_packages: [],
  sub_directives: [],
  recovery_watch: [],
  constraints_to_clear: [],
  communication_rules: [
    'Send drafts only after human approval and verified recipient check.',
    'Ask for manpower, blocker, material, and inspection status in plain language.',
    'No correspondence grants time, cost, acceleration, or change-order rights.',
    'If a trade cannot meet the schedule window, require a date-certain recovery plan.'
  ]
};

if (!fs.existsSync(sourceDir)) {
  writeJson(outData, result); writeJson(outPublic, result); console.log('Schedule brain source unavailable.'); process.exit(0);
}
const latestExcel = findLatestExcel(sourceDir);
const latestPdf = findLatestUpdatePdf(sourceDir);
if (!latestExcel) { writeJson(outData, result); writeJson(outPublic, result); console.log('No schedule export found.'); process.exit(0); }
const wb = XLSX.readFile(latestExcel, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
const tasks = [];
let currentLocation = 'Project-wide';
let currentPhase = 'Field work';
for (const r of rows) {
  const title = cleanName(r.Task_Name);
  if (/^Level \d$/i.test(title)) currentLocation = title;
  else if (/^Corridors$/i.test(title)) currentLocation = 'Corridors';
  else if (/^Elevator Front$/i.test(title)) currentLocation = 'Elevator Front';
  else if (/^Roof Activities$/i.test(title)) currentLocation = 'Roof';
  else if (/^Utility Room Buildout$/i.test(title)) currentLocation = 'Utility Room';
  else if (/^Level 7 Pool/i.test(title)) currentLocation = 'Level 7 Pool';
  else if (/^Level 7 Interior Amenity/i.test(title)) currentLocation = 'Level 7 Amenity';
  else if (/^Level 2 Amenity/i.test(title)) currentLocation = 'Level 2 Amenity';
  else if (/^(North Courtyard|South Courtyard|North & East|C Street|25th Street|Alleyway)$/i.test(title)) currentLocation = title;
  if (/^Rough-In/i.test(title)) currentPhase = 'Rough-in / pre-rock';
  else if (/^Finishes/i.test(title)) currentPhase = 'Interior finishes';
  else if (/^Corridors$/i.test(title)) currentPhase = 'Corridors';
  else if (/^Balconies$/i.test(title)) currentPhase = 'Balconies';
  const t = { id: String(r.ID || ''), title, start: parseDate(r.Start_Date), finish: parseDate(r.Finish_Date), duration: String(r.Duration || ''), predecessors: String(r.Predecessors || ''), resources: String(r.Resource_Names || ''), contextLocation: currentLocation, contextPhase: currentPhase };
  if (t.title && t.start && t.finish) tasks.push(t);
}
const fieldTasks = tasks.filter(t => t.finish >= new Date(asOf.getTime() - 7*86400000) && t.start <= horizon && !isSummaryTask(t));
const packages = fieldTasks.map(t => {
  const trade = tradeFor(t.title); const explicitLocation = locationFor(t.title); const location = explicitLocation === 'Project-wide' ? t.contextLocation : explicitLocation; const phase = phaseFor(t.title) === 'Field work' ? t.contextPhase : phaseFor(t.title);
  return { id: t.id, title: t.title, trade, location, phase, start: iso(t.start), finish: iso(t.finish), start_label: fmt(t.start), finish_label: fmt(t.finish), status: statusFor(t.start, t.finish), duration: t.duration, ask: directiveVerb(trade), predecessors: t.predecessors || null };
}).sort((a,b)=>a.start.localeCompare(b.start) || a.trade.localeCompare(b.trade));
const near = packages.filter(p => ['active_now','starts_soon','verify_complete'].includes(p.status)).slice(0, 90);
const byTrade = new Map();
for (const p of near) {
  const key = `${p.trade}__${p.location}`;
  if (!byTrade.has(key)) byTrade.set(key, []);
  byTrade.get(key).push(p);
}
const directives = [...byTrade.entries()].map(([key, items]) => {
  const [trade, location] = key.split('__');
  const first = items[0], last = items[items.length-1];
  return { trade, location, window: `${first.start_label} – ${last.finish_label}`, item_count: items.length, priority: items.some(i=>i.status==='active_now')?'active_now':'starts_soon', message: recoveryText(first), required_confirmation: ['manpower onsite', 'material status', 'inspection need', 'blockers', 'can meet dates / recovery plan if not'] };
}).sort((a,b)=>(a.priority===b.priority?0:a.priority==='active_now'?-1:1)).slice(0, 30);
const recovery = packages.filter(p => p.status === 'active_now' || (p.status === 'verify_complete' && /inspection|energize|rough|drywall|taping|plaster|lath|roof|meter|elevator/i.test(p.title))).slice(0, 25).map(p => ({ ...p, recovery_trigger: p.status === 'verify_complete' ? 'Past scheduled finish — superintendent should verify complete or request recovery.' : 'Currently active — confirm production and blockers today.', draft_notice: recoveryText(p) }));
result = {
  ...result,
  source_status: 'indexed',
  source_basis: `Current schedule read from ${stripExtTitle(latestPdf || latestExcel)} plus latest structured export ${stripExtTitle(latestExcel)}. Raw files remain private.`,
  current_read: [
    'Structural concrete/top-out sequence is effectively behind us; crane pourback and roof/utility work are near-term critical field coordination items.',
    'Near-term schedule pressure is now interiors by level, utility energization, elevator/vertical transport, roof equipment, exterior plaster/scaffold, amenities/pool, and trade inspection readiness.',
    'The superintendent should use voice updates by trade/location/% complete; CAST Build converts them into work packages and recovery-plan requests.'
  ],
  work_packages: packages.slice(0, 220),
  three_week_focus: packages.filter(p => ['active_now','starts_soon'].includes(p.status)).slice(0, 50),
  sub_directives: directives,
  recovery_watch: recovery,
  constraints_to_clear: [
    'Confirm SDGE feeder/meter/energization path and any blocker affecting floor energization.',
    'Confirm elevator install, power release, smoke doors, and inspection dates against the floor turnover sequence.',
    'Confirm rough-in inspections for Levels 5–8 before drywall/taping advances.',
    'Confirm exterior plaster/scaffold sequence does not block sitework, balcony coating, or street frontage work.',
    'Confirm pool/amenity inspection dates and material readiness.'
  ]
};
writeJson(outData, result); writeJson(outPublic, result);
console.log(`Built superintendent schedule: ${result.work_packages.length} packages, ${result.sub_directives.length} directives.`);
