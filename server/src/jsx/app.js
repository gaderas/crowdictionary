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
var nconf = require('nconf');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var appUtil = require('../../../shared/build/js/util.js');

var NODE_ENV = process.env.NODE_ENV;

//console.log('nconf.NODE_ENV: ' + nconf.get('NODE_ENV'));

nconf.argv().env().file({file: './config/'+NODE_ENV+'.config.json'});

console.log('nconf.get("NODE_ENV"): ' + nconf.get('NODE_ENV'));

//console.log(nconf.get('data'));
//console.log(nconf.get('data:source'));
//console.log(nconf.get('secret'));
//process.exit();

var mockData = dsFactory(nconf);

console.log('mockData: ' + mockData);

var CrowDictionary = shared.CrowDictionary,
    routesInfo = shared.routesInfo,
    getNormalizedRouteInfo = shared.getNormalizedRouteInfo,
    setupRoute = shared.setupRoute,
    asyncRenderComponentToString = shared.asyncRenderComponentToString,
    setInitialState = shared.setInitialState;

//app.use(serve('./client/build'));

appReact.use(router(appReact));
app.keys = nconf.get("cookies:user:secrets").split(',');
appWs.use(function *(next) {
    console.log('csrf middleware before yield');
    yield next;
    console.log('csrf middleware after yield');
});
appWs.use(function *(next) {
    console.log('authentication middleware before yield');
    yield next;
    console.log('authentication middleware after yield');
});
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
    var contributorCookie = this.cookies.get('contributor', {signed: true});
    yield next;
    this.status = contributorCookie ? 200 : 401;
    this.body = JSON.parse(contributorCookie) || {message: "not logged in"};
});

appWs.get('/contributors', function *(next) {
    //yield next;
    console.log('query string: ' + JSON.stringify(this.query));
    this.body = yield mockData.getContributors(this.query);
});

appWs.put('/contributors', function *(next) {
    console.log('put /contributors incoming body: ' + JSON.stringify(this.request.body));
    var requestBody = appUtil.getObjectWithoutProps(this.request.body, ['status', 'verified', 'verification_code', 'verification_retries']);
    this.body = yield mockData.putContributor(this.query, requestBody)
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
    this.body = yield mockData.getPhrases(params);
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
            return mockData.getVotes({definition_ids: _.map(definitions, function (definition) {return definition.id})})
                .then(function (votes) {
                    return definitionsWithVotes = _.map(definitions, function (definition) {
                        definition.votes = _.filter(votes, {definition_id: definition.id});
                        return definition;
                    });
                });
        });
});

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
    if (this.params.phrase !== requestBody.phrase) {
        this.status = 400;
        this.body = {message: "'phrase' value mistmatch between URI and HTTP request body"};
        return;
    }
    // stip out 'phrase', we'll attach 'phrase_id' below...
    requestBody = appUtil.getObjectWithoutProps(requestBody, ['phrase']);

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
            return mockData.createDefinition(requestBody);
        })
        .then((function (res) {
            this.status = 200;
            this.body = {message: "definition created"};
            return;
        }).bind(this))
        .fail((function (err) {
            this.status = 500;
            this.body = {message: "couldn't create definition. error: " + err};
            return;
        }).bind(this));
});

/**
 * @TODO: make sure there's only one vote per contributor
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
    if (this.params.definition_id != requestBody.definition_id) {
        this.status = 400;
        console.log("requestBody: " + JSON.stringify(requestBody));
        this.body = {message: "'definition_id' value mistmatch between URI and HTTP request body"};
        return;
    }
    yield mockData.createVote(requestBody)
        .then((function (res) {
            this.status = 200;
            this.body = {message: "vote submitted"};
        }).bind(this))
        .fail((function (err) {
            this.status = 500;
            this.body = {message: "vote submission failed with error: " + err};
        }).bind(this));
});

appWs.get('/users/:username', function *(next) {
    yield next;
    this.body = mockData.getUser(this.params.username);
});

appWs.get('/users', function *(next) {
    yield next;
    this.body = mockData.getUsers();
});

appWs.get('/teams/:teamname', function *(next) {
    yield next;
    this.body = mockData.getTeam(this.params.teamname);
});

appWs.get('/teams', function *(next) {
    yield next;
    this.body = mockData.getTeams();
});

var requestSomething = function (callback) {
    request('http://localhost:3000/v1/teams', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            callback(null, body); // Print the google web page.
            return;
        } else {
            console.log("error fetching googoogoog.el.com!!");
            callback(error);
            return;
        }
    });
};

var requestSome = Q.denodeify(requestSomething);


_.forEach(routesInfo, function (routeInfo) {
    console.log('adding server route ' + routeInfo.serverRoute + '?');
    appReact.get(routeInfo.serverRoute, function *(next) {
        //yield next;
        yield requestSome()
            .then((function (body) {
                var nRouteInfo = getNormalizedRouteInfo('server', routeInfo, this.params);
                console.log('nRouteInfo: ' + JSON.stringify(nRouteInfo, ' ', 4));
                setInitialState({
                    searchTerm: 'beginning of boday: "' + body.substr(0, 10) + '"'
                });
                var markup = React.renderComponentToString(
                    <CrowDictionary/>
                );
                this.body = markup;
            }).bind(this));
    });
});

appReact.get('/dummy/:something', function *(next) {
    yield next;
    //var markup = serverRoute.server(this.params);
    console.log("this.params: " + JSON.stringify(_.toArray(this.params)));
    this.body = 'dummay';
});


app.use(mount('/static', serve('./client/build')));
app.use(mount('/v1', appWs));
app.use(mount('/', appReact));

app.listen(3000);

console.log('listening on port 3000');
