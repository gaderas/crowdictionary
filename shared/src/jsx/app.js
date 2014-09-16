/** @jsx React.DOM */

var Q = require('q');
var appUtil = require('./util.js');
var React = require('react');
var LifecycleDebug = require('react-lifecycle-debug');
var InfiniteScroll = require('react-infinite-scroll')(React, [LifecycleDebug({displayName: 'InfiniteScroll'})]);
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
var mainReactComponentMounted = false;
var PHRASES_PAGE_SIZE = 2;


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

var RouteNotifier = function () {
    EventEmitter.call(this);
};

util.inherits(RouteNotifier, EventEmitter);

RouteNotifier.prototype.triggerStateChange = function (state) {
    console.log("RouteNotifier emitting" + JSON.stringify(state));
    this.emit('routenotifier-state-change-trigger', state);
};

RouteNotifier.prototype.listener = function (callback, state) {
    console.log("RouteNotifier catching: " + JSON.stringify(state));
    callback(state);
};

RouteNotifier.prototype.onStateChange = function (callback) {
    this.on('routenotifier-state-change-trigger', this.listener.bind(this, callback));
};

RouteNotifier.prototype.removeStateChangeListener = function () {
    console.log("RouteNotifier removing listener");
    this.removeListener('routenotifier-state-change-trigger', this.listener);
};

var routeNotifier = new RouteNotifier();

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
            console.log("state: " + JSON.stringify(state));
            console.log("lang is: " + state.globalLang + ", and l10nData: " + JSON.stringify(state.l10nData));
            if (!mainReactComponentMounted) {
                setInitialState(state);
                React.renderComponent(
                    <CrowDictionary nRouteInfo={nRouteInfo} />,
                    document
                );
            } else {
                // here we emit an event that our RouterMixin will catch and use as an indicator for updating React state
                routeNotifier.triggerStateChange(state);
            }
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
 *     "calculateStateFunc": "calculateStateFunc",
 *     "hostname": "example.com",
 *     "selfRoot": "http://example.com:8888"
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
                    return Q(nRouteInfo.calculateStateFunc({l10nData: l10nData}, nRouteInfo));
                });
        } else if (nRouteInfo.query && nRouteInfo.query.q) {
            return pL10nForLang
                .then(function (l10nData) {
                    return Q(nRouteInfo.calculateStateFunc({l10nData: l10nData, searchTerm: nRouteInfo.query.q}, nRouteInfo));
                });
        }
    } else if ('/phrases/:phrase' === nRouteInfo.route) {
        // "phrase page"
        console.log("nRouteInfo: " + JSON.stringify(nRouteInfo));
        return pL10nForLang
            .then(function (l10nData) {
                return Q(nRouteInfo.calculateStateFunc({l10nData: l10nData}, nRouteInfo));
            });
    }
};

var getPhraseSearchReactState = function (params) {
    var lang = params.lang,
        term = params.term,
        pageSize = params.pageSize,
        page = params.page,
        start = (page * pageSize),
        l10nData = params.l10nData;
    if (!term) {
        phrasesUrl = selfRoot + "/v1/lang/"+lang+"/phrases?start="+start+"&limit="+pageSize;
    } else {
        phrasesUrl = selfRoot + "/v1/lang/"+lang+"/phrases?search="+term+"&start="+start+"&limit="+pageSize;
    }
    return pRequest({method: "GET", url: phrasesUrl, json: true})
        .then(function (phrasesRes) {
            if (200 !== phrasesRes[0].statusCode) {
                throw Error("couldn't fetch phrases");
            }

            var rawSearchResults = phrasesRes[1],
                reactState = {
                    globalLang: lang,
                    l10nData: l10nData,
                    searchTerm: term,
                    searchResults: getReactStateSearchResults(rawSearchResults)
                };

            var phraseIds = _.map(reactState.searchResults, function (searchResult) {
                return searchResult.key;
            });

            if (!phraseIds.length) {
                return reactState;
            }
            definitionsUrl = selfRoot + "/v1/definitions?phraseIds="+phraseIds.join(',')
            return pRequest({method: "GET", url: definitionsUrl, json: true})
                .then(function (res) {
                    if (200 !== res[0].statusCode) {
                        throw Error("couldn't fetch definitions");
                    }
                    enrichReactStateSearchResults(reactState.searchResults, res[1]);
                    return reactState;
                });
        })
};

