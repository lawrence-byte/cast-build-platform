'use strict';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
};

const PROTECTED_PATTERNS = [
  /^\/api\/projects\/[^/]+\/rfis(?:\/.*)?$/,
  /^\/api\/projects\/[^/]+\/submittals(?:\/.*)?$/,
  /^\/api\/projects\/[^/]+\/access(?:\/.*)?$/,
  /^\/api\/projects\/[^/]+\/distribution(?:\/.*)?$/,
  /^\/api\/projects\/[^/]+\/contacts(?:\/.*)?$/,
];

function hasConfiguredBackend(env = process.env) {
  return Boolean(env.CAST_BUILD_API_URL || env.CAST_BUILD_DATABASE_URL || env.DATABASE_URL || (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY));
}

function requestPath(req) {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/api', `https://${host}`);
  return url.pathname.replace(/\/+$/, '') || '/api';
}

function hasAuth(req) {
  const authorization = req.headers.authorization || '';
  const cookie = req.headers.cookie || '';
  return /^Bearer\s+[-._~+/=A-Za-z0-9]+$/.test(authorization) || /(?:^|;\s*)cast_build_session=/.test(cookie);
}

function isProtected(pathname) {
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname));
}

function bodyFor(pathname, status, code, message, extra = {}) {
  return {
    ok: false,
    status,
    code,
    message,
    path: pathname,
    productionRequired: true,
    ...extra,
  };
}

function send(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body, null, 2));
}

function handleProjectControlsApi(req, res, env = process.env) {
  const pathname = requestPath(req);

  if (pathname === '/api' || pathname === '/api/health') {
    send(res, 200, {
      ok: true,
      status: 200,
      service: 'CAST Build project-controls API contract',
      backendConfigured: hasConfiguredBackend(env),
      authRequiredRoutes: ['/api/projects/:projectId/rfis', '/api/projects/:projectId/submittals', '/api/projects/:projectId/access', '/api/projects/:projectId/distribution', '/api/projects/:projectId/contacts'],
      note: hasConfiguredBackend(env)
        ? 'Backend configuration detected; route handlers still require implementation before production writes.'
        : 'No backend is configured. Protected routes fail closed instead of serving static placeholder data.',
    });
    return;
  }

  if (!isProtected(pathname)) {
    send(res, 404, bodyFor(pathname, 404, 'NOT_FOUND', 'No CAST Build API route is implemented for this path.'));
    return;
  }

  if (!hasAuth(req)) {
    send(res, 401, bodyFor(pathname, 401, 'AUTH_REQUIRED', 'Authentication is required before accessing project RFI/Submittal/contact/distribution records.'));
    return;
  }

  if (!hasConfiguredBackend(env)) {
    send(res, 501, bodyFor(pathname, 501, 'BACKEND_NOT_CONFIGURED', 'This route is intentionally fail-closed until the real backend/auth/database layer is connected.', {
      requiredBackendContracts: ['ProjectAccess', 'Contacts', 'AssignableParties', 'RFIRegisters', 'SubmittalRegisters', 'DistributionRecipients', 'AccessAuditEvents'],
    }));
    return;
  }

  send(res, 501, bodyFor(pathname, 501, 'HANDLER_NOT_IMPLEMENTED', 'Backend configuration exists, but this project-control route still needs a real server handler before production use.'));
}

module.exports = { handleProjectControlsApi, hasAuth, hasConfiguredBackend, isProtected, requestPath };
