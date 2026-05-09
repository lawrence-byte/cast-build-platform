'use strict';

const { handleDocumentIntake } = require('./_lib/document-intake-api');

module.exports = async function documentIntakeRoute(req, res) {
  return handleDocumentIntake(req, res);
};
