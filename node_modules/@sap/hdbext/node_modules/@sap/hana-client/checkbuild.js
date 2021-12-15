'use strict';

var db = null;
var path = require('path');

const debug = require('debug')('@sap/hana-client:checkbuild');
debug.log = console.info.bind(console);

const name = 'checkbuild.js';

debug('Starting %s', name);

try {
    debug('Checking requirements...');
    db = require(path.join(__dirname, 'lib', 'index'));
    db.createConnection(); // If this step succeeds binaries can be found
    debug('Install Complete.');
} catch (err) {
    console.error('FATAL ERROR: A fatal error occurred during install.');
    console.error(err.message);
    process.exit(-1);
}
