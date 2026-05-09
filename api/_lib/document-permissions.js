'use strict';

const ROLES = ['Admin','Project Executive','Project Manager','Assistant Project Manager','Superintendent','Field Staff','Accounting','Owner','Consultant','Architect','Engineer','Subcontractor','Vendor','Read Only'];
const PERMISSIONS = ['document:upload','document:view','document:edit','document:file','document:override_classification','document:approve','document:distribute','document:share','document:admin_debug','document:view_financial_sensitive','document:view_contract_sensitive'];
const ROLE_PERMISSIONS = {
  Admin: PERMISSIONS,
  'Project Executive': PERMISSIONS.filter((p) => p !== 'document:admin_debug'),
  'Project Manager': ['document:upload','document:view','document:edit','document:file','document:override_classification','document:approve','document:distribute','document:share','document:view_contract_sensitive'],
  'Assistant Project Manager': ['document:upload','document:view','document:edit','document:file','document:distribute'],
  Superintendent: ['document:upload','document:view','document:edit','document:file'],
  'Field Staff': ['document:upload','document:view'],
  Accounting: ['document:upload','document:view','document:edit','document:file','document:approve','document:view_financial_sensitive'],
  Owner: ['document:view','document:share'],
  Consultant: ['document:upload','document:view'],
  Architect: ['document:upload','document:view','document:edit','document:distribute'],
  Engineer: ['document:upload','document:view','document:edit','document:distribute'],
  Subcontractor: ['document:upload','document:view'],
  Vendor: ['document:upload','document:view'],
  'Read Only': ['document:view'],
};
const MODULE_VIEW_RULES = {
  Financials: ['Admin','Project Executive','Accounting'],
  'Pay Applications': ['Admin','Project Executive','Accounting'],
  Invoices: ['Admin','Project Executive','Accounting'],
  Contracts: ['Admin','Project Executive','Project Manager'],
  Insurance: ['Admin','Project Executive','Project Manager','Accounting'],
  Field: ['Admin','Project Executive','Project Manager','Assistant Project Manager','Superintendent','Field Staff'],
  RFIs: ['Admin','Project Executive','Project Manager','Assistant Project Manager','Superintendent','Architect','Engineer','Consultant'],
  Submittals: ['Admin','Project Executive','Project Manager','Assistant Project Manager','Superintendent','Architect','Engineer','Consultant','Subcontractor'],
};
function hasPermission(role, permission) { return (ROLE_PERMISSIONS[role] || []).includes(permission); }
function canUpload(role) { return hasPermission(role, 'document:upload'); }
function canOverrideClassification(role) { return hasPermission(role, 'document:override_classification'); }
function canViewModule(role, module, context = {}) {
  if (context.sharedWithUser || context.assignedToUser) return true;
  if (context.externalUser) return false;
  const roles = MODULE_VIEW_RULES[module];
  if (!roles) return hasPermission(role, 'document:view');
  return roles.includes(role);
}
function permissionRulesFor(role, module, context = {}) {
  return {
    role,
    module,
    requiresLogin: true,
    permissions: ROLE_PERMISSIONS[role] || [],
    canUpload: canUpload(role),
    canOverrideClassification: canOverrideClassification(role),
    canView: canViewModule(role, module, context),
    sensitiveFinancialRestricted: ['Financials','Pay Applications','Invoices'].includes(module),
    contractRestricted: module === 'Contracts',
    externalRule: 'External users only see documents explicitly shared with them or assigned to them.',
  };
}
module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, MODULE_VIEW_RULES, hasPermission, canUpload, canOverrideClassification, canViewModule, permissionRulesFor };
