/** @jsx React.DOM */

var Q = require('q');
var request = require('request');
var React = require('react');
var serve = require('koa-static');
var koa = require('koa');
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

nconf.argv().env().file({file: './config/'+NODE_ENV+'.config.json'});

console.log('nconf.get("NODE_ENV"): ' + nconf.get('NODE_ENV'));

var mockData = dsFactory(nconf);

console.log('mockData: ' + mockData);

var CrowDictionary = shared.CrowDictionary,
    routesInfo = shared.routesInfo,
    getNormalizedRouteInfo = shared.getNormalizedRouteInfo,
    setupRoute = shared.setupRoute,
    asyncRenderComponentToString = shared.asyncRenderComponentToString,
    setInitialState = shared.setInitialState,
    setPRequest = shared.setPRequest,
    l10n = shared.l10n,
    pCalculateStateBasedOnNormalizedRouteInfo = shared.pCalculateStateBasedOnNormalizedRouteInfo;

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
    var contributorCookie = this.cookies.get('contributor', {signed: true}),
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
        this.body = {message: "email not supplied in HTTP request body!"};
        this.status = 400;
        return
    } else if (!passhash) {
        this.body = {message: "no passhash supplied in HTTP request body!"};
        this.status = 400;
        return;
    }
    yield mockData.getContributors({email: email})
        .then(function (contribs) {
            var contributor = contribs[0] || {};
            console.log('contributor = ' + JSON.stringify(contributor.passhash));
            console.log('contributor.passhash = ' + contributor.passhash);
            if (contributor.passhash !== passhash) {
                throw Error("passhash mismatch!");
            }
            return {status: 200, body: {message: "login successful"}, contributor: contributor};
        })
        .fail(function (err) {
            return {status: 401, body: err.message};
        })
        .then((function (outcome) {
            var safeContributorInfo = appUtil.getObjectWithoutProps(outcome.contributor, ['passhash', 'verification_code']);
            this.status = outcome.status;
            this.body = outcome.body;
            this.cookies.set('contributor', JSON.stringify(safeContributorInfo), {signed: true});
        }).bind(this));
});

appWs.get('/login', function *(next) {
    yield next;
    this.status = appWs.contributor ? 200 : 401;
    this.body = appWs.contributor ? _.merge(appWs.contributor, {crumb: app.crumb}) : {message: "not logged in"};
});

appWs.get('/logout', function *(next) {
    yield next;
    this.status = 200;
    this.body = {message: "logged out"};
    this.cookies.set('contributor', JSON.stringify(null), {signed: true});
});

appWs.get('/contributors', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    this.body = yield mockData.getContributors(this.query);
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

appWs.put('/contributors', function *(next) {
    var requestBody = appUtil.getObjectWithoutProps(this.request.body, ['status', 'verified', 'verification_code', 'verification_retries']);
    console.log('put /contributors incoming body: ' + JSON.stringify(this.request.body));
    if (!appWs.contributor) {
        this.status = 401;
        this.body = "not logged in";
        return;
    } else if (appWs.contributor.email !== this.query.email) {
        this.status = 403;
        this.body = "trying to modify a contributor record for a user other than the signed in user";
        return;
    } else if (app.crumb !== requestBody.crumb) {
        this.status = 403;
        this.body = "invalid crumb";
        return;
    }
    this.body = yield mockData.putContributor(this.query, appUtil.getObjectWithoutProps(requestBody, ['crumb']))
        .then(function (res) {
            return {message: "contributor created/updated"};
        })
        .fail((function (err) {
            this.status = 500;
            return {message: "couldn't create/update contributor. error: " + err};
        }).bind(this));
});

appWs.get('/lang/:lang/phrases', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    var params = appUtil.getObjectWithoutProps(this.query, ['lang', 'phrase']);
    params.lang = this.params.lang;
    if (undefined !== params.search) {
        this.body = yield mockData.searchPhrase(params);
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
        contributorCookie = this.cookies.get('contributor', {signed: true}),
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
        contributorCookie = this.cookies.get('contributor', {signed: true}),
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
            this.body = {message: "definition created/updated", last_id: res[0].last_id};
            return;
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
        contributorCookie = this.cookies.get('contributor', {signed: true}),
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
        dbip = new DBIP(nconf.get("data:dbip:dbConfig")),
        parsedReferrer,
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
        this.state = 400;
        this.body = {message: "couldn't get a short lang code from the received referrer data"};
        return;
    }
    receivedShortLangCode = matches[1];
    matchingReferrerLocale = _.reduce(localeRootMap, function (acc, root, lang) {
        var parsedRoot = url.parse(root),
            re = new RegExp("^/" + receivedShortLangCode + "(/|$)"),
            matches = parsedRoot.pathname.match(re);
        console.log("looking for " + receivedShortLangCode + " in " + parsedRoot.pathname);
        if (matches) {
            console.log("found it!");
            return lang;
        }
        return acc;
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
            this.body = {message: "something went wrong"};
        }.bind(this));
});


_.forEach(nconf.get("localeRootMap"), function (root, confLang) {
    var parsedRoot = url.parse(root),
        matches = parsedRoot.pathname.match(/^\/([^\/]+)(\/|$)/),
        shortLangCode;
    if (!matches) {
        throw Error("couldn't find shortLangCode for pathname: " + parsedRoot.pathname);
    }
    shortLangCode = matches[1];

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
    appReact.get("/" + shortLangCode + localRouteInfo.serverRoute, function *(next) {
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
                setInitialState(state);
                var markup = "<!DOCTYPE html>\n" + React.renderComponentToString(
                    <CrowDictionary nRouteInfo={nRouteInfo} />
                ).replace(/<html /, '<html manifest="/static/assets/global_cache.manifest" ');
                this.body = markup;
                return;
            }).bind(this))
            .fail(function (err) {
                console.error("error: " + (err));
            });
    });
});

});


app.use(mount('/static', serve('./client/build')));
app.use(mount('/v1', appWs));
app.use(mount('/', appReact));

app.listen(3000);

console.log('listening on port 3000');
