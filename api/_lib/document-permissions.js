'use strict';

const ROLES = ['Admin','Project Executive','Project Manager','Assistant Project Manager','Superintendent','Field Staff','Accounting','Owner','Consultant','Architect','Engineer','Subcontractor','Vendor','Read Only'];
const PERMISSIONS = ['document:upload','document:view','document:edit','document:file','document:approve','document:distribute','document:share','document:admin_debug'];
const ROLE_PERMISSIONS = {
  Admin: PERMISSIONS,
  'Project Executive': PERMISSIONS.filter((p) => p !== 'document:admin_debug'),
  'Project Manager': ['document:upload','document:view','document:edit','document:file','document:approve','document:distribute','document:share'],
  'Assistant Project Manager': ['document:upload','document:view','document:edit','document:file','document:distribute'],
  Superintendent: ['document:upload','document:view','document:edit','document:file'],
  'Field Staff': ['document:upload','document:view'],
  Accounting: ['document:upload','document:view','document:edit','document:file','document:approve'],
  Owner: ['document:view','document:share'],
  Consultant: ['document:upload','document:view'],
  Architect: ['document:upload','document:view','document:edit','document:distribute'],
  Engineer: ['document:upload','document:view','document:edit','document:distribute'],
  Subcontractor: ['document:upload','document:view'],
  Vendor: ['document:upload','document:view'],
  'Read Only': ['document:view'],
};
function hasPermission(role, permission) { return (ROLE_PERMISSIONS[role] || []).includes(permission); }
function permissionRulesFor(role) { return { role, permissions: ROLE_PERMISSIONS[role] || [], requiresLogin: true }; }
module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, hasPermission, permissionRulesFor };
