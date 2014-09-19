var _ = require('lodash');
var Q = require('q');
var util = require('util');

var pRequest,
    baseRoot;

var setPRequest = function (incoming) {
    pRequest = incoming;
};

var setBaseRoot = function (incoming) {
    baseRoot = incoming;
};

var langDetect = function (referrer) {
    var url = util.format(baseRoot + "/v1/langDetect?referrer=%s", referrer);
    return pRequest({method: "GET", url: url, json: true})
        .then(function (res) {
            if (200 !== res[0].statusCode) {
                throw Error("error, got status code: '" + res[0].statusCode + "' while calling the endpoint to detect user's language");
            }
            return res[1];
        });
};

var getL10nForLang = function (lang) {
    console.log(":)");
    var url = util.format(baseRoot + "/static/l10n/l10n-%s.json", lang);
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
module.exports.setBaseRoot = setBaseRoot;
module.exports.getL10nForLang = getL10nForLang;
module.exports.langDetect = langDetect;
