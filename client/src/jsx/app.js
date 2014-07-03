/** @jsx React.DOM */

var util = require('util');
var React = require('react');
var _ = require('lodash');
var shared = require('../../../../shared/build/js/app.js');

var CrowDictionary = shared.CrowDictionary,
    routesInfo = shared.routesInfo,
    setCe = shared.setCe;

console.log('ehlos');
/*var routes = _.map(shared.pages, function (page, routeName) {
    var paramNames = page.paramNames;

    return function () {
        var params = {};
        _.forOwn(paramNames, function (paramName, idx) {
            params[paramName] = arguments(idx);
        });
        console.log("params for route '" + routeName + "': " + JSON.stringify(params));
        //func.call(params);
        React.renderComponent(
            <InterfaceComponent router="" clientOrServer="client"/>,
            document.html
        );
    }
});*/

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
            return routeInfo.clientRouterFunc.bind(this)
        }))
    )

    /*home: function () {
        console.log('home!');
        React.renderComponent(
            <CrowDictionary/>,
            document
        );
    },

    fake: function () {
        console.log('fake');
    }*/
);

//console.log("Router: " + Router);

var router = new Router();

setCe(router);

Backbone.history.start({
    pushState: true,
    hashChange: true
    // hashChange: Modernizr.history ? true : false
});

//router.navigate('', {trigger: true});
//router.navigate('home', {trigger: true});
//router.navigate('', {trigger: true});
//router.navigate('fake', {trigger: true});
//console.log('done navigating?');
