/** @jsx React.DOM */

var Q = require('q');
var React = require('react');
var bs = require('./bootstrap.js');
var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
//var request = require('request');

var Layout = bs.Layout;
var Widget = bs.Widget;


var nRouteInfo,
    setupRoute = function (newNRouteInfo, callback) {
        console.log('on setupRoute!!');
        callback(null, newNRouteInfo);
        nRouteInfo = newNRouteInfo;
    },
    initialState = {searchTerm: 'virgencito'},
    setInitialState = function (state) {
        initialState = state;
    };

var getNormalizedRouteInfo = function (clientOrServer, routeInfo, routeParams) {
    console.log('on getNormalizedRouteInfo(), routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
    console.log('on getNormalizedRouteInfo(), routeParams: ' + JSON.stringify(routeParams, ' ', 4));
    return _.merge(
        normalizeRouteInfo(clientOrServer, routeInfo, routeParams),
        {clientOrServer: clientOrServer}
    );
};



/**
 * was bound to `this` of Backbone router
 */
var clientRouterFunc = function (routeInfo) {
    console.log('on clientRouterFunc() begin');
    var args = _(arguments).toArray().slice(1).value(),
        fake3 = console.log('on clientRouterFunc(), args: ' + JSON.stringify(args)),
        params = _.map(routeInfo.serverParamNames, function (paramName) {
            return args.shift();
        }),
        fake1 = console.log('on clientRouterFunc(), routeInfo: ' + JSON.stringify(routeInfo)),
        fake2 = console.log('on clientRouterFunc(), params: ' + JSON.stringify(params)),
        nRouteInfo = getNormalizedRouteInfo('client', routeInfo, params);


    console.log('routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
    console.log('args: ' + JSON.stringify(args, ' ', 4));
    console.log('nRouteInfo: ' + JSON.stringify(nRouteInfo, ' ', 4));
    Q($.ajax({url: '/v1/teams', type: 'GET'}))
        .then(function (data) {
            console.log('on client with a body of length: ' + data.length);
            setInitialState({
                searchTerm: 'beginning of boday: "' + data.substr(0, 10) + '"'
            });
            React.renderComponent(
                <CrowDictionary/>,
                document
            );
        });
    /*setupRoute(getNormalizedRouteInfo('client', routeInfo.clientRoute, params), function (error, routeInfo) {
        React.renderComponent(
            <CrowDictionary/>,
            document
        );
    });*/
};

var routesInfo = [
    {
        serverRoute: '/',
        serverParamNames: [],
        clientRoute: '',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/',
        calculateStateFunc: function () {
            return {
                viewing: 'PhraseSearchResults',
                searchTerm: 'hijazo de mi vidaza',
                searchResults: [
                    {phrase: 'hijazo de mi vidaza', topDefinition: 'asi le dicen al muñecón', key: 1},
                    {phrase: 'hijo del mal dormir', topDefinition: 'cuando alguien te cae mal', key: 2}
                ]
            };
        }
    },
    {
        serverRoute: '/phrases/:phrase',
        serverParamNames: ['phrase'],
        clientRoute: 'phrases/:phrase',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/phrases/:phrase',
        calculateStateFunc: function () {
            return {
                viewing: 'PhraseSearchResults',
                searchTerm: 'hijazo de mi vidaza',
                searchResults: [
                    {phrase: 'hijazo de mi vidaza', topDefinition: 'asi le dicen al muñecón', key: 1},
                    {phrase: 'hijo del mal dormir', topDefinition: 'cuando alguien te cae mal', key: 2}
                ]
            };
        }
    },
    {
        serverRoute: '/searchPhrase/:searchTerm',
        serverParamNames: ['searchTerm'],
        clientRoute: 'searchPhrase/:searchTerm',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/searchPhrase/:searchTerm',
        calculateStateFunc: function () {
            return {
                viewing: 'PhraseSearchResults',
                searchTerm: 'hijazo de mi vidaza',
                searchResults: [
                    {phrase: 'hijazo de mi vidaza', topDefinition: 'asi le dicen al muñecón', key: 1},
                    {phrase: 'hijo del mal dormir', topDefinition: 'cuando alguien te cae mal', key: 2}
                ]
            };
        }
    }
];

var normalizeRouteInfo = function (clientOrServer, routeInfo, data) {
    if ('server' === clientOrServer) {
        //console.log('aveeee' + JSON.stringify(routeInfo));
        return {
            route: routeInfo.serverRoute,
            params: _.zipObject(
                _.map(routeInfo.serverParamNames, function (paramName) {
                    return paramName;
                }),
                _.map(routeInfo.serverParamNames, function (paramName) {
                    return data[paramName];
                })
            )
        };
    } else if ('client' === clientOrServer) {
        console.log('routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
        console.log('data: ' + JSON.stringify(data, ' ', 4));
        var args = data;
        console.log('on clientzz');
        console.log('on normalizeRouteInfo(), routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
        return {
            route: routeInfo.clientRouterFuncName,
            params: _.zipObject(
                _.map(routeInfo.serverParamNames, function (paramName) {
                    return paramName;
                }),
                _.map(routeInfo.serverParamNames, function (paramName) {
                    return args.shift();
                })
            )
        };
    } else {
        throw new Error("first argument (clientOrServer) should be 'client' or 'server'.");
    }
};


/*var AsyncMixin = {
    asyncRenderComponentToString = function (component, ) {
    }
};*/
var ReactAsync = {
};

var CrowDictionary = React.createClass({
    componentWillMount: function () {
        //this.setState({searchTerm: 'success-ish'});
        /*request('http://www.google.com', (function (error, response, body) {
            if (!error && response.statusCode == 200) {
                //callback(null, body); // Print the google web page.
                this.setState({searchTerm: 'i like'});
                return;
            } else {
                console.log("error fetching googoogoog.el.com!!");
                //callback(error);
                return;
            }
        }).bind(this));*/
    },
    /*asyncRenderComponentToString: function (callback) {
        this.type.asyncGetInitialState(function (err, resp) {
            if (err) {
                console.log('errerus');
            }
            this.type.setState({
                searchTerm: 'got google page with length: ' + resp.length
            });
        });
        var markup = React.renderComponentToString(this);
        callback(null, markup);
    },*/
    /*asyncGetInitialState: function (callback) {
        request('http://www.google.com', function (error, response, body) {
            if (!error && response.statusCode == 200) {
                callback(null, body); // Print the google web page.
                return;
            } else {
                console.log("error fetching googoogoog.el.com!!");
                callback(error);
                return;
            }
        });
    },*/
    getInitialState: function () {
        return initialState;
    },
    handleUserInput: function (state) {
        this.setState({
            searchTerm: state.searchTerm
        });
    },
    render: function () {
        return (
            <html>
            <head>
              <script src="/static/js/dep/underscore.js" />
              <script src="/static/js/dep/jquery.js" />
              <script src="/static/js/dep/backbone.js" />
            </head>
            <body>
            <div>
                <TopBar onUserInput={this.handleUserInput}/>
                <PhraseSearchResults searchTerm={this.state.searchTerm} searchResults={this.state.searchResults}/>
            </div>
            <script src="/static/js/app.js" />
            </body>
            </html>
        );
    }
});


var TopBar = React.createClass({
    render: function () {
        return (
            <div>
                <SearchBar onUserInput={this.props.onUserInput}/>
                <NavBar/>
            </div>
        );
    }
});

var SearchBar = React.createClass({
    handleChange: function () {
        console.log('in SearchBar::handleChange()');
        var searchTerm = this.refs.searchInput.getDOMNode().value;
        console.log("a change. searchTerm is now: " + searchTerm);
        this.props.onUserInput({
            searchTerm: searchTerm
        });
    },
    render: function () {
        console.log("this.handleChange: " + this.handleChange);
        return (
            <form>
            <input type="text" defaultValue="nuthin'" placeholder="enter search term" ref="searchInput" onChange={this.handleChange}/>
            </form>
        );
    }
});

var NavBar = React.createClass({
    render: function () {
        return (
            <div>
                <span>Home</span>
                <span>About</span>
                <span>Jobs</span>
            </div>
        );
    }
});

var PhraseSearchResults = React.createClass({
    render: function () {
        var phraseSearchResults = [];
        _.forEach(this.props.searchResults, function (result) {
            //phrase topDefinition
            phraseSearchResults.push(
                <PhraseSearchResult searchResult={result} key={result.key} />
            );
        });
        return (
            <div>
                <TopSearchCaption searchTerm={this.props.searchTerm}/>
                <div className="phraseSearchResultsList">
                    {phraseSearchResults}
                </div>
                <AddPhraseForm/>
            </div>
        );
    }
});

var TopSearchCaption = React.createClass({
    render: function () {
        return (
            <div>
                showing results for '{this.props.searchTerm}'
            </div>
        );
    }
});

var PhraseSearchResult = React.createClass({
    render: function () {
        return (
            <div>
                <Phrase phrase={this.props.searchResult.phrase} />
                <Definition definition={this.props.searchResult.topDefinition} />
            </div>
        );
    }
});

var Phrase = React.createClass({
    render: function () {
        return (
            <div>
                {this.props.phrase}
            </div>
        );
    }
});

var Definition = React.createClass({
    render: function () {
        return (
            <div>
                {this.props.definition}
            </div>
        );
    }
});

var AddPhraseForm = React.createClass({
    render: function () {
        return (
            <div>
                <form>
                    <span>Add phrase</span>
                    <textarea placeholder="enter a new phrase here"/>
                    <input type="submit" name="submit"/>
                </form>
            </div>
        );
    }
});


var FooComponent = React.createClass({
    'render': function () {
        var router = this.props.router,
            clientOrServer = this.props.clientOrServer;

        return (
            <p>client or server, you ask? "{clientOrServer}"</p>
        );
    }
});

var BarComponent = React.createClass({
    'render': function () {
        var router = this.props.router,
            clientOrServer = this.props.clientOrServer;

        return (
            <p>client or server, you ask? "{clientOrServer}"</p>
        );
    }
});

var InterfaceComponent = React.createClass({
    'render': function () {
        var router = this.props.router,
            clientOrServer = this.props.clientOrServer;

        return (
            <Layout router={router}>
                <table>
                <tr>
                <td>
                    <FooComponent router={router} clientOrServer={clientOrServer} />
                </td>
                <td>
                    <BarComponent router={router} clientOrServer={clientOrServer} />
                </td>
                </tr>
                </table>
            </Layout>
        );
    }
});


module.exports.bs = bs;
module.exports.InterfaceComponent = InterfaceComponent;
module.exports.routesInfo = routesInfo;
module.exports.getNormalizedRouteInfo = getNormalizedRouteInfo;
module.exports.setupRoute = setupRoute;
module.exports.CrowDictionary = CrowDictionary;
module.exports.setInitialState = setInitialState;
