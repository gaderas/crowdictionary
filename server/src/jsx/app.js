/** @jsx React.DOM */

var path = require('path');
var approot = path.dirname(path.dirname(path.dirname(__dirname)));

var Q = require('q');
var request = require('request');
var React = require('react');
var serve = require('koa-static');
var koa = require('koa');
var compress = require('koa-compress');
var mount = require('koa-mount');
var router = require('koa-router');
var bodyParser = require('koa-body-parser');
var _ = require('lodash');
var app = koa();
var appReact = koa();
var appWs = koa();
var shared = require('../../../shared/build/js/app.js');
//var Mock = require('./data.mock.js');
var dsFactory = require('./dsFactory.js');
var DBIP = require('./dbip.js');
var nconf = require('nconf');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var appUtil = require('../../../shared/build/js/util.js');
var Keygrip = require('keygrip');
var crypto = require('crypto');
var url = require('url');

var NODE_ENV = process.env.NODE_ENV;


console.log("server...app.js __dirname: " + __dirname);

nconf.argv().env().file({file: approot + '/config/' + NODE_ENV + '.config.json'});

console.log('nconf.get("NODE_ENV"): ' + nconf.get('NODE_ENV'));

var mockData = dsFactory(nconf);
var dbip = new DBIP(nconf.get("data:dbip:dbConfig"));

console.log('mockData: ' + mockData);

var CrowDictionary = shared.CrowDictionary,
    routesInfo = shared.routesInfo,
    getNormalizedRouteInfo = shared.getNormalizedRouteInfo,
    setupRoute = shared.setupRoute,
    asyncRenderComponentToString = shared.asyncRenderComponentToString,
    setInitialState = shared.setInitialState,
    setPRequest = shared.setPRequest,
    l10n = shared.l10n,
    pCalculateStateBasedOnNormalizedRouteInfo = shared.pCalculateStateBasedOnNormalizedRouteInfo,
    aUrl = shared.aUrl;

var request = require('request');
var jar = request.jar();
var requestWithIncomingCookies = function (urlOrOpts, done) {
    var opts;
    if (_.isEmpty(urlOrOpts)) {
        throw Error("called requestWithIncomingCookies() with no url string or options object");
    }
    if ("string" === typeof urlOrOpts) {
        opts = {
            url: urlOrOpts,
            jar: jar
        };
    } else {
        opts = urlOrOpts;
        opts.jar = jar;
    }
    return request(opts, done);
};

var pRequest = Q.denodeify(requestWithIncomingCookies);

setPRequest(pRequest);

_.mixin(require('../../../shared/build/js/lodash_mixin.js'));

var generate_random_code = function () {
    var random_buffer = new Buffer((Math.random()*1000000).toString()),
        verification_code = random_buffer.toString('base64').substring(0, 15);
    return verification_code;
};


app.use(function *(next) {
    yield next;
    console.log("host: %s", this.hostname);
});
app.use(compress());
appReact.use(function *(next) {
    yield next;
    this.set("Cache-Control", "no-cache");
});
appReact.use(router(appReact));
app.keys = nconf.get("cookies:user:secrets").split(',');
appWs.use(function *(next) {
    var browserId = this.cookies.get('browserId', {signed: true}),
        keygrip = new Keygrip(app.keys),
        crumb,
        now = new Date();;
    if (!browserId) {
        try {
            browserId = keygrip.sign(crypto.randomBytes(256));
        } catch (ex) {
            console.log("couldn't generate a random browserId with error: " + ex.message);
            browserId = 'l;dsffjs;adj';
        }
        this.cookies.set('browserId', browserId, {signed: true, expires: new Date(now.getFullYear()+1, now.getMonth(), now.getDate())});
    }
    app.crumb = keygrip.sign(browserId);
    console.log('csrf middleware before yield');
    yield next;
    console.log('csrf middleware after yield');
});
appWs.use(function *(next) {
    var contributorCookie = decodeURIComponent(this.cookies.get('contributor', {signed: true})),
        contributor;
    try {
        contributor = JSON.parse(contributorCookie);
    } catch(ex) {
        contributor = null;
    }
    appWs.contributor = contributor;
    console.log('authentication middleware before yield');
    yield next;
    console.log('authentication middleware after yield');
});
// @TODO: implement CSRF prevention/crumb
appWs.use(bodyParser());
appWs.use(router(appWs));

