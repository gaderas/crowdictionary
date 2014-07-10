/** @jsx React.DOM */

var Q = require('q');
var request = require('request');
var React = require('react');
var serve = require('koa-static');
var koa = require('koa');
var mount = require('koa-mount');
var router = require('koa-router');
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
appWs.use(router(appWs));


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
        /*asyncRenderComponentToString(
            <CrowDictionary/>,
            function (err, mkup) {
                if (err) {
                    console.error('errortz');
                }
                this.body = markup;
            }
        );*/
        /*setupRoute(getNormalizedRouteInfo('server', routeInfo.serverRoute, this.params), function (error, routeInfo) {
            CrowDictionary.componentWillMount = function () {
                console.log('running on ' + nRouteInfo.clientOrServer);
                this.setState(getStateForRouteInfo(routeInfo));
            };
            var markup = React.renderComponentToString(
                <CrowDictionary/>
            );
            this.body = markup;
        });*/
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
