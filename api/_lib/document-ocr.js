'use strict';
async function extractTextFallback(input = {}) {
  return {
    ok: false,
    provider: process.env.OCR_PROVIDER || 'not-configured',
    text: '',
    warning: 'OCR/text extraction provider is not configured. Classification used metadata and file name only.',
    needsOcr: /pdf|image|drawing/i.test(input.mimeType || input.fileName || ''),
  };
}
module.exports = { extractTextFallback };
