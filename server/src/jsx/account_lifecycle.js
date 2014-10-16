var _ = require('lodash');
var Q = require('q');
var nodemailer = require('nodemailer');
var ses = require('nodemailer-ses-transport');
var fs = require('fs');
var IntlMessageFormat = require('intl-messageformat');
var appUtil = require('../../../shared/build/js/util.js');

var pReadFile = Q.nbind(fs.readFile, fs);

var L10N_DIR = './backoffice/build/l10n';

// in node, relative paths given to require() are relative to the require()d file location. relative paths given to 'fs' methods are relative to where the CWD when the script is invoked.

//http://www.gaderas.com/?a=f&b=g

var Mailer = function (nconf) {
    var localeRootMap = nconf.get('localeRootMap'),
        localeEndpointsMap = nconf.get('localeEndpointsMap'),
        mailerConf = nconf.get('mailer'),
        transport = mailerConf.transport,
        rateLimit = mailerConf.rateLimit,
        accessKeyId = mailerConf.accessKeyId,
        secretAccessKey = mailerConf.secretAccessKey,
        fromAddress = mailerConf.fromAddress,
        pLangFileReads = [];
    if ('ses' === transport) {
        this.transporter = nodemailer.createTransport(ses({
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            rateLimit: rateLimit
        }));
    } else {
        throw Error("only the 'ses' transport is supported");
    }
    this.fromAddress = fromAddress;
    _.forEach(localeEndpointsMap, function (endpoints, lang) {
        _.forEach(endpoints, function (endpoint) {
            endpoint.relUrlMsg = new IntlMessageFormat(endpoint.relUrl, 'en-US');
        });
    });
    this.localeEndpointsMap =  localeEndpointsMap;
    this.pSendMail = Q.nbind(this.transporter.sendMail, this.transporter); // nfbind, alias: denodeify. nbind is equiv. for methods.

    _.forEach(localeRootMap, function (mainUrl, lang) {
        pLangFileReads.push(pReadFile(L10N_DIR + "/l10n-" + lang + ".json"));
    })
    this.pL10nData = Q.all(pLangFileReads)
        .then(function (l10nBuffers) {
            return _.zipObject(_.map(_.keys(localeRootMap), function (lang, idx) {
                return [lang, JSON.parse(l10nBuffers[idx].toString())];
            }));
        })
        .then(function (l10nDatas) {
            _.forEach(l10nDatas, function (l10nData, lang) {
                if (!l10nData || !l10nData.messages || !l10nData.messages.AccountVerificationEmail) {
                    return;
                } else {
                    l10nData.messages.AccountVerificationEmail.body.textMsg = new IntlMessageFormat(l10nData.messages.AccountVerificationEmail.body.text, lang);
                }
                if (!l10nData || !l10nData.messages || !l10nData.messages.PasswordRecoveryEmail) {
                    return;
                } else {
                    l10nData.messages.PasswordRecoveryEmail.body.textMsg = new IntlMessageFormat(l10nData.messages.PasswordRecoveryEmail.body.text, lang);
                }
            });
            return l10nDatas;
        });
};

/*Mailer.prototype.l10nData = _.map()
    .then(function (dirContents) {
        console.log("dirContents: " + JSON.stringify(dirContents));
    });*/

Mailer.prototype.sendAccountVerificationEmail = function (recipientAddress, lang, rootUrl, code) {
    return this.pL10nData
        .then(function (l10nDatas) {
            var l10nData = l10nDatas[lang];
            return this.pSendMail({
                from: this.fromAddress,
                to: recipientAddress,
                subject: l10nData.messages.AccountVerificationEmail.title,
                text: l10nData.messages.AccountVerificationEmail.body.textMsg.format({prefilledUrl: rootUrl.replace(/\/$/, '') + this.localeEndpointsMap[lang]['verify'].relUrl + "?email=" + recipientAddress + "&verification_code=" + code, plainUrl: rootUrl.replace(/\/$/, '') + this.localeEndpointsMap[lang]['verify'].relUrl, recipientAddress: recipientAddress, accountActivationCode: code})
            })
        }.bind(this))
        .then(function (res) {
            console.log("res from sendMail: " + JSON.stringify(res));
            return res;
        })
        .fail(function (err) {
            console.log("err from sendMail: " + JSON.stringify(err));
            console.log("err.message from sendMail: " + JSON.stringify(err.message));
            throw err;
        });
};

Mailer.prototype.sendPasswordRecoveryEmail = function (recipientAddress, lang, rootUrl, code) {
    return this.pL10nData
        .then(function (l10nDatas) {
            var l10nData = l10nDatas[lang];
            return this.pSendMail({
                from: this.fromAddress,
                to: recipientAddress,
                subject: l10nData.messages.PasswordRecoveryEmail.title,
                text: l10nData.messages.PasswordRecoveryEmail.body.textMsg.format({prefilledUrl: rootUrl.replace(/\/$/, '') + this.localeEndpointsMap[lang]['passwordRecovery'].relUrl + "?email=" + recipientAddress + "&password_reset_code=" + code, plainUrl: rootUrl.replace(/\/$/, '') + this.localeEndpointsMap[lang]['passwordRecovery'].relUrl, recipientAddress: recipientAddress, passwordResetCode: code})
            })
        }.bind(this))
        .then(function (res) {
            console.log("res from sendMail: " + JSON.stringify(res));
            return res;
        })
        .fail(function (err) {
            console.log("err from sendMail: " + JSON.stringify(err));
            console.log("err.message from sendMail: " + JSON.stringify(err.message));
            throw err;
        });
};


module.exports = Mailer;
