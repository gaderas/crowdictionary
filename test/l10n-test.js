var Q = require('q');
var chai = require('chai');
var l10n = require('../shared/src/jsx/l10n.js');
var request = require('request');

var should = chai.should();

var pRequest = Q.denodeify(request);

describe("shared L10n functions", function () {
    it("yahoo should return yahoo", function () {
        return pRequest("http://yahoo.com")
            .then(function (res) {
                console.log("got this from yahoo.com: " + JSON.stringify(res));
            });
    });
});

l10n.setPRequest(Q.denodeify(request));

l10n.getAvailableLangs()
    .then(function (langs) {
        console.log("langs: " + JSON.stringify(langs));
    })
    .fail(function (err) {
        console.log("error: " + err);
    });

l10n.getL10nForLang('es-MX')
    .then(function (l10n) {
        console.log("l10n: " + JSON.stringify(l10n));
    })
    .fail(function (err) {
        console.log("error: " + err);
    });

console.log("done?");
