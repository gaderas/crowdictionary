var chai = require('chai');
var appUtil = require('../shared/src/jsx/util.js');

console.log("appUtil: " + appUtil);

var should = chai.should();

var l10nData = appUtil.getL10nDataBasedOnHostname('es-mx.fsf.cx', {'es-MX': 'mex', 'en-US': 'u.s.a.'});

console.log(JSON.stringify(l10nData));
