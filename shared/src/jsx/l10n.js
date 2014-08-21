var _ = require('lodash');
var Q = require('q');
var fs = require('fs');

var pReaddir = Q.denodeify(fs.readdir);
var pReadFile = Q.denodeify(fs.readFile);

var l10nPath = 'shared/src/jsx/l10n',
    shortL10nPath = './l10n';

console.log("start");
var pL10n = pReaddir(l10nPath)
    .then(function (filenames) {
        console.log("first den");
        console.log("filenames: " + JSON.stringify(filenames));
        return _(filenames).map(function (filename) {
            console.log("filename: " + filename);
            var matches = filename.match(/^(.*l10n-(.*)).js$/),
                lang = matches && matches[2],
                filenameWithoutExtension = matches && matches[1],
                fake = console.log(filenameWithoutExtension),
                langL10n;
            if (!matches) {
                return;
            } else {
                langL10n = require(shortL10nPath + "/" + filenameWithoutExtension);
            }
            console.log("lang: " + lang);
            console.log("langL10n: " + JSON.stringify(langL10n));
            if (null === lang) {
                return;
            }
            console.log('about to return');
            return [lang, langL10n];
        })
        .filter()
        .zipObject()
        .valueOf();
    })
    .fail(function (err) {
        console.error("got this error: " + err.message);
    });

module.exports.pL10n = pL10n;
