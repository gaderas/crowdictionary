var _ = require('lodash');
var Q = require('q');
var util = require('util');

var pRequest,
    selfRoot;

var setPRequest = function (incoming) {
    pRequest = incoming;
};

var setSelfRoot = function (incoming) {
    selfRoot = incoming;
};

var getAvailableLangs = function () {
    var url = selfRoot + "/static/l10n/langs.json";
    console.log("about to request");
    console.log("pRequest: " + pRequest);
    return pRequest({method: "GET", url: url, json: true})
        .then(function (res) {
            console.log("got res");
            if (200 !== res[0].statusCode) {
                throw Error("error, got status code: '" + res[0].statusCode + "' while trying to fetch a list of available l10n langs");
            }
            return res[1];
        });
};

var getL10nForLang = function (lang) {
    console.log(":)");
    var url = util.format(selfRoot + "/static/l10n/l10n-%s.json", lang);
    return pRequest({method: "GET", url: url, json: true})
        .then(function (res) {
            if (200 !== res[0].statusCode) {
                throw Error("error, got status code: '" + res[0].statusCode + "' while trying to fetch l10n data");
            }
            console.log(":-*");
            return res[1];
        })
        .fail(function (err) {
            return "error: " + err.message;
        });
};

module.exports.setPRequest = setPRequest;
module.exports.setSelfRoot = setSelfRoot;
module.exports.getAvailableLangs = getAvailableLangs;
module.exports.getL10nForLang = getL10nForLang;
