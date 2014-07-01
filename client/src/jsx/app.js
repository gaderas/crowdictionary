/** @jsx React.DOM */

var React = require('react');
var _ = require('lodash');
var shared = require('../../../../shared/build/js/app.js');

var CrowDictionary = shared.CrowDictionary;

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
var routes = {
    '': 'home',
    'fake': 'fake'
};

var Router = Backbone.Router.extend({
    routes: routes,

    home: function () {
        console.log('home!');
        React.renderComponent(
            <CrowDictionary router="" clientOrServer="server"/>,
            document
        );
    },

    fake: function () {
        console.log('fake');
    }
});

console.log("Router: " + Router);

var router = new Router();

Backbone.history.start();

router.navigate('', {trigger: true});
router.navigate('home', {trigger: true});
router.navigate('fake', {trigger: true});

console.log('done navigating?');
