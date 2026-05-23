'use strict';
const {
  getActor,
  getState,
  json,
  readBody,
  buildPermissionMatrix,
  upsertProjectMemberRole,
  listProjectMembers,
  getEffectivePermissions,
  readCastCadAuditLog,
} = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState();
  const actor = getActor(req);
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET') {
      const action = url.searchParams.get('action') || 'permission-matrix';
      if (action === 'permission-matrix') {
        return json(res, 200, { ok: true, roles: buildPermissionMatrix(), authRequiredWhenEnabled: 'CAST_CAD_REQUIRE_AUTH=true' });
      }
      if (action === 'members') {
        const result = listProjectMembers(state, { projectId: url.searchParams.get('projectId'), role: url.searchParams.get('role'), status: url.searchParams.get('status') }, actor);
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      if (action === 'effective-permissions') {
        const result = getEffectivePermissions(state, { projectId: url.searchParams.get('projectId'), userId: url.searchParams.get('userId'), email: url.searchParams.get('email') }, actor);
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      if (action === 'audit-log') {
        const result = readCastCadAuditLog(state, { entityType: url.searchParams.get('entityType'), entityId: url.searchParams.get('entityId'), actorUserId: url.searchParams.get('actorUserId') }, actor);
        return json(res, result.ok ? 200 : (result.status || 403), result);
      }
      return json(res, 422, { ok: false, error: 'Unsupported CAST CAD admin action.' });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const action = body.action || 'upsert-member-role';
    if (action !== 'upsert-member-role') return json(res, 422, { ok: false, error: 'Unsupported CAST CAD admin action.' });
    const result = upsertProjectMemberRole(state, body, actor);
    return json(res, result.ok ? 200 : (result.status || 422), result);
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message });
  }
};
