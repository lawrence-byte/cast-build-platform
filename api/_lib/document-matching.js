'use strict';
function matchLinkedRecords(input = {}) {
  const hay = [input.fileName, input.textSnippet].filter(Boolean).join(' ');
  const matches = [];
  for (const re of [/\bRFI[-_\s#]*(\d{1,4})\b/ig]) { let m; while ((m = re.exec(hay))) matches.push({ module: 'RFIs', label: `RFI ${m[1]}`, confidence: 0.9, duplicateWarning: true }); }
  for (const re of [/\bSUB(?:MITTAL)?[-_\s#]*(\d{1,4})\b/ig]) { let m; while ((m = re.exec(hay))) matches.push({ module: 'Submittals', label: `Submittal ${m[1]}`, confidence: 0.88, duplicateWarning: true }); }
  const drawing = hay.match(/\b([A-Z]{1,3}[-.]?\d{1,4}(?:\.\d+)?)\b/);
  if (drawing) matches.push({ module: 'Drawings', label: `Drawing ${drawing[1]}`, confidence: 0.68, duplicateWarning: false });
  const contract = hay.match(/\b(?:contract|commitment|po|proposal)[-_\s#]*([A-Z0-9-]{3,})\b/i);
  if (contract) matches.push({ module: 'Contracts', label: `Contract/Commitment ${contract[1]}`, confidence: 0.7, duplicateWarning: true });
  return matches;
}
module.exports = { matchLinkedRecords };