var getReactStateSearchResults = function (rawSearchResults) {
    return _.map(rawSearchResults, function (phraseObj) {
        return {
            phrase: phraseObj.phrase,
            key: phraseObj.id
        };
    });
};

var enrichReactStateSearchResults = function (searchResults, rawDefinitions) {
    _.forEach(searchResults, function (searchResult) {
        var definitions = _.where(rawDefinitions, {phrase_id: searchResult.key});
        searchResult.definitions = definitions;
        searchResult.topDefinition = _.max(definitions, function (def) {
            // this will return the one with the most votes, regardless if they're upvotes or downvotes...
            return def.votes.length;
        });
    });
    return;
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
                loginStateUrl = selfRoot + "/v1/login",
                definitionsUrl,
                phrasesUrl;
            return Q.all([
                getPhraseSearchReactState({l10nData: l10nData, lang: lang, term: term, pageSize: PHRASES_PAGE_SIZE, page: 0}),
                pRequest({method: "GET", url: loginStateUrl, json: true})
            ])
                .spread(function (reactState, loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            return Q.all([pRequest({method: "GET", url: phrasesUrl, json: true}), pRequest({method: "GET", url: loginStateUrl, json: true})])
                .spread(function (phrasesRes, loginStateRes) {
                    if (200 !== phrasesRes[0].statusCode) {
                        throw Error("couldn't fetch phrases");
                    }

                    var rawSearchResults = phrasesRes[1],
                        reactState = {
                            globalLang: lang,
                            l10nData: l10nData,
                            searchTerm: term,
                            searchResults: getReactStateSearchResults(rawSearchResults)
                        };
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }

                    var phraseIds = _.map(reactState.searchResults, function (searchResult) {
                        return searchResult.key;
                    });

                    if (!phraseIds.length) {
                        return reactState;
                    }
                    definitionsUrl = selfRoot + "/v1/definitions?phraseIds="+phraseIds.join(',')
                    return pRequest({method: "GET", url: definitionsUrl, json: true})
                        .then(function (res) {
                            if (200 !== res[0].statusCode) {
                                throw Error("couldn't fetch definitions");
                            }
                            enrichReactStateSearchResults(reactState.searchResults, res[1]);
                            return reactState;
                        });
                })
        }
    },
    {
        serverRoute: '/phrases/:phrase',
        serverParamNames: ['phrase'],
        clientRoute: 'phrases/:phrase',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/phrases/:phrase',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                phrase = (nRouteInfo && nRouteInfo.params && nRouteInfo.params.phrase),
                l10nData = (overrides && overrides.l10nData) || {},
                phraseUrl = selfRoot + util.format("/v1/lang/%s/phrases/%s", lang, phrase),
                loginStateUrl = selfRoot + "/v1/login";
            if ("string" !== typeof phrase || _.isEmpty(phrase)) {
                throw Error("phrase not provided in URL");
            }
            return Q.all([pRequest(phraseUrl), pRequest(loginStateUrl)])
                .spread(function (phraseRes, loginStateRes) {
                    if (200 !== phraseRes[0].statusCode) {
                        throw Error("couldn't fetch phrase");
                    }
                    var rObj = JSON.parse(phraseRes[1]),
                        reactState = {
                            globalLang: lang,
                            l10nData: l10nData,
                            shownPhraseData: rObj[0]
                        };
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = JSON.parse(loginStateRes[1]);
                    }

                    var phraseIds = [rObj[0].id];

                    return pRequest(selfRoot + "/v1/definitions?phraseIds=" + phraseIds.join(','))
                        .then(function (res) {
                            if (200 !== res[0].statusCode) {
                                throw Error("couldn't fetch definitions");
                            }
                            var rObj = JSON.parse(res[1]);
                            reactState.shownPhraseData.definitions = rObj;
                            //reactState.shownPhraseData.definitions[].topDefinition
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
    getEffectiveState: function () {
        var state;
        if (this.props && this.props.topState) {
            state = this.props.topState;
        } else if (this.state) {
            state = this.state;
        } else {
            throw Error("module doesn't have a state to get l10n data from");
        }
        return state;
    },
    loadMessages: function () {
        var state = this.getEffectiveState();
        if (!state.l10nData || !state.l10nData.messages) {
            throw Error("no messages found. module can't function correctly");
        }
        this.messages = state.l10nData.messages;
    },
    msg: function (messageStr) {
        var state = this.getEffectiveState();
        return new IntlMessageFormat(messageStr, state.globalLang);
    },
    fmt: function (messageObj, values) {
        return messageObj.format(values);
    },
    componentWillMount: function () {
        this.loadMessages();
    }
};

var LoggedInMixin = {
    getLoggedInInfo: function (loginRequired) {
        if (!this.state.loginInfo) {
            if (loginRequired) {
                throw Error(this.fmt(this.msg(this.messages.LoggedInMixin.requiredLoginMissing)));
            }
            return;
        }
        _.forEach(this.state.loginInfo, function (loginInfoField, fieldName) {
            this.state[fieldName] = loginInfoField;
        }, this);
    }
};

var RouterMixin = {
    componentWillMount: function () {
        // since this only makes sense on the client (where we have a backbone Router), we check first...
        if (_.isEmpty(Router)) {
            return;
        }

        routeNotifier.onStateChange((function (state) {
            this.replaceState(state);
        }).bind(this));
    },
    componentWillUnmount: function () {
        //Router.off('route');
        routeNotifier.removeStateChangeListener();
    },
};


var CrowDictionary = React.createClass({
    mixins: [I18nMixin, LoggedInMixin, RouterMixin],
    componentWillMount: function () {
    },
    componentDidMount: function () {
        mainReactComponentMounted = true;
    },
    getInitialState: function () {
        return initialState;
    },
    handleUserInput: function (searchTerm) {
        var fragment = '';
        if ('' !== searchTerm) {
            fragment = '?q=' + searchTerm;
        }
        Router.navigate(fragment, {trigger: true, replace: true});
    },
    handleGlobalLangChange: function (newLang) {
        /*pGenericCalculateState({globalLang: newLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
            .then((function (newState) {
                this.setState(newState);
                console.log("newState: " + JSON.stringify(newState, ' ', 4));
            }).bind(this));*/
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
                //return pGenericCalculateState({searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
                var searchTerm = this.state.searchTerm || '';
                var fragment = '';
                if ('' !== searchTerm) {
                    fragment = '?q=' + searchTerm;
                }
                Router.navigate(fragment, {trigger: true, replace: true});
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
                //return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
                var searchTerm = this.state.searchTerm || '';
                var fragment = '';
                if ('' !== searchTerm) {
                    fragment = '?q=' + searchTerm;
                }
                Router.navigate(fragment, {trigger: true, replace: true});
            }).bind(this))
            .then((function (newState) {
                this.replaceState(newState);
            }).bind(this));
    },
    handleSubmitAddPhrase: function (phrase) {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            this.setState({
                error: err
            });
            return;
        }
        console.log("got a new phrase: " + phrase);
        var lang = this.state.globalLang,
            crumb = this.state.crumb,
            addPhraseUrl = util.format(selfRoot + "/v1/lang/%s/phrases/%s", lang, phrase);
        return pRequest({method: "PUT", url: addPhraseUrl, body: {phrase: phrase, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    console.log("gonna throw");
                    throw Error("failed to add a new phrase...");
                }
                //return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
                var fragment = "/phrases/"+phrase+"?updated="+Date.now();
                Router.navigate(fragment, {trigger: true, replace: false});
            }).bind(this))
            .fail((function (err) {
                console.error("got an error: " + err);
                this.setState({
                    error: this.fmt(this.msg(this.messages.Errors.generic))
                });
            }).bind(this));
    },
    handleSubmitAddDefinition: function (phrase, definition, examples, tags) {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            this.setState({
                error: err
            });
            return;
        }
        var lang = this.state.globalLang,
            crumb = this.state.crumb,
            addDefinitionUrl = util.format(selfRoot + "/v1/lang/%s/phrases/%s/definitions", lang, phrase);
        return pRequest({method: "POST", url: addDefinitionUrl, body: {phrase: phrase, definition: definition, examples: examples, tags: tags, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to add a new definition...");
                }
                console.log("res: " + JSON.stringify(res));
                var definitionId = res[1].last_id,
                    fragment = "/phrases/"+phrase+"?updated="+Date.now();
                //return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm, shownPhraseData: this.state.shownPhraseData}, this.props.nRouteInfo.calculateStateFunc)
                Router.navigate(fragment, {trigger: true, replace: true});
            }).bind(this))
            /*.then((function (newState) {
                this.replaceState(newState);
            }).bind(this))*/
            .fail((function (err) {
                console.error("got an error: " + JSON.stringify(err, ' ', 4));
                this.setState({
                    error: this.fmt(this.msg(this.messages.Errors.generic))
                });
            }).bind(this));
    },
    handleSelectPhrase: function (phraseData) {
        var fragment = "/phrases/"+phraseData.phrase;
        /*this.setState({
            shownPhraseData: phraseData
        });*/
        Router.navigate(fragment, {trigger: true});
    },
    handleClosePhraseDetails: function () {
        // getNormalizedRouteInfo = function (clientOrServer, routeInfo, routeParams, query, hostname, selfRoot) {
        var hostname = this.props.nRouteInfo.hostname,
            selfRoot = this.props.nRouteInfo.selfRoot,
            searchTerm = this.refs.topBar.getSearchTerm(),
            filteredRoutesInfo = _.filter(routesInfo, {serverRoute: '/'}),
            routeInfo = filteredRoutesInfo[0],
            newQuery = !_.isEmpty(searchTerm) ? {q: searchTerm} : {},
            newNRouteInfo = getNormalizedRouteInfo('client', routeInfo, [], newQuery, hostname, selfRoot);
        return pCalculateStateBasedOnNormalizedRouteInfo(newNRouteInfo)
            .then((function (newState) {
                var fragment = newNRouteInfo.route;
                if (!_.isEmpty(newNRouteInfo.query)) {
                    fragment += '?' + _.map(newNRouteInfo.query, function (val, key) {
                        return key + "=" + val;
                    }).join('&');
                }
                //this.replaceState(appUtil.getObjectWithoutProps(newState, ['shownPhraseData']));
                this.replaceState(newState);
                Router.navigate(fragment);
            }).bind(this))
            .fail((function (err) {
                console.error("error: " + err);
                throw Error(err);
            }));
    },
    handleClearError: function () {
        this.setState({
            error: null
        });
    },
    handleDefinitionVote: function (voteInfo) {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            this.setState({
                error: err
            });
            return;
        }
        console.log("got a vote: " + JSON.stringify(voteInfo));
        var crumb = this.state.crumb,
            addVoteUrl = util.format(selfRoot + "/v1/definitions/%d/vote", voteInfo.definitionId);
        return pRequest({method: "PUT", url: addVoteUrl, body: {vote: voteInfo.vote, definition_id: voteInfo.definitionId, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to record vote...");
                }
                //return pGenericCalculateState({globalLang: this.state.globalLang, searchTerm: this.state.searchTerm}, this.props.nRouteInfo.calculateStateFunc)
                var fragment = "/phrases/"+voteInfo.phrase+"?update="+Date.now();
                Router.navigate(fragment, {trigger: true, replace: true});
            }).bind(this));
    },
    render: function () {
        var mainContent;
        if (this.state.error) {
            mainContent = <ErrorMessage onClearError={this.handleClearError} topState={this.state}/>;
        } else if (this.state.showLoginPrompt) {
            mainContent = <LoginPrompt topState={this.state} onLogIn={this.handleLogIn}/>;
        } else {
            if (this.state.shownPhraseData) {
                mainContent = <PhraseDetails topState={this.state} onVote={this.handleDefinitionVote} onClosePhraseDetails={this.handleClosePhraseDetails} onSubmitAddDefinition={this.handleSubmitAddDefinition}/>;
            } else {
                mainContent = <PhraseSearchResults topState={this.state} onSubmitAddPhrase={this.handleSubmitAddPhrase} onSelectPhrase={this.handleSelectPhrase}/>;
            }
        }
        //manifest="/static/assets/global_cache.manifest"
        return (
            <html lang="en-US" dir="ltr" >
            <head>
              <meta charset="utf-8" />
              <script src="/static/js/dep/underscore.js" />
              <script src="/static/js/dep/jquery.js" />
              <script src="/static/js/dep/backbone.js" />
              <link href="/static/css/main.css" rel="stylesheet" />
            </head>
            <body>
            <div>
                <TopBar onUserInput={this.handleUserInput} onGlobalLangChange={this.handleGlobalLangChange} onToggleLoginPrompt={this.handleToggleLoginPrompt} onLogOut={this.handleLogOut} topState={this.state} ref="topBar" />
                {mainContent}
            </div>
            <script src="/static/js/app.js" />
            </body>
            </html>
        );
    }
});