appWs.post('/login', function *(next) {
    var email = this.request.body.email || '',
        passhash = this.request.body.passhash || '';
    if (!email) {
        this.body = {message: "email not supplied in HTTP request body!", errno: 6};
        this.status = 400;
        return
    } else if (!passhash) {
        this.body = {message: "no passhash supplied in HTTP request body!", errno: 7};
        this.status = 400;
        return;
    }
    this.body = yield mockData.getContributors({email: email})
        .then(function (contribs) {
            var contributor = contribs[0] || {};
                safeContributorInfo = appUtil.getObjectWithoutProps(contributor, ['passhash', 'verification_code']);
            console.log('contributor = ' + JSON.stringify(contributor.passhash));
            console.log('contributor.passhash = ' + contributor.passhash);
            if (contributor.passhash !== passhash) {
                console.error("passhash mismatch!");
                this.status = 403;
                return {message: "bad password provided", errno: 8};
            } else if ('yes' !== contributor.verified) {
                this.status = 403;
                return {message: "account hasn't been verified", errno: 11};
                //status: 'active', verified: 'yes'
            } else if ('new' === contributor.status || 'pendingVerification' === contributor.status || 'suspended' === contributor.status) {
                this.status = 403;
                return {message: "account hasn't been verified", errno: 12};
            }
            this.cookies.set('contributor', encodeURIComponent(JSON.stringify(safeContributorInfo)), {signed: true});
            return {message: "login successful", infono: 2};
        }.bind(this))
        .fail(function (err) {
            console.error("error on POST /login: " + err);
            return {message: "something went wrong and we couldn't log you in", errno: 9};
        }.bind(this));
});

appWs.get('/login', function *(next) {
    if (this.query.refresh) {
        this.body = yield mockData.getContributors({email: appWs.contributor.email})
            .then(function (contributorsRes) {
                if (!contributorsRes.length) {
                    throw Error("contributor not found while trying to refresh login cookie");
                }
                var contributor = contributorsRes[0],
                    safeContributorInfo = appUtil.getObjectWithoutProps(contributor, ['passhash', 'verification_code']);
                this.cookies.set('contributor', encodeURIComponent(JSON.stringify(safeContributorInfo)), {signed: true});
                return _.merge(safeContributorInfo, {crumb: app.crumb});
            }.bind(this));
        return;
    }
    yield next;
    this.status = appWs.contributor ? 200 : 401;
    this.body = appWs.contributor ? _.merge(appWs.contributor, {crumb: app.crumb}) : {message: "not logged in"};
});

appWs.get('/logout', function *(next) {
    yield next;
    this.status = 200;
    this.body = {message: "logged out", infono: 3};
    this.cookies.set('contributor', JSON.stringify(null), {signed: true});
});

appWs.get('/contributors', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    this.body = yield Q.fcall(mockData.getContributors.bind(mockData, this.query))
        .then(function (contributors) {
            return _.map(contributors, function (contributor) {
                return appUtil.getObjectWithoutProps(contributor, ['email', 'status', 'passhash', 'verification_code', 'verified', 'verification_retries', 'password_reset_status', 'password_reset_code']);
            });
        })
        .fail(function (err) {
            console.log("on fail with err: " + err + ",stack: " + err.stack);
            this.status = 500;
            return {message: "couldn't get contributors. error: " + err};
        }.bind(this));
});

appWs.get('/contributors/:contributor_id/activity', function *(next) {
    this.body = yield Q.fcall(mockData.getContributorActivity.bind(mockData, _.merge(this.query, {contributor_id: this.params.contributor_id})))
        .then(function (res) {
            return res;
        })
        .fail(function (err) {
            console.log("on fail with err: " + err);
            this.status = 500;
            return {message: "couldn't get contributor's activity. error: " + err};
        }.bind(this));
});

