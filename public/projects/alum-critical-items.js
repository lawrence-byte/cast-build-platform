// Shared Alüm critical item rules.
// Read-first helper used by dashboard, command center, and open-items views.
(function () {
  'use strict';

  function escText(v) { return String(v ?? ''); }
  function rankSeverity(s) { return { critical: 0, high: 1, warning: 2, review: 3, monitor: 4 }[s] ?? 5; }
  function item(area, title, owner, signal, next, severity, link, reason) {
    return { area, title, item: title, owner: owner || 'Unassigned', signal: signal || 'Needs review', next: next || 'Confirm owner and next action.', severity: severity || 'review', link: link || '#', reason: reason || '' };
  }
  function dateValue(v) { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : null; }
  function daysUntil(v) { const d = dateValue(v); if (!d) return null; const now = new Date(); return Math.ceil((d - now) / 86400000); }
  function money(n) { return Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }

  function rfiItems(rfi) {
    const rows = [...(rfi.openItems || []), ...(rfi.recentItems || [])];
    const out = [];
    const seen = new Set();
    rows.forEach((x) => {
      const key = `${x.Number || x.Subject}|${x.Revision || 0}|${x.Status || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      const status = escText(x.Status).toLowerCase();
      const due = daysUntil(x['Due Date']);
      const owner = x['Ball In Court'] || x['Assigned Id'] || x['RFI Manager'] || 'Unassigned';
      const title = `${x.Number || 'RFI'} · ${x.Subject || 'Untitled RFI'}`;
      if (due !== null && due < 0 && /open|draft|returned|responded|revised/.test(status)) out.push(item('RFI Tracking', title, owner, `${Math.abs(due)} days overdue`, 'Escalate RFI response path and confirm decision date.', 'critical', '/projects/alum-rfis.html', 'overdue RFI'));
      else if (due !== null && due <= 7 && /open|draft|returned|responded|revised/.test(status)) out.push(item('RFI Tracking', title, owner, `Due in ${due} days`, 'Confirm reviewer path before field/schedule impact grows.', 'warning', '/projects/alum-rfis.html', 'due soon RFI'));
      else if (/draft/.test(status)) out.push(item('RFI Tracking', title, owner, 'Draft RFI', 'Validate scope, manager, and due date before issuing.', 'review', '/projects/alum-rfis.html', 'draft RFI'));
      if (!x['Ball In Court'] && !x['Assigned Id']) out.push(item('RFI Tracking', title, owner, 'Missing Ball in Court', 'Assign a responsible reviewer/responder.', 'warning', '/projects/alum-rfis.html', 'missing BIC'));
      if (!x['Due Date'] && /open|draft/.test(status)) out.push(item('RFI Tracking', title, owner, 'Missing due date', 'Set a due date or document why it is not required.', 'review', '/projects/alum-rfis.html', 'missing due date'));
      if (!x['Issued RFI Link'] && /open|draft/.test(status)) out.push(item('RFI Tracking', title, owner, 'Missing Issued RFI link', 'Attach controlled Issued RFI package link before distribution.', 'review', '/projects/alum-rfis.html', 'missing issued link'));
      if (/closed|responded/.test(status) && !x['Responded RFI Link']) out.push(item('RFI Tracking', title, owner, 'Missing Responded RFI link', 'Attach controlled response package link for closeout record.', 'review', '/projects/alum-rfis.html', 'missing responded link'));
    });
    if (Number(rfi.folderMissingTieOutCount || 0) > 0) out.push(item('Document Controls', `${rfi.folderMissingTieOutCount} RFI folder records need tie-out`, 'Document controls', 'Folder/register mismatch', 'Tie folder PDFs back to the current RFI register.', 'critical', '/projects/alum-rfis.html', 'RFI register mismatch'));
    return out;
  }

  function submittalItems(sub) {
    const rows = (sub.sampleItems || []).filter((x) => /open|draft|revise|submitted|under review/i.test(x.Status || ''));
    const out = [];
    rows.slice(0, 250).forEach((x) => {
      const status = escText(x.Status).toLowerCase();
      const due = daysUntil(x['Final Due Date']);
      const owner = x['Responsible Contractor'] || x['Ball In Court'] || 'Unassigned';
      const title = `${x['Submittal Number'] || 'Submittal'} · ${x.Title || 'Untitled Submittal'}`;
      const hasOwnerField = Object.prototype.hasOwnProperty.call(x, 'Responsible Contractor') || Object.prototype.hasOwnProperty.call(x, 'Ball In Court');
      const hasIssuedLinkField = Object.prototype.hasOwnProperty.call(x, 'Issued Submittal Link');
      const hasReturnedLinkField = Object.prototype.hasOwnProperty.call(x, 'Returned Submittal Link');
      if (due !== null && due < 0 && /open|draft|revise|submitted|under review/.test(status)) out.push(item('Submittal Tracking', title, owner, `${Math.abs(due)} days overdue`, 'Escalate review/resubmittal path and set response target.', 'critical', '/projects/alum-submittals.html', 'overdue submittal'));
      else if (/revise/.test(status)) out.push(item('Submittal Tracking', title, owner, 'Revise & Resubmit', 'Confirm revision owner and resubmittal scope.', 'warning', '/projects/alum-submittals.html', 'revise and resubmit'));
      else if (/draft/.test(status)) out.push(item('Submittal Tracking', title, owner, 'Draft submittal', 'Complete metadata before routing.', 'review', '/projects/alum-submittals.html', 'draft submittal'));
      if (hasOwnerField && (!owner || owner === 'Unassigned')) out.push(item('Submittal Tracking', title, owner, 'Missing owner', 'Assign responsible contractor/submittal manager.', 'warning', '/projects/alum-submittals.html', 'missing owner'));
      if (hasIssuedLinkField && !x['Issued Submittal Link'] && /open|draft|submitted|under review/.test(status)) out.push(item('Submittal Tracking', title, owner, 'Missing Issued Submittal link', 'Attach controlled issued package link before distribution.', 'review', '/projects/alum-submittals.html', 'missing issued link'));
      if (hasReturnedLinkField && /returned|revise/.test(status) && !x['Returned Submittal Link']) out.push(item('Submittal Tracking', title, owner, 'Missing Returned Submittal link', 'Attach controlled returned/stamped package link.', 'review', '/projects/alum-submittals.html', 'missing returned link'));
    });
    if (Number(sub.folderDocumentCount || 0) > Number(sub.total || 0)) out.push(item('Document Controls', `${Number(sub.folderDocumentCount || 0) - Number(sub.total || 0)} submittal documents exceed log count`, 'Document controls', 'Folder/register reconciliation gap', 'Reconcile folder documents to active server submittal register.', 'critical', '/projects/alum-submittals.html', 'submittal reconciliation gap'));
    return out;
  }

  function budgetItems(budget) {
    return (budget.rows || []).map((r) => {
      const revised = Number(r['Revised Budget'] || 0), committed = Number(r['Committed Costs'] || 0), jtd = Number(r['Job to Date Costs'] || 0), direct = Number(r['Direct Costs'] || 0);
      const code = r['Budget Code'] || r['Cost Code Tier 1'] || 'Budget row';
      const title = `${code} · ${r['Budget Code Description'] || ''}`;
      if (revised > 0 && committed > revised * 1.05) return item('Financial Controls', title, r['Cost Type'] || 'Budget controls', `${money(committed)} committed vs ${money(revised)} budget`, 'Confirm buyout/commitment amount and pending revision or offset.', 'critical', '/projects/alum-budget-exceptions.html', 'over committed');
      if (revised > 10000 && committed === 0 && jtd > 0) return item('Financial Controls', title, r['Cost Type'] || 'Budget controls', `${money(jtd)} JTD with no commitment`, 'Confirm direct/self-perform treatment or missing commitment coverage.', 'critical', '/projects/alum-commitments.html', 'spend without commitment');
      if (revised > 25000 && committed > 0 && committed / revised < .5) return item('Financial Controls', title, r['Cost Type'] || 'Budget controls', `${Math.round(committed / revised * 100)}% commitment coverage`, 'Confirm procurement status and whether remaining scope is bought out.', 'warning', '/projects/alum-commitments.html', 'low commitment coverage');
      if (revised > 10000 && committed === 0 && direct > 0) return item('Financial Controls', title, r['Cost Type'] || 'Budget controls', `${money(direct)} direct costs`, 'Confirm direct-cost treatment and forecast responsibility.', 'review', '/projects/alum-accounting-tieout.html', 'direct cost review');
      return null;
    }).filter(Boolean);
  }

  function accountingItems(acct) {
    return (acct.exceptions || []).map((e) => item('Accounting Tie-Out', e.check || 'Tie-out exception', 'Accounting controls', money(e.delta), e.nextStep || 'Review reconciliation mapping.', e.severity === 'high' ? 'critical' : 'warning', '/projects/alum-accounting-tieout.html', 'accounting exception'));
  }

  function documentItems(doc) {
    const out = [];
    if (Number(doc.ocrCandidateCount || 0) > 100) out.push(item('Document Controls', `${doc.ocrCandidateCount} OCR candidates`, 'Document controls', 'High OCR backlog', 'Prioritize high-value specs, logs, and financial PDFs for approved OCR.', 'warning', '/projects/alum-document-intelligence.html', 'OCR backlog'));
    return out;
  }

  function buildCriticalItems({ rfi = {}, sub = {}, budget = {}, acct = {}, doc = {} }) {
    const all = [...rfiItems(rfi), ...submittalItems(sub), ...budgetItems(budget), ...accountingItems(acct), ...documentItems(doc)];
    return all.sort((a, b) => rankSeverity(a.severity) - rankSeverity(b.severity) || String(a.area).localeCompare(String(b.area)) || String(a.title).localeCompare(String(b.title)));
  }

  window.AlumCriticalItems = { buildCriticalItems, rankSeverity, item };
})();
