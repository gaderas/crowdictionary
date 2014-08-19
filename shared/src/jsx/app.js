/** @jsx React.DOM */

var Q = require('q');
var React = require('react');
var bs = require('./bootstrap.js');
var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var pRequest,
    setPRequest = function (incoming) {
        pRequest = incoming;
    };

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
    /*Q($.ajax({url: 'http://localhost:3000/v1/lang/es-MX/phrases', type: 'GET'}))
        .then(function (data) {
            console.log('on client with a body of length: ' + data.length);
            console.log('on client with body (data): ' + JSON.stringify(data));
            //setInitialState({
                //searchTerm: 'beginning of boday: "'  + '"'
            //});
            React.renderComponent(
                <CrowDictionary/>,
                document
            );
        });*/
    //Q($.ajax({url: 'http://localhost:3000/v1/lang/es-MX/phrases', type: 'GET'}))
    Q(routeInfo.calculateStateFunc())
        .then(function (state) {
            console.log('on client with state: ' + JSON.stringify(state));
            setInitialState(state);
            React.renderComponent(
                <CrowDictionary calculateStateFunc={routeInfo.calculateStateFunc} />,
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
        calculateStateFunc: function (lang, term) {
            lang = lang || 'es-MX';
            term = term || '';
            var phrasesUrl,
                loginStateUrl = "http://localhost:3000/v1/login";
            if (!term) {
                phrasesUrl = "http://localhost:3000/v1/lang/"+lang+"/phrases";
            } else {
                phrasesUrl = "http://localhost:3000/v1/lang/"+lang+"/phrases?search="+term;
            }
            return Q.all([pRequest(phrasesUrl), pRequest(loginStateUrl)])
                .spread(function (phrasesRes, loginStateRes) {
                    console.log("login state reponse:" + JSON.stringify(loginStateRes, ' ', 4));
                    console.log("phrases reponse:" + JSON.stringify(phrasesRes, ' ', 4));
                    if (200 !== phrasesRes[0].statusCode) {
                        throw Error("couldn't fetch phrases");
                    }
                    var rObj = JSON.parse(phrasesRes[1]),
                        reactState = {
                            globalLang: lang,
                            searchTerm: term,
                            searchResults: []
                        };
                    _.forEach(rObj, function (phraseObj) {
                        reactState.searchResults.push({
                            phrase: phraseObj.phrase,
                            key: phraseObj.id
                        });
                    });
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = JSON.parse(loginStateRes[1]);
                    }
                    return reactState;
                })
                .then(function (reactState) {
                    var phraseIds = _.map(reactState.searchResults, function (searchResult) {
                        return searchResult.key;
                    });
                    if (!phraseIds.length) {
                        return reactState;
                    }
                    return pRequest("http://localhost:3000/v1/definitions?phraseIds="+phraseIds.join(','))
                        .then(function (res) {
                            if (200 !== res[0].statusCode) {
                                throw Error("couldn't fetch definitions");
                            }
                            var rObj = JSON.parse(res[1]);
                            _.forEach(reactState.searchResults, function (searchResult) {
                                var definitions = _.where(rObj, {phrase_id: searchResult.key});
                                searchResult.definitions = definitions;
                                console.log('definitionz: ' + JSON.stringify(definitions));
                                searchResult.topDefinition = _.max(definitions, function (def) {
                                    // this will return the one with the most votes, regardless if they're upvotes or downvotes...
                                    return def.votes.length;
                                });
                                console.log('top definition: ' + JSON.stringify(searchResult.topDefinition));
                            });
                            return reactState;
                        });
                });
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
    handleUserInput: function (searchTerm) {
        this.props.calculateStateFunc(this.state.globalLang, searchTerm)
            .then((function (newState) {
                this.setState(newState);
                console.log("newState: " + JSON.stringify(newState, ' ', 4));
            }).bind(this));
    },
    handleGlobalLangChange: function (newLang) {
        this.props.calculateStateFunc(newLang, this.state.searchTerm)
            .then((function (newState) {
                this.setState(newState);
                console.log("newState: " + JSON.stringify(newState, ' ', 4));
            }).bind(this));
    },
    handleToggleLoginPrompt: function () {
        console.log('clicked on toggle login prompt...');
        this.setState({
            showLoginPrompt: !this.state.showLoginPrompt
        });
    },
    render: function () {
        var mainContent;
        if (this.state.showLoginPrompt) {
            mainContent = <LoginPrompt topState={this.state}/>;
        } else {
            mainContent = <PhraseSearchResults topState={this.state}/>;
        }
        return (
            <html>
            <head>
              <script src="/static/js/dep/underscore.js" />
              <script src="/static/js/dep/jquery.js" />
              <script src="/static/js/dep/backbone.js" />
            </head>
            <body>
            <div>
                <TopBar onUserInput={this.handleUserInput} onGlobalLangChange={this.handleGlobalLangChange} onToggleLoginPrompt={this.handleToggleLoginPrompt} topState={this.state}/>
                {mainContent}
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
                <SearchBar onUserInput={this.props.onUserInput} topState={this.props.topState}/>
                <NavBar onGlobalLangChange={this.props.onGlobalLangChange} onToggleLoginPrompt={this.props.onToggleLoginPrompt} topState={this.props.topState}/>
            </div>
        );
    }
});

var SearchBar = React.createClass({
    handleChange: function () {
        console.log('in SearchBar::handleChange()');
        var searchTerm = this.refs.searchInput.getDOMNode().value;
        console.log("a change. searchTerm is now: " + searchTerm);
        this.props.onUserInput(searchTerm);
    },
    render: function () {
        console.log("this.handleChange: " + this.handleChange);
        return (
            <form>
            <input type="text" defaultValue={this.props.topState.searchTerm} placeholder="enter search term" ref="searchInput" onChange={this.handleChange}/>
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
                <LoginStatus topState={this.props.topState} onToggleLoginPrompt={this.props.onToggleLoginPrompt} />
                <GlobalLangPicker onGlobalLangChange={this.props.onGlobalLangChange} topState={this.props.topState}/>
            </div>
        );
    }
});

var LoginStatus = React.createClass({
    handleClick: function () {
        console.log('on handleClick');
        this.props.onToggleLoginPrompt()
    },
    render: function () {
        var loginInfo = this.props.topState.loginInfo;
        console.log("loginInfo...: " + JSON.stringify(loginInfo, ' ', 4));
        if (undefined === loginInfo) {
            return (
                <span onClick={this.handleClick}>login / sign up.</span>
            );
        } else {
            return (
                <span>welcome!</span>
            );
        }
    }
});

var LoginPrompt = React.createClass({
    handleSubmit: function (e) {
        var username = this.refs.username.getDOMNode().value,
            password = this.refs.password.getDOMNode().value;
        e.preventDefault();
        console.log("user: " + username + ", pass: " + password);
        loginStateUrl = "http://localhost:3000/v1/login";
        return pRequest({method: "POST", url: loginStateUrl, body: {email: username, passhash: password}, json:true})
            .then(function(res) {
                if (200 !== res[0].statusCode) {
                    throw Error("invalid credentials");
                }
                var rObj = JSON.parse(res[1]);
                console.log("login success!");
            });
    },
    render: function () {
        var display = this.props.topState.showLoginPrompt ? "block" : "none",
            style = {display: display};
        return (
            <form onSubmit={this.handleSubmit}>
            <div>Login</div>
            <input ref="username" type="text"/>
            <input ref="password" type="password"/>
            <input type="submit" value="log in"/>
            </form>
        );
    }
});

var GlobalLangPicker = React.createClass({
    handleChange: function () {
        console.log('in GlobalLangPicker::handleChange()');
        var newLang = this.refs.globalLang.getDOMNode().value;
        console.log("global lang changed to: " + newLang);
        this.props.onGlobalLangChange(newLang);
    },
    render: function () {
        return (
            <select ref="globalLang" onChange={this.handleChange} defaultValue={this.props.topState.globalLang}>
                <option value="en-US">U.S. - English</option>
                <option value="fr-FR">France - Français</option>
                <option value="es-MX">Mexico - Spanish</option>
            </select>
        );
    }
});

var PhraseSearchResults = React.createClass({
    render: function () {
        var phraseSearchResults = [];
        _.forEach(this.props.topState.searchResults, function (result) {
            //phrase topDefinition
            phraseSearchResults.push(
                <PhraseSearchResult searchResult={result} key={result.key} />
            );
        });
        return (
            <div>
                <TopSearchCaption topState={this.props.topState}/>
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
                showing results for '{this.props.topState.searchTerm}'
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
                {this.props.definition.definition}
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
module.exports.setPRequest = setPRequest;