var ErrorMessage = React.createClass({
    mixins: [I18nMixin],
    componentWillMount: function () {
        this.loadMessages();
    },
    handleClearError: function () {
        this.props.onClearError();
    },
    render: function () {
        console.log("error message rendered by ErrorMessage: " + this.props.topState.error);
        var error = this.props.topState.error,
            OK = this.fmt(this.msg(this.messages.Errors.OK));
        return (
            <div>
                <div>{error}</div>
                <div onClick={this.handleClearError}>{OK}</div>
            </div>
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
                definitions: <DefinitionsInDetails onVote={this.props.onVote} topState={this.props.topState}/>
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
        var newDefinition = this.refs.newDefinition.getDOMNode().value,
            examples = this.refs.examples.getDOMNode().value,
            tags = this.refs.tags.getDOMNode().value;
        e.preventDefault();
        this.props.onSubmitAddDefinition(this.props.topState.shownPhraseData.phrase, newDefinition, examples, tags);
    },
    render: function () {
        this.loadMessages();
        var addDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinition)),
            placeholderDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionPlaceHolder), {phrase: this.props.topState.shownPhraseData.phrase}),
            placeholderExamples = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionExamplesPlaceHolder), {phrase: this.props.topState.shownPhraseData.phrase}),
            placeholderTags = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionTagsPlaceHolder), {phrase: this.props.topState.shownPhraseData.phrase}),
            submit = this.fmt(this.msg(this.messages.AddDefinitionForm.submitDefinition));
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <span>{addDefinition}</span>
                    <textarea placeholder={placeholderDefinition} ref="newDefinition"/>
                    <textarea placeholder={placeholderExamples} ref="examples"/>
                    <textarea placeholder={placeholderTags} ref="tags"/>
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
                <DefinitionInDetails onVote={this.props.onVote} topState={this.props.topState} key={idx}/>
            );
        }).bind(this))
        return (
            <div>{definitionElements}</div>
        );
    }
});

