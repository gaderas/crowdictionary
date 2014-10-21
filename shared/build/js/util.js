/** @jsx React.DOM */

var _ = require('lodash');
var util = require('util');
var url = require('url');

var _getObjectWithWithoutProps = function (object, props, withProps) {
    return _.reduce(object, function (acc, val, key) {
        if (withProps) {
            if (-1 !== _.indexOf(props, key)) {
                acc[key] = val;
            }
        } else {
            if (-1 === _.indexOf(props, key)) {
                acc[key] = val;
            }
        }
        return acc;
    }, {});
};

var getObjectWithProps = function (object, props) {
    return _getObjectWithWithoutProps(object, props, true);
};

var getObjectWithoutProps = function (object, props) {
    return _getObjectWithWithoutProps(object, props, false);
};

/**
 * @param object
 * @param array of string ennumerating properties that should
 *        be in return[1], but not on return[0]
 * @return array of objects. array[0] is an object that doesn't
 *         have properties with names ennumerated in specialProps,
 *         and array[1] is the complement
 */
var splitObject = function (obj, specialProps) {
    return [
        _.reduce(obj, function (acc, val, key) {
            if (-1 === _.indexOf(specialProps, key)) {
                acc[key] = val;
            }
            return acc;
        }, {}),
        _.reduce(obj, function (acc, val, key) {
            if (-1 !== _.indexOf(specialProps, key)) {
                acc[key] = val;
            }
            return acc;
        }, {})
    ];
};

var getLangBasedOnHostname = function (hostname, supportedLangs) {
    var matches = hostname.match(/^([^\.]+)\..*$/),
        firstComponentOfHostname = matches && matches[1],
        activeLang,
        activeLangCodes = _(supportedLangs)
            .map(function (langCode) {
                return {lang: langCode, lcLang: langCode.toLocaleLowerCase()};
            })
            .filter({lcLang: firstComponentOfHostname})
            .valueOf();
        activeLang = (!_.isEmpty(activeLangCodes) && !_.isEmpty(activeLangCodes[0]) && activeLangCodes[0].lang) || 'es-MX';
        return activeLang;
};

/**
 * transform a path, the kind that we pass to Router.navigate()
 * into a url (no hostname) suitable for anchor tags
 */
var aUrl = function (path, shortLangCode) {
    path = (path.match(/^\//) && path) || '/'+path;
    return (shortLangCode && '/'+shortLangCode+path) || path;
};

var getShortLangCodeFromRoot = function (root) {
    var parsedRoot = url.parse(root),
        matches = parsedRoot.pathname.match(/^\/([^\/]+)(\/|$)/),
        shortLangCode;
    if (!matches) {
        // if no matches, this locale is served from "root" path
        shortLangCode = '';
        //throw Error("couldn't find shortLangCode for pathname: " + parsedRoot.pathname);
    } else {
        shortLangCode = matches[1];
    }
    return shortLangCode;
};

var toUTCISOString = function (date) {
    var pad = function (n) {
        return n<10 ? '0'+n : n
    };
    return util.format("%d-%d-%dT%d:%d:%d\.%d", date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate()), pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds()), date.getUTCMilliseconds());
};


module.exports.getObjectWithProps = getObjectWithProps;
module.exports.getObjectWithoutProps = getObjectWithoutProps;
module.exports.splitObject = splitObject;
module.exports.getLangBasedOnHostname = getLangBasedOnHostname;
module.exports.aUrl = aUrl;
module.exports.getShortLangCodeFromRoot = getShortLangCodeFromRoot;
module.exports.toUTCISOString = toUTCISOString;
