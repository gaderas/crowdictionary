/** @jsx React.DOM */

var React = require('react');
var bs = require('./bootstrap.js');
var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Layout = bs.Layout;
var Widget = bs.Widget;





var NormalizedRouterEmitter = function () {
    EventEmitter.call(this);
    this.matchRoute = function (route, routeParams) {
        this.emit('matchRoute', route, routeParams);
    };
};
NormalizedRouterEmitter.prototype = Object.create(EventEmitter.prototype);

var ne = new NormalizedRouterEmitter();


var nRouteInfo,
    setNRouteInfo = function (newNRouteInfo) {
        nRouteInfo = newNRouteInfo;
    },
    ce,
    se,
    latestState = {searchTerm: 'virgencito'},
    setInitialState = function (initialState) {
        latestState = initialState
    },
    setSe = function (callback) {
        se = callback;
        if (se) {
            var nRouteInfo;
            se.on('matchRoute', (function (route, routeParams) {
                var routeInfo = _.where(routesInfo, {serverRoute: route})[0],

                nRouteInfo = normalizeRouteInfo('server', routeInfo, routeParams);
                console.log("das nRouteInfo: " + JSON.stringify(nRouteInfo));
                ne.matchRoute(nRouteInfo.route, nRouteInfo.params);
            }).bind(this));
        }
    },
    setCe = function (callback) {
        ce = callback;
        if (ce) {
            var nRouteInfo;
            ce.on('route', (function (route, arg1) {
                var routeInfo = _.where(routesInfo, {clientRouterFuncName: route})[0],

                nRouteInfo = normalizeRouteInfo('client', routeInfo, arguments);
                console.log("das nRouteInfo: " + JSON.stringify(nRouteInfo));
                ne.matchRoute(nRouteInfo.route, nRouteInfo.params);
            }).bind(this));
        }
    };

var getNormalizedRouteInfo = function (clientOrServer, routeInfo, routeParams) {
    return normalizeRouteInfo(clientOrServer, routeInfo, routeParams);
};


/**
 * takes a `routeInfo` as normalized by normalizeRouteInfo()
 */
var getStateForRouteInfo = function (routeInfo) {
    return {searchTerm: 'whatevs'};
};

var clientRouterFunc = function () {
    React.renderComponent(
        <CrowDictionary/>,
        document
    );
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
        var args = data[1];
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

var CrowDictionary = React.createClass({
    getInitialState: function () {
        return latestState;
    },
    componentWillMount: function () {
        this.setState(getStateForRouteInfo(nRouteInfo));
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
module.exports.CrowDictionary = CrowDictionary;
module.exports.routesInfo = routesInfo;
module.exports.ce = ce;
module.exports.se = se;
module.exports.setSe = setSe;
module.exports.setCe = setCe;
module.exports.ne = ne;
module.exports.getNormalizedRouteInfo = getNormalizedRouteInfo;
module.exports.setNRouteInfo = setNRouteInfo;
