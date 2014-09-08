/** @jsx React.DOM */

var Q = require('q');
var appUtil = require('./util.js');
var React = require('react');
var l10n = require('./l10n.js');
var Intl = global.Intl || require('intl');
var IntlMessageFormat = require('intl-messageformat');
var bs = require('./bootstrap.js');
var _ = require('lodash');
var util = require('util');
var querystring = require('querystring');
var EventEmitter = require('events').EventEmitter;
var pRequest,
    selfRoot,
    Router,
    setPRequest = function (incoming) {
        pRequest = incoming;
        l10n.setPRequest(pRequest);
    },
    setSelfRoot = function (incoming) {
        selfRoot = incoming;
        l10n.setSelfRoot(incoming);
    },
    setRouter = function (incoming) {
        console.log("setting Router to : " + incoming);
        Router = incoming;
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

var getNormalizedRouteInfo = function (clientOrServer, routeInfo, routeParams, query, hostname, selfRoot) {
    console.log('on getNormalizedRouteInfo(), routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
    console.log('on getNormalizedRouteInfo(), routeParams: ' + JSON.stringify(routeParams, ' ', 4));
    return _.merge(
        normalizeRouteInfo(clientOrServer, routeInfo, routeParams, query),
        {
            clientOrServer: clientOrServer,
            hostname: hostname,
            selfRoot: selfRoot
        }
    );
};



/**
 * this receives arguments from Backbone.Router in the following order:
 * *   routeInfo (passed via bind on the client code)
 * *   a number of arguments, each corresponding to a matched route path parameter
 * *   a query string, in string form (empty when none is present) is *always* the last argument
 */
var clientRouterFunc = function (routeInfo) {
    console.log('on clientRouterFunc() begin');
    var args = _(arguments).toArray().slice(1).value(),
        fake3 = console.log('on clientRouterFunc(), args: ' + JSON.stringify(args)),
        queryString = args.pop(),
        query = querystring.parse(queryString),
        params = _.map(routeInfo.serverParamNames, function (paramName) {
            return args.shift();
        }),
        fake1 = console.log('on clientRouterFunc(), routeInfo: ' + JSON.stringify(routeInfo)),
        fake2 = console.log('on clientRouterFunc(), params: ' + JSON.stringify(params)),
        hostname = window.location.hostname,
        selfRoot = util.format("%s//%s", window.location.protocol, window.location.host),
        nRouteInfo = getNormalizedRouteInfo('client', routeInfo, params, query, hostname, selfRoot);


    console.log('routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
    console.log('args: ' + JSON.stringify(args, ' ', 4));
    console.log('nRouteInfo: ' + JSON.stringify(nRouteInfo, ' ', 4));

    pCalculateStateBasedOnNormalizedRouteInfo(nRouteInfo)
        .then((function (state) {
            console.log("state: " + state);
            console.log("lang is: " + state.globalLang + ", and l10nData: " + JSON.stringify(state.l10nData));
            setInitialState(state);
            React.renderComponent(
                <CrowDictionary nRouteInfo={nRouteInfo} />,
                document
            );
            return;
        }).bind(this))
        .fail(function (err) {
            console.error("error: " + (err));
        });
};

/**
 * sample nRouteInfo:
 * "nRouteInfo: {
 *     "route": "/phrases/:phrase",
 *     "params": {
 *         "phrase": "somephrase"
 *     },
 *     "query": {
 *         "a": "b",
 *         "c": "d"
 *     },
 *     "clientOrServer": "client",
 *     "calculateStateFunc": "calculateStateFunc"
 * }"
 */
var pCalculateStateBasedOnNormalizedRouteInfo = function (nRouteInfo) {
    /*var stateOverrides = {
        hostname: 'es-mx.crowdictionary.com',
        selfRoot: 'http://ex-mx.crowdictionary.com:3000',
        globalLang: 'es-MX'
    };*/
    var stateOverrides = {};
        //hostname = (stateOverrides && stateOverrides.hostname) || window.location.hostname,
        //selfRoot = (stateOverrides && stateOverrides.selfRoot) || util.format("%s//%s", window.location.protocol, window.location.host),
        hostname = nRouteInfo.hostname,
        selfRoot = nRouteInfo.selfRoot,
        pL10nForLang = null;

    setSelfRoot(selfRoot);
    pL10nForLang = l10n.getAvailableLangs()
        .then(function (langs) {
            console.log("available langs: " + JSON.stringify(langs));
            stateOverrides.globalLang = appUtil.getLangBasedOnHostname(hostname, langs);
            return l10n.getL10nForLang(stateOverrides.globalLang);
        });
    if ('/' === nRouteInfo.route) {
        if (!nRouteInfo.query || !nRouteInfo.query.q) {
            // "home page"
            return pL10nForLang
                .then(function (l10nData) {
                    return Q(nRouteInfo.calculateStateFunc({l10nData: l10nData}));
                });
        } else if (nRouteInfo.query && nRouteInfo.query.q) {
            return pL10nForLang
                .then(function (l10nData) {
                    return Q(nRouteInfo.calculateStateFunc({l10nData: l10nData, searchTerm: nRouteInfo.query.q}));
                });
        }
    }
};

/**
 * Takes in stateOverrides (a React State) and a calculateStateFunc,
 * fetches l10nData, combines data from all 3 sources together
 * and returns a new React State.
 */
var pGenericCalculateState = function (stateOverrides, calculateStateFunc) {
    stateOverrides = (!_.isEmpty(stateOverrides) && stateOverrides) || {};
    // `hostname` and `selfRoot` passed in server mode, otherwise we get values from `window`
    var hostname = (stateOverrides && stateOverrides.hostname) || window.location.hostname,
        selfRoot = (stateOverrides && stateOverrides.selfRoot) || util.format("%s//%s", window.location.protocol, window.location.host);
    setSelfRoot(selfRoot);
    var pL10nForLang;
    if (stateOverrides.globalLang) {
        pL10nForLang = l10n.getL10nForLang(stateOverrides.globalLang);
    } else {
        pL10nForLang = l10n.getAvailableLangs()
            .then(function (langs) {
                console.log("available langs: " + JSON.stringify(langs));
                stateOverrides.globalLang = appUtil.getLangBasedOnHostname(hostname, langs);
                return l10n.getL10nForLang(stateOverrides.globalLang);
            });
    }
    if (!_.isEmpty(stateOverrides.shownPhraseData)) {
    }
    return pL10nForLang
        .then(function (l10nData) {
            console.log("gonna set stateOverrides.l10nData to : " + JSON.stringify(l10nData));
            stateOverrides.l10nData = l10nData;
            return Q(calculateStateFunc(stateOverrides));
        })
        .then(function (reactState) {
            _.forEach(stateOverrides, function (val, key) {
                reactState[key] = val;
            })
            return reactState;
        });
};

var routesInfo = [
    {
        serverRoute: '/',
        serverParamNames: [],
        clientRoute: '',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/',
        calculateStateFunc: function (overrides) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                term = (overrides && overrides.searchTerm) || '',
                l10nData = (overrides && overrides.l10nData) || {},
                phrasesUrl,
                loginStateUrl = selfRoot + "/v1/login";
            if (!term) {
                phrasesUrl = selfRoot + "/v1/lang/"+lang+"/phrases";
            } else {
                phrasesUrl = selfRoot + "/v1/lang/"+lang+"/phrases?search="+term;
            }
            return Q.all([pRequest(phrasesUrl), pRequest(loginStateUrl)])
                .spread(function (phrasesRes, loginStateRes) {
                    //console.log("login state reponse:" + JSON.stringify(loginStateRes, ' ', 4));
                    //console.log("phrases reponse:" + JSON.stringify(phrasesRes, ' ', 4));
                    if (200 !== phrasesRes[0].statusCode) {
                        throw Error("couldn't fetch phrases");
                    }
                    var rObj = JSON.parse(phrasesRes[1]),
                        reactState = {
                            globalLang: lang,
                            l10nData: l10nData,
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
                    return pRequest(selfRoot + "/v1/definitions?phraseIds="+phraseIds.join(','))
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
        calculateStateFunc: function (overrides) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                term = (overrides && overrides.searchTerm) || '',
                l10nData = (overrides && overrides.l10nData) || {},
                phrasesUrl,
                loginStateUrl = selfRoot + "/v1/login";
            if (!term) {
                phrasesUrl = selfRoot + "/v1/lang/"+lang+"/phrases";
            } else {
                phrasesUrl = selfRoot + "/v1/lang/"+lang+"/phrases?search="+term;
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
                            l10nData: l10nData,
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
                    return pRequest(selfRoot + "/v1/definitions?phraseIds="+phraseIds.join(','))
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

var normalizeRouteInfo = function (clientOrServer, routeInfo, routeParams, query) {
    if ('server' === clientOrServer) {
        //console.log('aveeee' + JSON.stringify(routeInfo));
        return {
            route: routeInfo.serverRoute,
            params: _.zipObject(
                _.map(routeInfo.serverParamNames, function (paramName) {
                    return paramName;
                }),
                _.map(routeInfo.serverParamNames, function (paramName) {
                    return routeParams[paramName];
                })
            ),
            query: query,
            calculateStateFunc: routeInfo.calculateStateFunc
        };
    } else if ('client' === clientOrServer) {
        console.log('routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
        console.log('routeParams: ' + JSON.stringify(routeParams, ' ', 4));
        var args = routeParams;
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
            ),
            query: query,
            calculateStateFunc: routeInfo.calculateStateFunc
        };
    } else {
        throw new Error("first argument (clientOrServer) should be 'client' or 'server'.");
    }
};


var I18nMixin = {
    messages: null,
    loadMessages: function () {
        if (undefined === this.props.topState.l10nData.messages) {
            throw Error("this.props.topState.l10nData.messages is undefined...");
        }
        this.messages = this.props.topState.l10nData.messages;
    },
    msg: function (messageStr) {
        return new IntlMessageFormat(messageStr, this.props.topState.globalLang);
    },
    fmt: function (messageObj, values) {
        return messageObj.format(values);
    }
};


var CrowDictionary = React.createClass({

    componentWillMount: function () {
    },
    getInitialState: function () {
        return initialState;
    },
    handleUserInput: function (searchTerm) {
        pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: searchTerm}, this.props.nRouteInfo.calculateStateFunc)
            .then((function (newState) {
                this.setState(newState);
                console.log("newState: " + JSON.stringify(newState, ' ', 4));
                console.log("Router: " + Router);
                Router.navigate('?q=' + searchTerm);
            }).bind(this));
    },
    handleGlobalLangChange: function (newLang) {
        pGenericCalculateState({globalLang: newLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
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
    handleLogIn: function (username, password) {
        console.log("user: " + username + ", pass: " + password);
        loginStateUrl = selfRoot + "/v1/login";
        return pRequest({method: "POST", url: loginStateUrl, body: {email: username, passhash: password}, json:true})
            .then((function(res) {
                if (200 !== res[0].statusCode) {
                    throw Error("invalid credentials");
                }
                console.log("login success!");
                console.log("res is: " + JSON.stringify(res, ' ', 4));
                var rObj = res[1]; // it's already json because we called `pRequest` with `{json:true}`
                console.log("rObj: " + JSON.stringify(rObj, ' ', 4));
                return pGenericCalculateState({searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
            }).bind(this))
            .then((function (newState) {
                newState.showLoginPrompt = false;
                this.replaceState(newState);
                this.forceUpdate();
            }).bind(this))
            .fail(function (err) {
                console.error("failed with error: " + err);
            });
    },
    handleLogOut: function () {
        var logOutUrl = selfRoot + "/v1/logout";
        return pRequest(logOutUrl)
            .then((function (res) {
                return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
            }).bind(this))
            .then((function (newState) {
                this.replaceState(newState);
            }).bind(this));
    },
    handleSubmitAddPhrase: function (phrase) {
        console.log("got a new phrase: " + phrase);
        var lang = this.state.globalLang,
            crumb = this.state.loginInfo.crumb,
            addPhraseUrl = util.format(selfRoot + "/v1/lang/%s/phrases/%s", lang, phrase);
        return pRequest({method: "PUT", url: addPhraseUrl, body: {phrase: phrase, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to add a new phrase...");
                }
                return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
            }).bind(this))
            .then((function (newState) {
                this.replaceState(newState);
            }).bind(this))
            .fail(function (err) {
                console.error("got an error: " + JSON.stringify(err, ' ', 4));
            });
    },
    handleSubmitAddDefinition: function (phrase, definition) {
        var lang = this.state.globalLang,
            crumb = this.state.loginInfo.crumb,
            addDefinitionUrl = util.format(selfRoot + "/v1/lang/%s/phrases/%s/definitions", lang, phrase);
        return pRequest({method: "POST", url: addDefinitionUrl, body: {phrase: phrase, definition: definition, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to add a new definition...");
                }
                return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm, shownPhraseData: this.state.shownPhraseData}, this.props.nRouteInfo.calculateStateFunc)
            }).bind(this))
            .then((function (newState) {
                this.replaceState(newState);
            }).bind(this))
            .fail(function (err) {
                console.error("got an error: " + JSON.stringify(err, ' ', 4));
            });
    },
    handleSelectPhrase: function (phraseData) {
        this.setState({
            shownPhraseData: phraseData
        });
    },
    handleClosePhraseDetails: function () {
        this.replaceState(appUtil.getObjectWithoutProps(this.state, ['shownPhraseData']));
    },
    render: function () {
        var mainContent;
        if (this.state.showLoginPrompt) {
            mainContent = <LoginPrompt topState={this.state} onLogIn={this.handleLogIn}/>;
        } else {
            if (this.state.shownPhraseData) {
                mainContent = <PhraseDetails topState={this.state} onClosePhraseDetails={this.handleClosePhraseDetails} onSubmitAddDefinition={this.handleSubmitAddDefinition}/>;
            } else {
                mainContent = <PhraseSearchResults topState={this.state} onSubmitAddPhrase={this.handleSubmitAddPhrase} onSelectPhrase={this.handleSelectPhrase}/>;
            }
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
                <TopBar onUserInput={this.handleUserInput} onGlobalLangChange={this.handleGlobalLangChange} onToggleLoginPrompt={this.handleToggleLoginPrompt} onLogOut={this.handleLogOut} topState={this.state}/>
                {mainContent}
            </div>
            <script src="/static/js/app.js" />
            </body>
            </html>
        );
    }
});

var PhraseDetails = React.createClass({
    handleBack: function () {
        console.log("closing PhraseDetails...");
        this.props.onClosePhraseDetails();
    },
    render: function () {
        return (
            <div>
                phrase: <PhraseInDetails topState={this.props.topState} />
                definitions: <DefinitionsInDetails topState={this.props.topState}/>
                <AddDefinitionForm topState={this.props.topState} onSubmitAddDefinition={this.props.onSubmitAddDefinition}/>
                <div>
                    <a onClick={this.handleBack}>Back</a>
                </div>
            </div>
        );
    }
});

var AddDefinitionForm = React.createClass({
    mixins: [I18nMixin],
    handleSubmit: function (e) {
        var newDefinition = this.refs.newDefinition.getDOMNode().value;
        e.preventDefault();
        this.props.onSubmitAddDefinition(this.props.topState.shownPhraseData.phrase, newDefinition);
    },
    render: function () {
        this.loadMessages();
        var addDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinition)),
            placeholder = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionPlaceHolder), {phrase: this.props.topState.shownPhraseData.phrase}),
            submit = this.fmt(this.msg(this.messages.AddDefinitionForm.submitDefinition));
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <span>{addDefinition}</span>
                    <textarea placeholder={placeholder} ref="newDefinition"/>
                    <input type="submit" value={submit}/>
                </form>
            </div>
        );
    }
});

var PhraseInDetails = React.createClass({
    render: function () {
        return (
            <div>{this.props.topState.shownPhraseData.phrase}</div>
        );
    }
});

var DefinitionsInDetails = React.createClass({
    render: function () {
        var definitionElements = _.map(this.props.topState.shownPhraseData.definitions, (function (definitionData, idx) {
            return (
                <DefinitionInDetails topState={this.props.topState} key={idx}/>
            );
        }).bind(this))
        return (
            <div>{definitionElements}</div>
        );
    }
});

var DefinitionInDetails = React.createClass({
    render: function () {
        return (
            <div>{this.props.topState.shownPhraseData.definitions[this.props.key].definition}</div>
        );
    }
});


var TopBar = React.createClass({
    render: function () {
        return (
            <div>
                <SearchBar onUserInput={this.props.onUserInput} topState={this.props.topState}/>
                <NavBar onGlobalLangChange={this.props.onGlobalLangChange} onToggleLoginPrompt={this.props.onToggleLoginPrompt} onLogOut={this.props.onLogOut} topState={this.props.topState}/>
            </div>
        );
    }
});

var SearchBar = React.createClass({
    mixins: [I18nMixin],
    handleChange: function () {
        console.log('in SearchBar::handleChange()');
        var searchTerm = this.refs.searchInput.getDOMNode().value;
        console.log("a change. searchTerm is now: " + searchTerm);
        this.props.onUserInput(searchTerm);
    },
    render: function () {
        console.log("this.handleChange: " + this.handleChange);
        this.loadMessages();
        var placeholder = this.fmt(this.msg(this.messages.SearchBar.placeHolder));
        return (
            <form>
            <input type="text" defaultValue={this.props.topState.searchTerm} placeholder={placeholder} ref="searchInput" onChange={this.handleChange}/>
            </form>
        );
    }
});

var NavBar = React.createClass({
    mixins: [I18nMixin],
    render: function () {
        this.loadMessages();
        var home = this.fmt(this.msg(this.messages.NavBar.home)),
            about = this.fmt(this.msg(this.messages.NavBar.about)),
            jobs = this.fmt(this.msg(this.messages.NavBar.jobs));
        return (
            <div>
                <span>{home}</span>
                <span>{about}</span>
                <span>{jobs}</span>
                <LoginStatus topState={this.props.topState} onToggleLoginPrompt={this.props.onToggleLoginPrompt} onLogOut={this.props.onLogOut}/>
                <GlobalLangPicker onGlobalLangChange={this.props.onGlobalLangChange} topState={this.props.topState}/>
            </div>
        );
    }
});

var LoginStatus = React.createClass({
    mixins: [I18nMixin],
    handleClick: function () {
        console.log('on handleClick');
        this.props.onToggleLoginPrompt();
    },
    handleLogOut: function () {
        this.props.onLogOut();
    },
    render: function () {
        this.loadMessages();
        var loginInfo = this.props.topState.loginInfo;
        console.log("loginInfo...: " + JSON.stringify(loginInfo, ' ', 4));
        if (undefined === loginInfo) {
            console.log("auch");
            console.log("mesagems: " + this.messages);
            console.log("tutti: " + JSON.stringify(this.messages));
            var greeting = this.fmt(this.msg(this.messages.LoginStatus.notLoggedInGreeting));
            return (
                <span onClick={this.handleClick}>{greeting}</span>
            );
        } else {
            console.log("on else");
            var greeting = this.fmt(this.msg(this.messages.LoginStatus.loggedInGreeting), {username: loginInfo.email}),
                logOutMessage = this.fmt(this.msg(this.messages.LoginStatus.logOutMessage));;
            return (
                <span>{greeting} <a onClick={this.handleLogOut}>{logOutMessage}</a></span>
            );
        }
        console.log("in LoginStatus, after all...");
    }
});

var LoginPrompt = React.createClass({
    handleLogIn: function (e) {
        var username = this.refs.username.getDOMNode().value,
            password = this.refs.password.getDOMNode().value;
        e.preventDefault();
        this.props.onLogIn(username, password);
    },
    render: function () {
        var display = this.props.topState.showLoginPrompt ? "block" : "none",
            style = {display: display};
        return (
            <form onSubmit={this.handleLogIn}>
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
                <option value="es-MX">México - Español</option>
            </select>
        );
    }
});

var PhraseSearchResults = React.createClass({
    render: function () {
        var phraseSearchResults = [];
        _.forEach(this.props.topState.searchResults, (function (result) {
            //phrase topDefinition
            phraseSearchResults.push(
                <PhraseSearchResult searchResult={result} key={result.key} onSelectPhrase={this.props.onSelectPhrase}/>
            );
        }).bind(this));
        return (
            <div>
                <TopSearchCaption topState={this.props.topState}/>
                <div className="phraseSearchResultsList">
                    {phraseSearchResults}
                </div>
                <AddPhraseForm onSubmitAddPhrase={this.props.onSubmitAddPhrase} topState={this.props.topState}/>
            </div>
        );
    }
});

var TopSearchCaption = React.createClass({
    mixins: [I18nMixin],
    render: function () {
        this.loadMessages();
        var showingResultsForSearchTerm = this.fmt(this.msg(this.messages.TopSearchCaption.showingResultsForSearchTerm), {searchTerm: this.props.topState.searchTerm});
        return (
            <div>
                {showingResultsForSearchTerm}
            </div>
        );
    }
});

var PhraseSearchResult = React.createClass({
    render: function () {
        return (
            <div>
                <PhraseInList searchResult={this.props.searchResult} onSelectPhrase={this.props.onSelectPhrase}/>
                <DefinitionInList searchResult={this.props.searchResult}/>
            </div>
        );
    }
});

var PhraseInList = React.createClass({
    handleClick: function () {
        console.log("clicked on phrase: " + this.props.searchResult.phrase);
        var phraseData = this.props.searchResult;
        this.props.onSelectPhrase(phraseData);
    },
    render: function () {
        return (
            <div onClick={this.handleClick}>
                {this.props.searchResult.phrase}
            </div>
        );
    }
});

var DefinitionInList = React.createClass({
    render: function () {
        var definition = this.props.searchResult.topDefinition.definition;
        return (
            <div>
                {definition}
            </div>
        );
    }
});

var AddPhraseForm = React.createClass({
    mixins: [I18nMixin],
    handleSubmit: function (e) {
        var newPhrase = this.refs.newPhrase.getDOMNode().value;
        e.preventDefault();
        this.props.onSubmitAddPhrase(newPhrase);
    },
    render: function () {
        this.loadMessages();
        var addPhrase = this.fmt(this.msg(this.messages.AddPhraseForm.addPhrase)),
            placeholder = this.fmt(this.msg(this.messages.AddPhraseForm.newPhrasePlaceHolder)),
            submit = this.fmt(this.msg(this.messages.AddPhraseForm.submitPhrase));
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <span>{addPhrase}</span>
                    <textarea placeholder={placeholder} ref="newPhrase"/>
                    <input type="submit" value={submit}/>
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
module.exports.setSelfRoot = setSelfRoot;
module.exports.setRouter = setRouter;
module.exports.pCalculateStateBasedOnNormalizedRouteInfo = pCalculateStateBasedOnNormalizedRouteInfo;
module.exports.l10n = {};
module.exports.l10n.getAvailableLangs = l10n.getAvailableLangs;
module.exports.l10n.getL10nForLang = l10n.getL10nForLang;
