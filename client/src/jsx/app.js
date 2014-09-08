/** @jsx React.DOM */

var Q = require('q');
var util = require('util');
var React = require('react');
var _ = require('lodash');
var shared = require('../../../../shared/build/js/app.js');

var CrowDictionary = shared.CrowDictionary,
    routesInfo = shared.routesInfo,
    setPRequest = shared.setPRequest,
    setRouter = shared.setRouter;

console.log('ehlos');

var request = require('browser-request');
var pRequest = Q.denodeify(request);
setPRequest(pRequest);

var Router = Backbone.Router.extend(
    _.merge(
        {
            routes: _.zipObject(_.map(routesInfo, function (routeInfo) {
                return routeInfo.clientRoute;
            }), _.map(routesInfo, function (routeInfo) {
                return routeInfo.clientRouterFuncName
            }))
        },
        _.zipObject(_.map(routesInfo, function (routeInfo) {
            return routeInfo.clientRouterFuncName
        }), _.map(routesInfo, function (routeInfo) {
            return routeInfo.clientRouterFunc.bind(this, routeInfo)
        }))
    )
    /**
     * sample object:
     * {
     *      routes: {
     *          '/': 'rootFunc',
     *          '/sub': 'subFunc'
     *      },
     *      'rootFunc': someFunction,
     *      'subFunc': someOtherFunction
     * }
     * ... where someFunction and someOtherFunction are bound to the router and passed routeInfo
     */

);

var router = new Router();


Backbone.history.start({
    pushState: true,
    hashChange: true
    // hashChange: Modernizr.history ? true : false
});

setRouter(router);

//router.navigate('', {trigger: true});
//router.navigate('home', {trigger: true});
//router.navigate('', {trigger: true});
//router.navigate('fake', {trigger: true});
//console.log('done navigating?');