appWs.get('/contributors/:contributor_id/score', function *(next) {
    this.body = yield Q.fcall(mockData.getContributorScore.bind(mockData, {contributor_id: this.params.contributor_id}))
        .then(function (res) {
            return res;
        })
        .fail(function (err) {
            console.log("on fail with err: " + err);
            this.status = 500;
            return {message: "couldn't get contributor's score. error: " + err};
        }.bind(this));
});

appWs.get('/contributors/leaderboard', function *(next) {
    this.body = yield Q.fcall(mockData.getContributorLeaderboard.bind(mockData, this.query))
        .then(function (res) {
            return res;
        })
        .fail(function (err) {
            console.log("on fail with err: " + err);
            this.status = 500;
            return {message: "couldn't get contributors leaderboard. error: " + err};
        }.bind(this));
});

appWs.put('/contributors', function *(next) {
    var requestBody = appUtil.getObjectWithoutProps(this.request.body, ['status', 'verified', 'verification_code', 'verification_retries']),
        verification_code = generate_random_code();
    console.log('put /contributors incoming body: ' + JSON.stringify(this.request.body));
    if (requestBody.validateVerification) {
        if (!requestBody.email) {
            this.status = 403;
            this.body = "missing email";
            return;
        }
        this.body = yield mockData.getContributors({email: requestBody.email})
            .then(function (res) {
                var contributor = (res && res[0]) || {};
                if (_.isEmpty(contributor)) {
                    this.status = 403;
                    return {message: "contributor with email provided not found", errno: 3};
                }
                if (requestBody.validateVerification !== contributor.verification_code) {
                    this.status = 403;
                    return {message: "bad verification code provided", errno: 2};
                }
                if ('yes' === contributor.verified) {
                    this.status = 403;
                    return {message: "the user identified by the provided email is already verified", errno: 1};
                }
                return mockData.updateContributor({email: requestBody.email}, {email: requestBody.email, status: 'active', verified: 'yes'})
                    .then(function (res) {
                        return {message: "verification success", infono: 1}
                    }.bind(this))
                    .fail(function (err) {
                        this.status = 500;
                        return {message: "there was a problem trying to mark account as validated", errno: 4};
                    }.bind(this));
            }.bind(this))
            .fail(function (err) {
                this.status = 500;
                console.error(err);
                return {message: "couldn't fetch contributor data to validate verification code", errno: 5};
            }.bind(this));
        return;
    } else if (requestBody.initiate_password_recovery) {
        var contributorEmail,
            new_password_reset_code = generate_random_code();
        if (!requestBody.email) {
            this.status = 403;
            this.body = "missing email";
            return;
        }
        if (!new_password_reset_code) {
            this.status = 500;
            this.body = {message: "there was a problem generating password reset code"};
            throw Error("there was a problem generating password reset code");
        }
        contributorEmail = requestBody.email;
        this.body = yield mockData.updateContributor({email: contributorEmail}, {email: contributorEmail, password_reset_status: 'requested', password_reset_code: new_password_reset_code})
            .then(function (res) {
                var contributor;
                contributor = res[0];
                return {message: "a password reset code was created"};
            }.bind(this))
            .fail(function (err) {
                //if (err.message.match(/ER_DUP_ENTRY/) && err.message.match(/for key 'email'/))
                this.status = 500;
                return {message: "contributor to be updated was not found in database, or update failed for some other reason."};
                throw Error("sql error while updating contributor to initiate password request: message: " + err.message + ", stack: " + err.stack);
            }.bind(this));
        return;
    } else if (requestBody.password_reset_code) {
        // "password reset"
        var contributorEmail,
            password_reset_code = requestBody.password_reset_code,
            new_password = requestBody.new_password,
            new_password_confirm = requestBody.new_password_confirm;
        if (!requestBody.email) {
            this.status = 403;
            this.body = "missing email";
            return;
        }
        contributorEmail = requestBody.email;
        this.body = yield mockData.getContributors({email: contributorEmail})
            .then(function (res) {
                var contributor;
                if (!res.length) {
                    this.status = 500;
                    return {message: "contributor to be updated was not found in database"};
                }
                contributor = res[0];
                if (('requested' !== contributor.password_reset_status && 'emailed' !== contributor.password_reset_status) || !contributor.password_reset_code) {
                    // important check to avoid resetting passwords with empty string verification code
                    this.status = 403;
                    return {message: "the specified contributor hadn't requested a password reset code"};
                }
                if(contributor.password_reset_code !== password_reset_code) {
                    this.status = 403;
                    return {message: "wrong password reset code was provided"};
                }
                if (new_password !== new_password_confirm) {
                    this.status = 403;
                    return {message: "provided password and confirmation do not match"};
                }
                return mockData.updateContributor({email: contributorEmail}, {email: contributorEmail, passhash: new_password, password_reset_code: '', password_reset_status: 'not_requested'})
                    .then(function (updateContributorRes) {
                        return {message: "contributor's password was reset"};
                    })
                    .fail(function (err) {
                        console.error(err);
                        this.status = 500;
                        return {message: "something went wrong while trying to reset the contributor's password"};
                    }.bind(this));
            }.bind(this))
            .fail(function (err) {
                console.error(err);
                this.status = 500;
                return {message: "something went wrong while trying to fetch the contributor's record to check the password reset code"};
            });
        return;
    } else if (appWs.contributor) {
        // update
        if (app.crumb !== requestBody.crumb) {
            this.status = 403;
            this.body = "invalid crumb";
            return;
        }
        if (appWs.contributor.email !== this.query.email) {
            this.status = 403;
            this.body = "trying to modify a contributor record for a user other than the signed in user";
            return;
        }
        if (this.query.email !== requestBody.email) {
            this.status = 403;
            this.body = "trying to modify the contributor's email, which is not allowed";
            return;
        }
        this.body = yield mockData.updateContributor(this.query, appUtil.getObjectWithoutProps(requestBody, ['crumb']))
            .then(function (res) {
                return {message: "contributor updated"};
            })
            .fail((function (err) {
                this.status = 500;
                return {message: "couldn't update contributor. error: " + err};
            }).bind(this));
        return;
    }
    requestBody = appUtil.getObjectWithoutProps(requestBody, ['crumb']);
    requestBody.verification_code = verification_code;
    this.body = yield Q.fcall(mockData.createContributor.bind(mockData, this.query, appUtil.getObjectWithoutProps(requestBody, ['crumb'])))
        .then(function (res) {
            return {message: "contributor created"};
        })
        .fail((function (err) {
            var res = {fields: {}},
                matches,
                fieldName;
            this.status = 500;
            if (err.message.match(/ER_DUP_ENTRY/) && err.message.match(/for key 'email'/)) {
                res.fields.email = 'duplicate';
            } else if (err.message.match(/^ER_NO_DEFAULT_FOR_FIELD/) && (matches = err.message.match(/'([^']+)'/))) {
                fieldName = matches[1];
                res.fields[fieldName] = 'missing';
            } else if (err.message.match(/no email/)) {
                res.fields.email = 'missing';
            }
            res.message = "couldn't create contributor. error: " + err.message;
            return res;
        }).bind(this));
});