/**
 * thumbs icon "designmodo_linecons_free-like.svg" native dimensions are 32x32,
 * so all svg transformations (e.g.: rotation) have to take this into account.
 */
var DefinitionInDetails = React.createClass({
    mixins: [I18nMixin],
    handleVote: function (e) {
        console.log("annnd they voted...");
        console.log("on: " + e.target);
        console.log("is a: " + e.target.className);
        var userVote = this.getCurrentUserVote(),
            matches = e.target.className.match(/(up|down)/),
            definitionObj = this.props.topState.shownPhraseData.definitions[this.props.key],
    
            phrase = this.props.topState.shownPhraseData.phrase,
            apparentVote = matches[1],
            effectiveVote = apparentVote;
        if (('up' === userVote && 'up' === apparentVote) || ('down' === userVote && 'down' === apparentVote)) {
            effectiveVote = 'neutral'
        }
        if (matches) {
            this.props.onVote({vote: effectiveVote, definitionId: definitionObj.id, phrase: phrase});
        }
    },
    getCurrentUserVote: function () {
        var loginInfo = this.props.topState.loginInfo,
            definitionObj = this.props.topState.shownPhraseData.definitions[this.props.key],
            userVoteObjects = _.filter(definitionObj.votes, {contributor_id: loginInfo.id}),
            userVote = !_.isEmpty(loginInfo) && userVoteObjects && userVoteObjects[0] && userVoteObjects[0].vote; // 'up, 'down', or 'neutral'... or false

        this.userVote = userVote; // set this so we can use it in render() to adjust the 'title' a.k.a. 'tooltip'
        return userVote;
    },
    setupThumbsDOM: function (initialSetup) {
        var userVote = this.getCurrentUserVote();
        // need to call this inline, and also inside a 'load' event listener to
        // handle both cases: when rendered on server, and when rendered on client...
        var paintThumb = function (upOrDown) {
            console.log("paintThumb(), this: " + this);
            var like = this.contentDocument.getElementById('like');
            if (initialSetup && 'down' === upOrDown) {
                // we perform this rotation only once, on `componentDidMount()`...
                like.setAttribute('transform', 'rotate(180, 16, 16)');
            }
            like.setAttribute('stroke', 'black');
            if ('up' === userVote && 'up' === upOrDown) {
                like.setAttribute('stroke', 'green');
            }
            if ('down' === userVote && 'down' === upOrDown) {
                like.setAttribute('stroke', 'red');
            }
        };
        this.refs.thumbsUp.getDOMNode().addEventListener('load', function () {
            // for when page is reached via dynamic navigation
            paintThumb.call(this, 'up');
        });
        if (this.refs.thumbsUp.getDOMNode().contentDocument) {
            // for when page is accessed directly
            paintThumb.call(this.refs.thumbsUp.getDOMNode(), 'up');
        }
        this.refs.thumbsDown.getDOMNode().addEventListener('load', function () {
            // for when page is reached via dynamic navigation
            paintThumb.call(this, 'down');
        });
        if (this.refs.thumbsDown.getDOMNode().contentDocument) {
            // for when page is accessed directly
            paintThumb.call(this.refs.thumbsDown.getDOMNode(), 'down');
        }
        //this.refs.thumbsDown.addEventListener('click', this.handleVoteDown);
    },
    componentDidMount: function () {
        this.setupThumbsDOM(true);
    },
    componentDidUpdate: function () {
        this.setupThumbsDOM(false);
    },
    render: function () {
        var userVote = this.getCurrentUserVote(),
            definitionObj = this.props.topState.shownPhraseData.definitions[this.props.key],
            definition = definitionObj.definition,
            examples = definitionObj.examples,
            tags = definitionObj.tags,
            votesUpCount = _.filter(definitionObj.votes, {vote: "up"}).length,
            votesDownCount = _.filter(definitionObj.votes, {vote: "down"}).length,
            thumbsUpMessage = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsUpMessage), {numVotes: votesUpCount}),
            thumbsDownMessage = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsDownMessage), {numVotes: votesDownCount}),
            thumbsUpTitle = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsUpTitle), {currentVote: userVote}),
            thumbsDownTitle = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsDownTitle), {currentVote: userVote});
        return (
            <div>
                <div class="definition">{definition}</div>
                <div class="examples">{examples}</div>
                <div class="tags">{tags}</div>
                <div className="votes up container">
                    <div className="thumbs up container">
                        <object ref="thumbsUp" data="/static/assets/img/designmodo_linecons_free-like.svg" type="image/svg+xml"/>
                        <div className="thumbs up overlay" onClick={this.handleVote} title={thumbsUpTitle}> </div>
                    </div>
                    <div className="">{thumbsUpMessage}</div>
                </div>
                <div className="votes down container">
                    <div className="thumbs down container">
                        <object ref="thumbsDown" data="/static/assets/img/designmodo_linecons_free-like.svg" type="image/svg+xml"/>
                        <div className="thumbs down overlay" onClick={this.handleVote} title={thumbsDownTitle}> </div>
                    </div>
                    <div className="">{thumbsDownMessage}</div>
                </div>
            </div>
        );
    }
});


