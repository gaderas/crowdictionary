var chai = require('chai');
var appUtil = require('../shared/src/jsx/util.js');

console.log("appUtil: " + appUtil);

var should = chai.should();

var l10nData = appUtil.getLangBasedOnHostname('es-mx.fsf.cx', ['es-MX', 'en-US', 'fr-FR']);

console.log(JSON.stringify(l10nData));