appWs.get('/lang/:lang/phrases', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    var params = appUtil.getObjectWithoutProps(this.query, ['lang']);
    params.lang = this.params.lang;
    if (_.isString(params.search)) {
        this.body = yield mockData.searchPhrase(params);
    } else if (undefined !== params.phrase) {
        params.phrase = (_.isString(params.phrase) && [params.phrase]) || params.phrase; // if only one term is specified, convert into array
        this.body = yield mockData.searchPhrases(params);
    } else if (undefined !== params.id) {
        params.id = (_.isString(params.id) && [params.id]) || params.id; // if only one term is specified, convert into array
        this.body = yield mockData.searchPhrases(params);
    } else {
        this.body = yield mockData.getPhrases(params);
    }
});

appWs.get('/lang/:lang/phrases/:phrase', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    var params = appUtil.getObjectWithoutProps(this.query, ['lang', 'phrase']);
    params.lang = this.params.lang;
    params.phrase = this.params.phrase;
    this.body = yield mockData.getPhrases(params);
});

appWs.put('/lang/:lang/phrases/:phrase', function *(next) {
    console.log("phrase in URI: '" + this.params.phrase + "'");
    console.log('put /phrases incoming body: ' + JSON.stringify(this.request.body));
    var requestBody = appUtil.getObjectWithoutProps(this.request.body, ['contributor_id']),
        contributorCookie = decodeURIComponent(this.cookies.get('contributor', {signed: true})),
        contributor = JSON.parse(contributorCookie) || {};
    requestBody.contributor_id = contributor.id;
    if (!requestBody.contributor_id) {
        this.status = 401;
        this.body = {message: "unauthenticated call not allowed"};
        return;
    }
    if (requestBody.crumb !== app.crumb) {
        this.status = 401;
        this.body = {message: "invalid crumb provided"};
        return;
    }
    requestBody = appUtil.getObjectWithoutProps(requestBody, ['crumb']); // once validated, get rid of crumb
    if (this.params.phrase !== requestBody.phrase || this.params.lang !== requestBody.lang) {
        this.status = 400;
        this.body = {message: "'phrase' or 'lang' value mistmatch between URI and HTTP request body"};
        return;
    }
    this.body = yield mockData.putPhrase(requestBody)
        .then(function (res) {
            return {message: "phrase created"};
        })
        .fail((function (err) {
            this.status = 500;
            return {message: "couldn't create/update phrase. error: " + err};
        }).bind(this));
});