var TopBar = React.createClass({
    getSearchTerm: function () {
        return this.refs.searchBar.getSearchTerm();
    },
    render: function () {
        return (
            <div>
                <SearchBar onUserInput={this.props.onUserInput} topState={this.props.topState} ref="searchBar" />
                <NavBar onGlobalLangChange={this.props.onGlobalLangChange} onToggleLoginPrompt={this.props.onToggleLoginPrompt} onLogOut={this.props.onLogOut} topState={this.props.topState}/>
            </div>
        );
    }
});

var SearchBar = React.createClass({
    mixins: [I18nMixin],
    getSearchTerm: function () {
        console.log("getSearchTerm() called on component SearchBar. will return: " + this.refs.searchInput.getDOMNode().value);
        return this.refs.searchInput.getDOMNode().value;
    },
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
    mixins: [LifecycleDebug({displayName: 'PhraseSearchResults'})],
    hasMore: function (state) {
        return state.searchResults.length >= PHRASES_PAGE_SIZE;
    },
    getInitialState: function () {
        return _.merge(this.props.topState, {
            hasMore: this.hasMore(this.props.topState),
            resetPageStart: false
        });
    },
    componentWillReceiveProps: function (nextProps) {
        // we're rendering page 0 when this component receives props
        this.setState(_.merge(nextProps.topState, {
            hasMore: this.hasMore(nextProps.topState),
            resetPageStart: true
        }));
    },
    componentDidUpdate: function () {
        /*this.setState({
            resetPageStart: false
        });*/
    },
    loadMore: function (page) {
        // page is 0-index based
        var term = this.state.searchTerm,
            start = (page * PHRASES_PAGE_SIZE),
            lang = this.state.globalLang;
        console.log('load');
        getPhraseSearchReactState({lang: lang, term: term, pageSize: PHRASES_PAGE_SIZE, page: page})
            .then(function (reactState) {
                // the only part of the newly computed reactState that we'll use is the searchResults array to append it to our current one...
                this.setState({
                    searchResults: _.union(this.state.searchResults, reactState.searchResults),
                    hasMore: this.hasMore(reactState),
                    resetPageStart: false
                });
            }.bind(this));
    },
    render: function () {
        console.log("rendering PhraseSearchResults, the state is: " + JSON.stringify(this.state));
        var phraseSearchResults = [];
        _.forEach(this.state.searchResults, (function (result) {
            //phrase topDefinition
            phraseSearchResults.push(
                <PhraseSearchResult searchResult={result} key={result.key} onSelectPhrase={this.props.onSelectPhrase}/>
            );
        }).bind(this));
        var infiniteScroll = <InfiniteScroll
                loader={<div className="loader">loading...</div>}
                loadMore={this.loadMore}
                hasMore={this.state.hasMore}
                key="somethin"
                resetPageStart={this.state.resetPageStart}
            >
                {phraseSearchResults}
            </InfiniteScroll>
        return (
            <div>
                <TopSearchCaption topState={this.state}/>
                <div className="phraseSearchResultsList">
                    {infiniteScroll}
                </div>
                <AddPhraseForm onSubmitAddPhrase={this.props.onSubmitAddPhrase} topState={this.state}/>
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
