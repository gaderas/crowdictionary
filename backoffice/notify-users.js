var _ = require('lodash');
var Q = require('q');
var nconf = require('nconf');
var dsFactory = require('../server/build/js/dsFactory.js');
var Mailer = require('../server/build/js/account_lifecycle.js');
var util = require('util');
var appUtil = require('../shared/build/js/util.js');

var NODE_ENV = process.env.NODE_ENV;

nconf.argv().env().file({file: './config/'+NODE_ENV+'.config.json'});

console.log(util.inspect(Mailer));
var db = dsFactory(nconf),
    mailer = new Mailer(nconf),
    localeRootMap = nconf.get('localeRootMap'),
    localeFromAddressMap = nconf.get('mailer:localeFromAddressMap');


//resetContributorFields, e.g.: [{password_reset_status: 'emailed'}]
var pEmailContributor = function (kind, contributor, sentCodeFieldName, mailerFunc, resetContributorFields) {
    var code = contributor[sentCodeFieldName],
        nowTs = appUtil.toUTCISOString(new Date()),
        lang = contributor.preferred_langs.split(',')[0],
        rootUrl = localeRootMap[lang],
        fromAddress = localeFromAddressMap[lang];
    console.log("on emailContributor()");
    return Q.allSettled([
        db.putNotification({type: 'email', kind: kind, code: code, recipient: contributor.email, contributor_id: contributor.id, scheduled: nowTs, sent: nowTs}),
        mailerFunc.call(null, fromAddress, contributor.email, lang, rootUrl, code)
    ])
        .spread(function (notificationState, mailerState) {
            console.log("on emailContributor(), spread()");
            var send_status =  ('fulfilled' === mailerState.state && 'success') || ('rejected' === mailerState.state && 'fail') || 'none',
                send_status_message = ('fulfilled' === mailerState.state && mailerState.value) || ('rejected' === mailerState.state && mailerState.reason) || '',
                nowTs = appUtil.toUTCISOString(new Date()),
                updateContributorParams;
            if ('rejected' === notificationState.state) {
                console.error("error recording new notification status: " + notificationState.reason);
            }
            updateContributorParams = _.merge({id: contributor.id, email: contributor.email}, resetContributorFields);
            return Q.allSettled([
                db.putNotification({type: 'email', kind: kind, code: code, recipient: contributor.email, contributor_id: contributor.id, send_status_received: nowTs, send_status: send_status, send_status_message: JSON.stringify(send_status_message)}),
                db.updateContributor({email: contributor.email}, updateContributorParams)
            ])
                .spread(function (notificationState, contributorState) {
                    if ('rejected' === notificationState.state) {
                        console.error("error updating notification status: " + notificationState.reason);
                    }
                    if ('rejected' === contributorState.state) {
                        console.error("error updating contributor status: " + contributorState.reason);
                    }
                });
        })
        .fail(function (err) {
            console.error("something went utterly wrong!: " + err);
        });
};

var pEmailPasswordRecoveryRequests = function () {
    return db.getContributors({password_reset_status: 'requested'})
        .then(function (contributors) {
            console.log("contributors that we'll send password reset emails to: " + JSON.stringify(contributors));
            var pEmails = _.map(contributors, function (contributor) {
                var mailerFunc = mailer.sendPasswordRecoveryEmail.bind(mailer); //.bind(mailer, contributor.email, lang, rootUrl, code);
                return pEmailContributor('password_reset', contributor, 'password_reset_code', mailerFunc, {password_reset_status: 'emailed'});
            });
            return Q.all(pEmails);
        });
};
var pEmailNewContributors = function () {
    return db.getContributors({status: 'new'})
        .then(function (contributors) {
            console.log("contributors that we'll send activation emails to: " + JSON.stringify(contributors));
            var pEmails = _.map(contributors, function (contributor) {
                var mailerFunc = mailer.sendAccountVerificationEmail.bind(mailer); //.bind(mailer, contributor.email, lang, rootUrl, code);
                return pEmailContributor('account_verification', contributor, 'verification_code', mailerFunc, {status: 'pendingVerification'});
            });
            return Q.all(pEmails);
        });
};


pEmailNewContributors()
    .then(pEmailPasswordRecoveryRequests)
    .then(function () {
        return db.end();
    });