appWs.get('/lang/:lang/phrases/:phrase/definitions', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    var params = appUtil.getObjectWithoutProps(this.query, ['lang', 'phrase']);
    params.lang = this.params.lang;
    params.phrase = this.params.phrase;
    this.body = yield mockData.getDefinitions(params)
        .then(function (definitions) {
            var definitionIds = _.map(definitions, function (definition) {return definition.id});
            if (!definitionIds.length) {
                return definitions;
            }
            return mockData.getVotes({definition_ids: definitionIds})
                .then(function (votes) {
                    return definitionsWithVotes = _.map(definitions, function (definition) {
                        definition.votes = _.filter(votes, {definition_id: definition.id});
                        return definition;
                    });
                });
        });
});

appWs.get('/definitions', function *(next) {
    this.body = yield mockData.getDefinitions(this.query)
        .then(function (definitions) {
            var definitionIds = _.map(definitions, function (definition) {return definition.id});
            if (!definitionIds.length) {
                return definitions;
            }
            return mockData.getVotes({definition_ids: definitionIds})
                .then(function (votes) {
                    return definitionsWithVotes = _.map(definitions, function (definition) {
                        definition.votes = _.filter(votes, {definition_id: definition.id});
                        return definition;
                    });
                });
        });
});

/**
 * Up to one definition per lang/phrase/contributor, i.e.:
 * the first POST creates a record. following POSTs update record.
 */
appWs.post('/lang/:lang/phrases/:phrase/definitions', function *(next) {
    var requestBody = appUtil.getObjectWithoutProps(this.request.body, ['contributor_id']),
        contributorCookie = decodeURIComponent(this.cookies.get('contributor', {signed: true})),
        contributor = JSON.parse(contributorCookie) || {};
    requestBody.contributor_id = contributor.id;
    if (!requestBody.contributor_id) {
        this.status = 401;
        this.body = {message: "unauthenticated call not allowed"};
        return;
    }
    if (requestBody.crumb !== app.crumb) {
        this.status = 401;
        this.body = {message: "invalid crumb provided"};
        return;
    }
    if (this.params.phrase !== requestBody.phrase) {
        console.log(util.format("this.params.phrase (%s) !== requestBody.phrase (%s)", this.params.phrase, requestBody.phrase));
        this.status = 400;
        this.body = {message: "'phrase' value mistmatch between URI and HTTP request body"};
        return;
    }
    // strip out 'phrase', we'll attach 'phrase_id' below...
    // strip out 'crumb'
    requestBody = appUtil.getObjectWithoutProps(requestBody, ['phrase', 'crumb']);

    yield mockData.getPhrases({lang: this.params.lang, phrase: this.params.phrase})
        .then(function (res) {
            if (!res || !res.length) {
                throw new Error("specified phrase not found in system");
            }
            console.log("got these phrases while processing new definition insert: " + JSON.stringify(res[0]));
            return res[0].id;
        })
        .then(function (phraseId) {
            console.log('phraseId to be used for new definition insert: ' + phraseId);
            requestBody.phrase_id = phraseId;
            return mockData.putDefinition(requestBody);
        })
        .then((function (res) {
            this.status = 200;
            console.log("definition create/update res: " + JSON.stringify(res));
            return mockData.unsafeResetDefinitionVotes(res[0].last_id)
                .then(function (resResetVotes) {
                    this.body = {message: "definition created/updated", last_id: res[0].last_id};
                    return;
                }.bind(this));
        }).bind(this))
        .fail((function (err) {
            this.status = 500;
            this.body = {message: "couldn't create/update definition. error: " + err};
            return;
        }).bind(this));
});

