'use strict';
const { getActor, getState, json, readBody, createReviewRoom, createReviewRoomInviteDelivery, listReviewRoomInviteEvents } = require('./_lib/cast-cad-production');

module.exports = async function handler(req, res) {
  const state = getState(); const actor = getActor(req);
  try {
    if (req.method === 'GET') {
      const action = String(req.query?.action || '').toLowerCase();
      const projectId = req.query?.projectId || req.query?.project_id || '';
      const roomId = req.query?.roomId || req.query?.room_id || '';
      if (action === 'invite-events' || action === 'invites') {
        const inviteEvents = listReviewRoomInviteEvents(state, { projectId, roomId, status: req.query?.status || '' });
        return json(res, 200, {
          ok: true,
          inviteEvents,
          inviteEventCount: inviteEvents.length,
          contract: {
            externalDeliveryRequires: 'CAST_CAD_REVIEW_ROOM_TRANSPORT or CAST_CAD_EMAIL_PROVIDER or CAST_CAD_REALTIME_PROVIDER',
            noPublicJoinLinks: true,
            requiresAuth: true,
            cacheControl: 'private, max-age=0, no-store',
          },
        });
      }
      let reviewRooms = state.reviewRooms || [];
      if (projectId) reviewRooms = reviewRooms.filter((room) => room.projectId === projectId);
      if (roomId) reviewRooms = reviewRooms.filter((room) => room.id === roomId);
      return json(res, 200, { ok: true, reviewRooms, reviewRoomCount: reviewRooms.length });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed.' }, { allow: 'GET, POST' });
    const body = await readBody(req);
    const action = String(body.action || body.type || '').toLowerCase();
    const result = action === 'invite-delivery' || action === 'send-invites'
      ? createReviewRoomInviteDelivery(state, body, actor)
      : createReviewRoom(state, body, actor);
    return json(res, result.ok ? 201 : (result.status || 422), result);
  } catch (error) { return json(res, 500, { ok: false, error: error.message }); }
};
