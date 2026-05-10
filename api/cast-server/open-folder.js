'use strict';
const { handleOpenFolder } = require('../_lib/cast-server-api');
module.exports = async function route(req, res) { return handleOpenFolder(req, res); };