/**
 * there's only one vote per definition/contributor (as specified in `vote` table)
 */
appWs.put('/definitions/:definition_id/vote', function *(next) {
    var requestBody = appUtil.getObjectWithoutProps(this.request.body, ['contributor_id']),
        contributorCookie = decodeURIComponent(this.cookies.get('contributor', {signed: true})),
        contributor = JSON.parse(contributorCookie) || {};
    requestBody.contributor_id = contributor.id;
    if (!requestBody.contributor_id) {
        this.status = 401;
        this.body = {message: "unauthenticated call not allowed"};
        return;
    }
    if (requestBody.crumb !== app.crumb) {
        this.status = 401;
        this.body = {message: "invalid crumb provided"};
        return;
    }
    if (this.params.definition_id != requestBody.definition_id) {
        this.status = 400;
        console.log("requestBody: " + JSON.stringify(requestBody));
        this.body = {message: "'definition_id' value mistmatch between URI and HTTP request body"};
        return;
    }
    requestBody = appUtil.getObjectWithoutProps(requestBody, ['crumb']);
    yield mockData.putVote(requestBody)
        .then((function (res) {
            this.status = 200;
            this.body = {message: "vote submitted"};
        }).bind(this))
        .fail((function (err) {
            this.status = 500;
            this.body = {message: "vote submission failed with error: " + err};
        }).bind(this));
});

appWs.get('/langDetect', function *(next) {
    //yield next;
    var ip = this.ip,
        referrer = this.header.referrer || this.query.referrer || '',
        localeRootMap = nconf.get("localeRootMap"),
        ipDbLocaleMap = nconf.get("ipDbLocaleMap"),
        parsedReferrer,
        receivedDomain,
        receivedShortLangCode,
        matches,
        matchingLocaleRootMap;
    if (!referrer) {
        this.state = 400;
        this.body = {message: "no referrer and no referrer param in query string present. can't detect language."};
        return;
    }
    parsedReferrer = url.parse(referrer);
    matches = parsedReferrer.pathname.match(/^\/([^\/]+)(\/|$)/);
    if (!matches) {
        receivedShortLangCode = '';
    } else {
        receivedShortLangCode = matches[1];
    }
    receivedDomain = parsedReferrer.hostname;
    matchingReferrerLocale = _.reduce(localeRootMap, function (acc, root, lang) {
        var parsedRoot = url.parse(root),
            re = new RegExp("^/?" + receivedShortLangCode + "(/|$)"),
            matches = parsedRoot.pathname.match(re),
            configDomain = parsedRoot.hostname,
            configShortLangCode;
        if (matches && configDomain === receivedDomain) {
            // we already have a 'shortLangCode' match. if the domains match too, we have an overall match.
            return lang;
        }
        return acc;

        /*console.log("looking for " + receivedShortLangCode + " in " + parsedRoot.pathname);
        if (matches) {
            console.log("found it!");
            return lang;
        }
        return acc;*/
    }, null);
    yield dbip.pLookup(ip)
        .then(function (geo) {
            var dbipCountry = geo.country.toLowerCase(),
                matchingIpLocale = ipDbLocaleMap[dbipCountry] || ipDbLocaleMap['default'];
            this.body = {
                langByIp: matchingIpLocale,
                langByReferrer: matchingReferrerLocale
            };
        }.bind(this))
        .fail(function (err) {
            console.error(err);
            this.status = 500;
            // @TODO should probably just return langByReferrer here instead of an error response
            this.body = {message: "something went wrong"};
        }.bind(this));
});

