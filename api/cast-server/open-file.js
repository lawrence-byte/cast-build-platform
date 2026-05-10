'use strict';
const { handleOpenFile } = require('../_lib/cast-server-api');
module.exports = async function route(req, res) { return handleOpenFile(req, res); };
