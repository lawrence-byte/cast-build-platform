'use strict';
function json(res, status, body) { res.statusCode = status; res.setHeader('content-type','application/json; charset=utf-8'); res.end(JSON.stringify(body)); }
module.exports = async function documentIntakeReviewRoute(req, res) {
  if (!String(req.headers.authorization || '').startsWith('Bearer ')) return json(res, 401, { ok:false, code:'AUTH_REQUIRED', message:'Admin review queue requires authentication.' });
  return json(res, 501, { ok:false, code:'DOCUMENT_REVIEW_DATABASE_NOT_CONFIGURED', message:'Review queue persistence requires DOCUMENT_DATABASE_URL / existing platform DB wiring.' });
};