appWs.get('/localeEndpointsMap', function *(next) {
    var lang = this.query.lang,
        localeRootMap = nconf.get("localeEndpointsMap");
    yield next;
    if (!lang) {
        this.status = 400;
        this.body = {message: "'lang' not specified"};
        return;
    } else if (!localeRootMap || _.isEmpty(localeRootMap) || !localeRootMap[lang]) {
        this.status = 500;
        this.body = {message: "the configuration was not found, or the section about your specified 'lang' was not found in the configuration."};
        return;
    } else {
        this.body = localeRootMap[lang];
        return;
    }
});


_.forEach(nconf.get("localeRootMap"), function (root, confLang) {
    var shortLangCode = appUtil.getShortLangCodeFromRoot(root);

_.forEach(routesInfo, function (routeInfo) {
    var localRouteInfo = _.clone(routeInfo);
    //localRouteInfo.serverRoute = "/" + shortLangCode + localRouteInfo.serverRoute;
    //localRouteInfo.clientRoute = shortLangCode + "/" + localRouteInfo.clientRoute;
    localRouteInfo.shortLangCode = shortLangCode;
    console.log('adding server route ' + localRouteInfo.serverRoute + ' for short lang code ' + shortLangCode);
    /**
     * * host: host.com:8080
     * * hostname: host.com
     */
    /*var parsedRoot = url.parse(root),
        matches = parsedRoot.pathname.match(/^\/([^\/]+)(\/|$)/),
        confHostname,
        confShortLangCode;
    console.log("parsedRoot: " + JSON.stringify(parsedRoot));
    if (!matches) {
        throw Error("can't handle this root: " + root + ", confLang: " + confLang);
    }
    confHostname = parsedRoot.hostname;
    confShortLangCode = matches[1];*/
    appReact.get(aUrl(localRouteInfo.serverRoute, shortLangCode), function *(next) {
        /*if (confHostname !== this.request.hostname) {
            throw Error("expected short lang code " + confShortLangCode + " (for lang " + confLang + ") to be hit via hostname: " + confHostname + ", but was hit via " + this.request.hostname + " instead");
        }*/
        var hostname = this.request.hostname,
            baseRoot = util.format("%s://%s", this.request.protocol, this.request.host);
            //selfRoot = util.format("%s/%s", apiRoot, confShortLangCode);
        console.log("das hostname: " + hostname);
        var nRouteInfo = getNormalizedRouteInfo('server', localRouteInfo, this.params, this.query, hostname, baseRoot);
        console.log('nRouteInfo: ' + JSON.stringify(nRouteInfo, ' ', 4));

        //shared.setBaseRoot(baseRoot);

        // this is to forward these relevant app cookies for api calls to work. api is solely responsible for handling authorization.
        _.forEach(['browserId', 'contributor', 'browserId.sig', 'contributor.sig'], (function (cookieName) {
            var incomingCookie = this.cookies.get(cookieName, {signed: false}),
                cookie = cookieName + '=' + incomingCookie,
                outgoingCookie = request.cookie(cookie);

            console.log(util.format("cookieName: %s, incomingCookie: %s", cookieName, incomingCookie));
            jar.setCookie(outgoingCookie, baseRoot);
        }).bind(this));

        yield pCalculateStateBasedOnNormalizedRouteInfo(nRouteInfo)
            .then((function (state) {
                console.log("state: " + JSON.stringify(state));
                console.log("lang is: " + state.globalLang + ", and l10nData: " + JSON.stringify(state.l10nData));
                if (state.serverRedirect) {
                    this.redirect(state.serverRedirect.location);
                    return;
                }
                setInitialState(state);
                var markup = "<!DOCTYPE html>\n" + React.renderComponentToString(
                    <CrowDictionary nRouteInfo={nRouteInfo} />
                ).replace(/<html /, '<html '); // for now, don't use app cache. was: manifest="/static/assets/global_cache.manifest" 
                this.body = markup;
                return;
            }).bind(this))
            .fail(function (err) {
                console.error("error: " + (err.message) + "\nstack: \n" + (err.stack));
            });
    });
});

});


app.use(mount('/static', serve('./client/build')));
app.use(mount('/v1', appWs));
app.use(mount('/', appReact));

//app.listen(3000);

//console.log('listening on port 3000');

module.exports = appReact;
