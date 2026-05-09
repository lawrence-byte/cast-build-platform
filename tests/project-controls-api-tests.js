const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { handleProjectControlsApi, hasAuth, isProtected } = require('../api/_lib/project-controls-api');

function call(url, headers = {}, env = {}) {
  let statusCode = 0;
  let payload = '';
  const req = { url, headers: { host: 'cast-build.test', ...headers }, method: 'GET' };
  const res = {
    writeHead(status) { statusCode = status; },
    end(body) { payload = body; },
  };
  handleProjectControlsApi(req, res, env);
  return { statusCode, body: JSON.parse(payload) };
}

assert.strictEqual(hasAuth({ headers: {} }), false);
assert.strictEqual(hasAuth({ headers: { authorization: 'Bearer abc.def-123' } }), true);
assert.strictEqual(hasAuth({ headers: { cookie: 'other=x; cast_build_session=abc' } }), true);
assert.strictEqual(isProtected('/api/projects/golden-hill/rfis'), true);
assert.strictEqual(isProtected('/api/projects/golden-hill/submittals/sub-1'), true);
assert.strictEqual(isProtected('/api/unknown'), false);

let res = call('/api/health');
assert.strictEqual(res.statusCode, 200);
assert.strictEqual(res.body.ok, true);
assert.strictEqual(res.body.backendConfigured, false);

res = call('/api/projects/golden-hill/rfis');
assert.strictEqual(res.statusCode, 401);
assert.strictEqual(res.body.code, 'AUTH_REQUIRED');

res = call('/api/projects/golden-hill/submittals', { authorization: 'Bearer test-token' });
assert.strictEqual(res.statusCode, 501);
assert.strictEqual(res.body.code, 'BACKEND_NOT_CONFIGURED');

res = call('/api/projects/golden-hill/distribution', { cookie: 'cast_build_session=test' }, { CAST_BUILD_API_URL: 'https://backend.example' });
assert.strictEqual(res.statusCode, 501);
assert.strictEqual(res.body.code, 'HANDLER_NOT_IMPLEMENTED');

const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
assert(!vercel.rewrites.some((row) => row.source === '/api/:path*'), 'Vercel must not rewrite /api/* to a static placeholder; functions must fail closed.');

console.log('Project controls API fail-closed tests passed.');
