'use strict';
const { handleAddFile } = require('../_lib/cast-server-api');
module.exports = async function route(req, res) { return handleAddFile(req, res); };
