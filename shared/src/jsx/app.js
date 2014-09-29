/** @jsx React.DOM */

var Q = require('q');
var appUtil = require('./util.js');
var React = require('react/addons');
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
    baseRoot,
    Router,
    setPRequest = function (incoming) {
        pRequest = incoming;
        l10n.setPRequest(pRequest);
    },
    setBaseRoot = function (incoming) {
        baseRoot = incoming;
        l10n.setBaseRoot(incoming);
    },
    setRouter = function (incoming) {
        console.log("setting Router to : " + incoming);
        Router = incoming;
    };

var Layout = bs.Layout;
var Widget = bs.Widget;
var mainReactComponentMounted = false;
var PHRASES_PAGE_SIZE = 25;


_.mixin(require('./lodash_mixin.js'));

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

/**
 * transform a path, the kind that we pass to Router.navigate()
 * into a url (no hostname) suitable for anchor tags
 */
var aUrl = function (path, shortLangCode) {
    path = (path.match(/^\//) && path) || '/'+path;
    return (shortLangCode && '/'+shortLangCode+path) || path;
};

/**
 * transform a url (no hostname), the kind that we display in anchor tags,
 * into a path string suitable for passing to Router.navigate()
 */
var aPath = function (url, shortLangCode) {
    var re = new RegExp("^/?"+shortLangCode+"(/.*|$)"),
        matches = url.match(re);
    return (matches && matches[1]) || url;
};


var getNormalizedRouteInfo = function (clientOrServer, routeInfo, routeParams, query, hostname, baseRoot) {
    console.log('on getNormalizedRouteInfo(), routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
    console.log('on getNormalizedRouteInfo(), routeParams: ' + JSON.stringify(routeParams, ' ', 4));
    return _.merge(
        normalizeRouteInfo(clientOrServer, routeInfo, routeParams, query),
        {
            clientOrServer: clientOrServer,
            hostname: hostname,
            baseRoot: baseRoot
        }
    );
};



/**
 * this receives arguments from Backbone.Router in the following order:
 * *   routeInfo (passed via bind on the client code)
 * *   a number of arguments, each corresponding to a matched route path parameter
 * *   a query string, in string form (empty when none is present) is *always* the last argument
 */
var clientRouterFunc = function (routeInfo, shortLangCode) {
    console.log('on clientRouterFunc() begin. ');
    console.log("shortLangCode: " + routeInfo.shortLangCode);
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
        baseRoot = util.format("%s//%s", window.location.protocol, window.location.host),
        nRouteInfo = getNormalizedRouteInfo('client', routeInfo, params, query, hostname, baseRoot);


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
            console.error("error: " + (err.message) + "\nstack: \n" + (err.stack));
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
 *     "baseRoot": "http://example.com:8888"
 * }"
 */
var pCalculateStateBasedOnNormalizedRouteInfo = function (nRouteInfo) {
    /*var stateOverrides = {
        hostname: 'es-mx.crowdictionary.com',
        selfRoot: 'http://ex-mx.crowdictionary.com:3000',
        globalLang: 'es-MX'
    };*/
    //var stateOverrides = {};
        //hostname = (stateOverrides && stateOverrides.hostname) || window.location.hostname,
        //selfRoot = (stateOverrides && stateOverrides.selfRoot) || util.format("%s//%s", window.location.protocol, window.location.host),
    var hostname = nRouteInfo.hostname,
        baseRoot = nRouteInfo.baseRoot,
        effectiveRoot = baseRoot + "/" + nRouteInfo.shortLangCode,
        pL10nForLang = null;

    setBaseRoot(baseRoot);

    pL10nForLang = l10n.langDetect(effectiveRoot)
        .then(function (langInfo) {
            return l10n.getL10nForLang(langInfo.langByReferrer) // we also have langByIp which we can use to tease the user to visit another lang
                .then(function (l10nData) {
                    return {
                        l10nData: l10nData,
                        globalLang: langInfo.langByReferrer,
                        langByIp: langInfo.langByIp
                    };
                });
        });


    if ('/' === nRouteInfo.route) {
        if (!nRouteInfo.query || !nRouteInfo.query.q) {
            // "home page"
            return pL10nForLang
                .then(function (l) {
                    return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
                });
        } else if (nRouteInfo.query && nRouteInfo.query.q) {
            return pL10nForLang
                .then(function (l) {
                    return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, searchTerm: nRouteInfo.query.q}, nRouteInfo));
                });
        }
    } else if ('/phrases/:phrase' === nRouteInfo.route) {
        // "phrase page"
        console.log("nRouteInfo: " + JSON.stringify(nRouteInfo));
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    } else if ('/contributors/:contributor_id/activity' === nRouteInfo.route) {
        // "contributor activity page"
        console.log("nRouteInfo: " + JSON.stringify(nRouteInfo));
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    } else if ('/logout' === nRouteInfo.route) {
        // "logout" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    } else if ('/login' === nRouteInfo.route) {
        // "login" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    } else if ('/verify' === nRouteInfo.route) {
        // "login" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    } else if ('/addPhrase' === nRouteInfo.route) {
        // "add phrase" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    } else if ('/addDefinition' === nRouteInfo.route) {
        // "add definition" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData}, nRouteInfo));
            });
    }
};

var getPhraseSearchReactState = function (params) {
    var lang = params.lang,
        term = params.term,
        pageSize = params.pageSize,
        page = params.page,
        start = (page * pageSize),
        l10nData = params.l10nData,
        shortLangCode = params.shortLangCode;
    if (!term) {
        phrasesUrl = baseRoot + "/v1/lang/"+lang+"/phrases?start="+start+"&limit="+pageSize;
    } else {
        phrasesUrl = baseRoot + "/v1/lang/"+lang+"/phrases?search="+term+"&start="+start+"&limit="+pageSize;
    }
    return pRequest({method: "GET", url: phrasesUrl, json: true})
        .then(function (phrasesRes) {
            if (200 !== phrasesRes[0].statusCode) {
                throw Error("couldn't fetch phrases");
            }

            var rawSearchResults = phrasesRes[1],
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    searchTerm: term,
                    searchResults: getReactStatePhraseSearchResults(rawSearchResults)
                };

            var phraseIds = _.map(reactState.searchResults, function (searchResult) {
                return searchResult.key;
            });

            if (!phraseIds.length) {
                return reactState;
            }
            definitionsUrl = baseRoot + "/v1/definitions?phraseIds="+phraseIds.join(',')
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

var getContributorActivityReactState = function (params) {
    var lang = params.lang,
        contributor_id = params.contributor_id,
        pageSize = params.pageSize,
        page = params.page,
        start = (page * pageSize),
        l10nData = params.l10nData,
        activityUrl = baseRoot + util.format("/v1/contributors/%d/activity?lang=%s&start=%d&limit=%d", contributor_id, lang, start, pageSize),
        shortLangCode = params.shortLangCode;

        return pRequest({url: activityUrl, json: true})
            .then(function (activityRes) {
                if (200 !== activityRes[0].statusCode) {
                    throw Error("couldn't fetch activity");
                }
                var rObj = activityRes[1],
                    reactState = {
                        globalLang: lang,
                        shortLangCode: shortLangCode,
                        l10nData: l10nData,
                        contributorActivity: rObj
                    };

                return reactState;
            });
};

var getReactStatePhraseSearchResults = function (rawSearchResults) {
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
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                term = (overrides && overrides.searchTerm) || '',
                l10nData = (overrides && overrides.l10nData) || {},
                loginStateUrl = baseRoot + "/v1/login",
                definitionsUrl,
                phrasesUrl;
            return Q.all([
                getPhraseSearchReactState({l10nData: l10nData, lang: lang, shortLangCode: nRouteInfo.shortLangCode, term: term, pageSize: PHRASES_PAGE_SIZE, page: 0}),
                pRequest({method: "GET", url: loginStateUrl, json: true})
            ])
                .spread(function (reactState, loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
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
                phraseUrl = baseRoot + util.format("/v1/lang/%s/phrases/%s", lang, phrase),
                loginStateUrl = baseRoot + "/v1/login",
                shortLangCode = nRouteInfo.shortLangCode;
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
                            shortLangCode: shortLangCode,
                            l10nData: l10nData,
                            shownPhraseData: rObj[0]
                        };
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = JSON.parse(loginStateRes[1]);
                    }

                    var phraseIds = [rObj[0].id];

                    return pRequest(baseRoot + "/v1/definitions?phraseIds=" + phraseIds.join(','))
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
        serverRoute: '/contributors/:contributor_id/activity',
        serverParamNames: ['contributor_id'],
        clientRoute: 'contributors/:contributor_id/activity',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/contributors/:contributor_id/activity',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                contributor_id = parseInt(nRouteInfo && nRouteInfo.params && nRouteInfo.params.contributor_id, 10),
                l10nData = (overrides && overrides.l10nData) || {},
                loginStateUrl = baseRoot + "/v1/login",
                shortLangCode = nRouteInfo.shortLangCode;
            if (!contributor_id) {
                throw Error("contributor_id not provided in URL");
            }

            return Q.all([
                getContributorActivityReactState({l10nData: l10nData, shortLangCode: shortLangCode, lang: lang, contributor_id: contributor_id, pageSize: PHRASES_PAGE_SIZE, page: 0}),
                pRequest({method: "GET", url: loginStateUrl, json: true})
            ])
                .spread(function (reactState, loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    } else {
                        // here we could prevent visits to others' activity pages when not logged in
                    }
                    return reactState;
                });
        }
    },
    {
        serverRoute: '/logout',
        serverParamNames: [],
        clientRoute: 'logout',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/logout',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    doLogOut: true
                },
                loginStateUrl = baseRoot + "/v1/login";
            return pRequest({method: "GET", url: loginStateUrl, json: true})
                .then(function (loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
        }
    },
    {
        serverRoute: '/login',
        serverParamNames: [],
        clientRoute: 'login',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/login',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    showLoginPrompt: true,
                    contributorAccountCreated: !!nRouteInfo.query.contributorAccountCreated
                },
                loginStateUrl = baseRoot + "/v1/login";
            return pRequest({method: "GET", url: loginStateUrl, json: true})
                .then(function (loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
        }
    },
    {
        serverRoute: '/verify',
        serverParamNames: [],
        clientRoute: 'verify',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/verify',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    showVerificationPrompt: !nRouteInfo.query.validateVerification,
                    validateVerification: nRouteInfo.query.validateVerification,
                    email: nRouteInfo.query.email
                },
                loginStateUrl = baseRoot + "/v1/login";
            return pRequest({method: "GET", url: loginStateUrl, json: true})
                .then(function (loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
        }
    },
    {
        serverRoute: '/addPhrase',
        serverParamNames: [],
        clientRoute: 'addPhrase',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/addPhrase',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    showAddPhrase: true
                },
                loginStateUrl = baseRoot + "/v1/login";
            return pRequest({method: "GET", url: loginStateUrl, json: true})
                .then(function (loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
        }
    },
    {
        serverRoute: '/addDefinition',
        serverParamNames: ['phrase'],
        clientRoute: 'addDefinition',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/addDefinition',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    showAddDefinition: false
                },
                phrase = nRouteInfo.query.phrase,
                loginStateUrl = baseRoot + "/v1/login",
                phraseUrl = baseRoot + util.format("/v1/lang/%s/phrases/%s", lang, phrase);
            if ("string" !== typeof phrase || _.isEmpty(phrase)) {
                throw Error("phrase not provided in URL");
            }
            return Q.all([pRequest({url: phraseUrl, json: true}), pRequest({url: loginStateUrl, json: true})])
                .spread(function (phraseRes, loginStateRes) {
                    if (200 !== phraseRes[0].statusCode) {
                        throw Error("couldn't fetch phrase");
                    }
                    if (!phraseRes[1].length) {
                        throw Error("phrase not found");
                    }
                    reactState.showAddDefinition = phraseRes[1][0];
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
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
            calculateStateFunc: routeInfo.calculateStateFunc,
            shortLangCode: routeInfo.shortLangCode
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
            calculateStateFunc: routeInfo.calculateStateFunc,
            shortLangCode: routeInfo.shortLangCode
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

/**
 * depends on I18nMixin
 */
var CodedMessagesMixin = {
    getCodedMessage: function (wsResponse) {
        var ret,
            e = this.messages.Errors,
            i = this.messages.Infos;
        if (!wsResponse || _.isEmpty(wsResponse)) {
            throw Error("no wsResponse passed to CodeMessagesMixin::get()");
        }
        if (wsResponse.errno) {
            var errcode = 'errno'+wsResponse.errno;
            ret = e[errcode];
            if (!ret) {
                console.error("couldn't find error with code: " + errcode + " in strings collection");
                ret = "ERROR";
            }
        } else if (wsResponse.infono) {
            var infocode = 'infono'+wsResponse.infono;
            ret = i[infocode];
            if (!ret) {
                console.error("couldn't find info message with code: " + infocode + " in strings collection");
                ret = "GENERIC NOTICE";
            }
        }
        return ret;
    }
};

var LinksMixin = {
    handleToLink: function (url, e) {
        e.preventDefault();
        Router.navigate(aPath(url), {trigger: true, replace: false});
    }
};


var CrowDictionary = React.createClass({
    mixins: [I18nMixin, LoggedInMixin, RouterMixin, CodedMessagesMixin],
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
    },
    handleToggleLoginPrompt: function () {
        console.log('clicked on toggle login prompt...');
        Router.navigate('login', {trigger: true, replace: false});
    },
    handleLogIn: function (username, password) {
        console.log("user: " + username + ", pass: " + password);
        loginStateUrl = baseRoot + "/v1/login";
        return pRequest({method: "POST", url: loginStateUrl, body: {email: username, passhash: password}, json:true})
            .then((function(res) {
                if (200 !== res[0].statusCode) {
                    console.error("handleLogIn(). invalid credentials");
                    this.setState({
                        error: 'errno'+res[1].errno
                    });
                    return;
                }
                var rObj = res[1];
                var searchTerm = this.state.searchTerm || '';
                var fragment = '';
                if ('' !== searchTerm) {
                    fragment = '?q=' + searchTerm;
                }
                Router.navigate(fragment, {trigger: true, replace: false});
            }).bind(this))
            .fail(function (err) {
                console.error("handleLogIn(). failed with error: " + err);
                this.setState({
                    error: 'generic'
                });
            });
    },
    handleSignup: function (values) {
        //console.log("user: " + username + ", pass: " + password);
        signupUrl = baseRoot + "/v1/contributors?email=" + values.email;
        return pRequest({method: "PUT", url: signupUrl, body: _.filterObject(values, _.isNotEmptyValue), json:true})
            .then((function(res) {
                if (200 !== res[0].statusCode) {
                    throw res[1]; // the body contains structured data about errors
                }
                var rObj = res[1],
                    fragment = '/login?updated='+Date.now();
                this.setState({
                    info: this.messages.SignupForm.signupSuccess,
                    clearInfoCallback: function () {
                        Router.navigate(fragment, {trigger: true, replace: false});
                    }
                });
            }).bind(this))
            .fail(function (err) {
                throw err;
                //console.error("failed with error: " + err);
            });

    },
    handleLogOut: function () {
        Router.navigate('logout', {trigger: true, replace: false});
    },
    handleSubmitAddPhrase: function (phrase) {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            console.error("caught error: " + err);
            this.setState({
                error: "generic"
            });
            return;
        }
        console.log("got a new phrase: " + phrase);
        var lang = this.state.globalLang,
            crumb = this.state.crumb,
            addPhraseUrl = util.format(baseRoot + "/v1/lang/%s/phrases/%s", lang, phrase);
        return pRequest({method: "PUT", url: addPhraseUrl, body: {phrase: phrase, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    console.log("gonna throw");
                    throw Error("failed to add a new phrase...");
                }
                var fragment = "/phrases/"+phrase+"?updated="+Date.now();
                Router.navigate(fragment, {trigger: true, replace: false});
            }).bind(this))
            .fail((function (err) {
                console.error("got an error: " + err);
                this.setState({
                    error: "generic"
                });
            }).bind(this));
    },
    handleSubmitAddDefinition: function (phrase, definition, examples, tags) {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            console.error("got an error: " + err);
            this.setState({
                error: "generic"
            });
            return;
        }
        var lang = this.state.globalLang,
            crumb = this.state.crumb,
            addDefinitionUrl = util.format(baseRoot + "/v1/lang/%s/phrases/%s/definitions", lang, phrase);
        return pRequest({method: "POST", url: addDefinitionUrl, body: {phrase: phrase, definition: definition, examples: examples, tags: tags, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to add a new definition...");
                }
                console.log("res: " + JSON.stringify(res));
                var definitionId = res[1].last_id,
                    fragment = "/phrases/"+phrase+"?updated="+Date.now();
                Router.navigate(fragment, {trigger: true, replace: true});
            }).bind(this))
            .fail((function (err) {
                console.error("got an error: " + JSON.stringify(err, ' ', 4));
                this.setState({
                    error: "generic"
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
    getSearchTermFromDOM: function () {
        return this.refs.topBar.getSearchTerm();
    },
    handleClosePhraseDetails: function () {
        // getNormalizedRouteInfo = function (clientOrServer, routeInfo, routeParams, query, hostname, selfRoot) {
        var hostname = this.props.nRouteInfo.hostname,
            selfRoot = this.props.nRouteInfo.selfRoot,
            searchTerm = this.getSearchTermFromDOM(),
            filteredRoutesInfo = _.filter(routesInfo, {serverRoute: '/'}),
            routeInfo = filteredRoutesInfo[0],
            newQuery = !_.isEmpty(searchTerm) ? {q: searchTerm} : {},
            newNRouteInfo = getNormalizedRouteInfo('client', routeInfo, [], newQuery, hostname, selfRoot),
            fragment = '';

        if ('' !== searchTerm) {
            fragment = '?q=' + searchTerm;
        }
        Router.navigate(fragment, {trigger: true, replace: true});
    },
    handleClearError: function () {
        this.setState({
            error: undefined
        });
    },
    handleClearInfo: function () {
        console.log("clearing info...");
        if (this.state.clearInfoCallback) {
            this.state.clearInfoCallback();
            // invoke the callback (most likely Router.navigate), and we're done!
            return;
        }
        this.setState({
            info: undefined
        });
    },
    handleSetInfo: function (info, cb) {
        this.setState({
            info: info,
            clearInfoCallback: cb
        });
    },
    handleDefinitionVote: function (voteInfo) {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            console.error("got an error: " + err);
            this.setState({
                error: "generic"
            });
            return;
        }
        /*if (voteInfo.error) {
            this.setState(voteInfo);
            return;
        } else if (voteInfo.info) {
            this.setState(voteInfo);
            return;
        }*/
        console.log("got a vote: " + JSON.stringify(voteInfo));
        var crumb = this.state.crumb,
            addVoteUrl = util.format(baseRoot + "/v1/definitions/%d/vote", voteInfo.definitionId);
        return pRequest({method: "PUT", url: addVoteUrl, body: {vote: voteInfo.vote, definition_id: voteInfo.definitionId, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to record vote...");
                }
                var fragment = "/phrases/"+voteInfo.phrase+"?update="+Date.now();
                Router.navigate(fragment, {trigger: true, replace: true});
            }).bind(this));
    },
    handleToMyActivity: function () {
        var loginInfo = this.state.loginInfo,
            shortLangCode = this.state.shortLangCode,
            fragment = util.format("/contributors/%s/activity", loginInfo.id);
        Router.navigate(fragment, {trigger: true, replace: false});
    },
    submitVerification: function (validateVerification, email) {
        var modifyContributorUrl = util.format(baseRoot + "/v1/contributors?email=%s", email),
            requestBody = {email: email, validateVerification: validateVerification};
        return pRequest({method: "PUT", url: modifyContributorUrl, body: requestBody, json: true})
            .then(function (res) {
                if (200 !== res[0].statusCode) {
                    console.error("err: " + res[0]);
                    this.setState({
                        info: this.getCodedMessage(res[1])
                    });
                    return;
                }
                this.setState({
                    info: this.getCodedMessage(res[1])
                });
            }.bind(this))
            .fail(function (err) {
                console.error(err);
                this.setState({
                    error: 'generic'
                });
            }.bind(this));
    },
    doLogOut: function () {
        var logOutUrl = baseRoot + "/v1/logout";
        return pRequest({url: logOutUrl, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    console.error("/v1/logout error: " + JSON.stringify(res[1]));
                    this.setState({
                        error: this.getCodedMessage(res[1])
                    });
                    return;
                }
                console.log("doLogOut(). no error. setting state...");
                this.setState({
                    info: this.getCodedMessage(res[1]),
                    clearInfoCallback: function () {
                        Router.navigate("", {trigger: true, replace: false});
                    }
                });
            }).bind(this));
    },
    render: function () {
        //console.log("on render, with state: " + JSON.stringify(this.state));
        var mainContent;
        if (this.state.error) {
            mainContent = <ErrorMessage onClearError={this.handleClearError} topState={this.state}/>;
        } else if (this.state.info) {
            mainContent = <InfoMessage onClearInfo={this.handleClearInfo} topState={this.state}/>;
        } else if (this.state.showLoginPrompt) {
            mainContent = <LoginPrompt topState={this.state} onLogIn={this.handleLogIn} onSignup={this.handleSignup} onSetInfo={this.handleSetInfo} onClearInfo={this.handleClearInfo}/>;
        } else if (this.state.showVerificationPrompt) {
            // display form where verification code can be entered
            mainContent = <VerificationPrompt topState={this.state}/>
        } else if (this.state.validateVerification) {
            // we got the code. let's check if it's valid and display the result
            mainContent = <VerificationOutcome topState={this.state} submitVerification={this.submitVerification} />
        } else if (this.state.doLogOut) {
            // log out
            mainContent = <LogOutOutcome topState={this.state} doLogOut={this.doLogOut} />
        } else if (this.state.shownPhraseData) {
            mainContent = <PhraseDetails topState={this.state} onVote={this.handleDefinitionVote} onClosePhraseDetails={this.handleClosePhraseDetails} getSearchTermFromDOM={this.getSearchTermFromDOM} onSetInfo={this.handleSetInfo}/>;
        } else if (!_.isEmpty(this.state.contributorActivity)) {
            mainContent = <ContributorActivity topState={this.state} onClickActivityItem={this.handleSelectPhrase}/>;
        } else if (this.state.showAddPhrase){
            mainContent = <AddPhraseForm onSubmitAddPhrase={this.handleSubmitAddPhrase} onSetInfo={this.handleSetInfo} topState={this.state}/>;
        } else if (this.state.showAddDefinition) {
            // showAddDefinition itself is a phrase object
            mainContent = <AddDefinitionForm phraseData={this.state.showAddDefinition} topState={this.state} onSubmitAddDefinition={this.handleSubmitAddDefinition} onSetInfo={this.handleSetInfo}/>;
        } else {
            mainContent = <PhraseSearchResults topState={this.state} onSelectPhrase={this.handleSelectPhrase} onSetInfo={this.handleSetInfo}/>;
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
                <TopBar onUserInput={this.handleUserInput} onGlobalLangChange={this.handleGlobalLangChange} onToggleLoginPrompt={this.handleToggleLoginPrompt} onLogOut={this.handleLogOut} onToMyActivity={this.handleToMyActivity} topState={this.state} ref="topBar" />
                {mainContent}
            </div>
            <footer>{this.messages.Footer.copyrightNotice}</footer>
            <script src="/static/js/app.js" />
            </body>
            </html>
        );
    }
});

var VerificationOutcome = React.createClass({
    mixins: [I18nMixin],
    componentWillMount: function () {
        var topState = this.props.topState,
            validateVerification = topState.validateVerification,
            email = topState.email,
            submitVerification = this.props.submitVerification;
        submitVerification(validateVerification, email);
        /*Q.fcall(submitVerification.bind(this.props, validateVerification, email))
            .then(function (res) {
                console.log("verification success!");
                this.setState({
                    verified: true
                });
            }.bind(this))
            .fail(function (err) {
                console.err("verification error: " + err.message);
                this.setState({
                    verified: false
                });
            }.bind(this));*/
    },
    render: function () {
        return <div>Validating your account...</div>;
    }
});

var VerificationPrompt = React.createClass({
    mixins: [I18nMixin],
    handleSubmit: function (e) {
        var validateVerification = this.refs.validateVerification.getDOMNode().value,
            email = this.refs.email.getDOMNode().value,
            fragment = "verify?validateVerification="+validateVerification+"&email="+email;
        e.preventDefault();
        Router.navigate(fragment, {trigger: true, replace: false});
    },
    render: function () {
        var messages = this.messages.VerificationPrompt;
        return (
            <form onSubmit={this.handleSubmit}>
                <fieldset>
                    <legend>{messages.formTitle}</legend>
                    <label>
                        {messages.verificationCodeFieldLabel}
                        <input ref="validateVerification" placeholder={messages.verificationCodeFieldPlaceholder}/>
                    </label>
                    <label>
                        {messages.emailFieldLabel}
                        <input ref="email" placeholder={messages.emailFieldPlaceholder}/>
                    </label>
                    <input type="submit" value={messages.submit}/>
                </fieldset>
            </form>
        );
    }
});

/**
 * the 'error' property on the state that triggers this is a *code*
 * @TODO refactor this to work like InfoMessage, to take a string and a callback
 */
var ErrorMessage = React.createClass({
    mixins: [I18nMixin],
    componentWillMount: function () {
    },
    handleClearError: function () {
        this.props.onClearError();
    },
    render: function () {
        console.log("error message code that will be rendered by ErrorMessage: " + this.props.topState.error);
        var error = this.props.topState.error,
            errorMessage = this.messages.Errors[error] || "ERROR",
            OK = this.messages.Errors.OK;
        return (
            <div>
                <div>{errorMessage}</div>
                <div onClick={this.handleClearError}>{OK}</div>
            </div>
        );
    }
});

/**
 * the 'info' property on the state that triggers this is a string
 */
var InfoMessage = React.createClass({
    mixins: [I18nMixin],
    componentWillMount: function () {
    },
    handleClearInfo: function () {
        this.props.onClearInfo();
    },
    render: function () {
        var message = this.props.topState.info,
            OK = this.messages.Errors.OK;
        return (
            <div>
                <div>{message}</div>
                <div onClick={this.handleClearInfo}>{OK}</div>
            </div>
        );
    }
});

var PhraseDetails = React.createClass({
    mixins: [I18nMixin],
    handleBack: function (e) {
        e.preventDefault();
        this.props.onClosePhraseDetails();
    },
    render: function () {
        var backToSearchResultsCaption = this.fmt(this.msg(this.messages.PhraseDetails.backToSearchResults)),
            shortLangCode = this.props.topState.shortLangCode,
            searchTerm = this.props.getSearchTermFromDOM(),
            backToSearchResultsRelativeUrl = searchTerm ? '?q=' + searchTerm : '',
            backToSearchResultsUrl = aUrl(backToSearchResultsRelativeUrl, shortLangCode);
        return (
            <div>
                phrase: <PhraseInDetails topState={this.props.topState} />
                definitions: <DefinitionsInDetails onVote={this.props.onVote} topState={this.props.topState} onSetInfo={this.props.onSetInfo}/>
                <div>
                    <a href={backToSearchResultsUrl} onClick={this.handleBack}>{backToSearchResultsCaption}</a>
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
            tags = this.refs.tags.getDOMNode().value,
            loginInfo = this.props.topState.loginInfo,
            phraseData = this.props.phraseData,
            m = this.messages.AddDefinitionForm;
        e.preventDefault();
        if (!loginInfo) {
            this.props.onSetInfo(m.loginRequired);
            return false;
        }
        this.props.onSubmitAddDefinition(this.props.phraseData.phrase, newDefinition, examples, tags);
    },
    render: function () {
        //this.loadMessages();
        var addDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinition)),
            placeholderDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionPlaceHolder), {phrase: this.props.phraseData.phrase}),
            placeholderExamples = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionExamplesPlaceHolder), {phrase: this.props.phraseData.phrase}),
            placeholderTags = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionTagsPlaceHolder), {phrase: this.props.phraseData.phrase}),
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
                <DefinitionInDetails onVote={this.props.onVote} topState={this.props.topState} onSetInfo={this.props.onSetInfo} key={idx}/>
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
        var loginInfo = this.props.topState.loginInfo,
            userVote = this.getCurrentUserVote(),
            matches = e.target.className.match(/(up|down)/),
            definitionObj = this.props.topState.shownPhraseData.definitions[this.props.key],
            phrase = this.props.topState.shownPhraseData.phrase,
            apparentVote = matches[1],
            effectiveVote = apparentVote,
            voteInfo,
            m = this.messages.DefinitionInDetails;
        if (!loginInfo) {
            //var displayedInfo = this.messages
            this.props.onSetInfo(m.loginRequiredToVote);
            return false;
        }
        if (('up' === userVote && 'up' === apparentVote) || ('down' === userVote && 'down' === apparentVote)) {
            effectiveVote = 'neutral'
        }
        if (matches) {
            this.props.onVote({vote: effectiveVote, definitionId: definitionObj.id, phrase: phrase});
        } else {
            this.props.onVote({
                error: 'generic'
            });
        }
    },
    getCurrentUserVote: function () {
        var loginInfo = this.props.topState.loginInfo,
            definitionObj = this.props.topState.shownPhraseData.definitions[this.props.key],
            userVoteObjects = loginInfo && _.filter(definitionObj.votes, {contributor_id: loginInfo.id}),
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
                <div className="definition">{definition}</div>
                <div className="examples">{examples}</div>
                <div className="tags">{tags}</div>
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
        return (this.refs.searchBar && this.refs.searchBar.getSearchTerm()) || "";
    },
    render: function () {
        return (
            <header className="TopBar">
                <NavBar onGlobalLangChange={this.props.onGlobalLangChange} onToggleLoginPrompt={this.props.onToggleLoginPrompt} onLogOut={this.props.onLogOut} topState={this.props.topState} onToMyActivity={this.props.onToMyActivity} />
                <SearchBar onUserInput={this.props.onUserInput} topState={this.props.topState} ref="searchBar" />
            </header>
        );
    }
});

var SearchBar = React.createClass({
    mixins: [I18nMixin],
    getSearchTerm: function () {
        try {
            // React quirk: this throws when called on the server side, so we try/catch it...
            return (this.refs.searchInput && this.refs.searchInput.getDOMNode() && this.refs.searchInput.getDOMNode().value) || "";
        } catch (err) {
            console.log("caught: " + err + "... returning '' (empty string)");
            return "";
        }
    },
    handleChange: function () {
        console.log('in SearchBar::handleChange()');
        var searchTerm = this.refs.searchInput.getDOMNode().value;
        console.log("a change. searchTerm is now: " + searchTerm);
        this.props.onUserInput(searchTerm);
    },
    render: function () {
        console.log("this.handleChange: " + this.handleChange);
        //this.loadMessages();
        var placeholder = this.fmt(this.msg(this.messages.SearchBar.placeHolder));
        return (
            <section className="SearchBar">
            <form className="SearchBar oi" data-glyph="magnifying-glass">
            <input type="text" defaultValue={this.props.topState.searchTerm} placeholder={placeholder} ref="searchInput" onChange={this.handleChange}/>
            </form>
            </section>
        );
    }
});

var NavBar = React.createClass({
    mixins: [I18nMixin, LinksMixin],
    render: function () {
        //this.loadMessages();
        var home = this.fmt(this.msg(this.messages.NavBar.home)),
            about = this.fmt(this.msg(this.messages.NavBar.about)),
            jobs = this.fmt(this.msg(this.messages.NavBar.jobs)),
            homeUrl = aUrl("/", this.props.topState.shortLangCode);
        return (
            <nav className="NavBar">
                <h2 className="home"><a className="oi" data-glyph="home" title={home} onClick={this.handleToLink.bind(this, homeUrl)} href={homeUrl}></a></h2>
                <UserLinks phraseData={this.props.topState.shownPhraseData} topState={this.props.topState} onToMyActivity={this.props.onToMyActivity}/>
                <LoginStatus topState={this.props.topState} onToggleLoginPrompt={this.props.onToggleLoginPrompt} onLogOut={this.props.onLogOut}/>
            </nav>
        );
    }
});

var UserLinks = React.createClass({
    mixins: [I18nMixin, LinksMixin],
    handleToMyActivity: function (e) {
        e.preventDefault();
        this.props.onToMyActivity();
    },
    render: function () {
        var loginInfo = this.props.topState.loginInfo,
            shortLangCode = this.props.topState.shortLangCode;
        if (undefined === loginInfo) {
            return (
                <h2 className="user-links"></h2>
            );
        } else {
            var addMessage,
                addUrl,
                myActivityMessage = this.messages.UserLinks.myActivity,
                myActivityUrl = aUrl(util.format("/contributors/%s/activity", loginInfo.id), shortLangCode);
            if (!this.props.phraseData) {
                // viewing list of phrases. show option to add a phrase.
                addMessage = this.messages.UserLinks.addPhrase;
                addUrl = aUrl("/addPhrase");
            } else {
                var phrase = this.props.phraseData.phrase;
                addMessage = this.fmt(this.msg(this.messages.UserLinks.addDefinition), {phrase: phrase});
                addUrl = aUrl("/addDefinition?phrase="+phrase);
            }
            return (
                <h2 className="user-links">
                    <a className="oi" data-glyph="person" title={myActivityMessage} href={myActivityUrl} onClick={this.handleToMyActivity}></a>
                    <a className="oi" data-glyph="plus" title={addMessage} href={addUrl} onClick={this.handleToLink.bind(this, addUrl)}></a>
                </h2>
            );
        }
    }
});

var LoginStatus = React.createClass({
    mixins: [I18nMixin],
    handleClick: function () {
        this.props.onToggleLoginPrompt();
    },
    handleLogOut: function (e) {
        e.preventDefault();
        /*this.setState({
            doLogOut: true
        });*/
        this.props.onLogOut();
    },
    render: function () {
        //this.loadMessages();
        var loginInfo = this.props.topState.loginInfo,
            shortLangCode = this.props.topState.shortLangCode;
        console.log("loginInfo...: " + JSON.stringify(loginInfo, ' ', 4));
        if (undefined === loginInfo) {
            var greeting = this.messages.LoginStatus.notLoggedInGreeting,
                loginUrl = aUrl("/login", shortLangCode);
            return (
                <h2 className="login-info"><a className="oi" data-glyph="account-login" title={greeting} href={aUrl("/login", shortLangCode)} onClick={this.handleClick}></a></h2>
            );
        } else {
            var //greeting = this.fmt(this.msg(this.messages.LoginStatus.loggedInGreeting), {username: loginInfo.email}),
                logOutMessage = this.fmt(this.msg(this.messages.LoginStatus.logOutMessage)),
                logOutUrl = aUrl("/logout", shortLangCode),
                addMessage,
                addUrl;
            return (
                <h2 className="login-info">
                    <a className="oi" data-glyph="account-logout" title={logOutMessage} href={logOutUrl} onClick={this.handleLogOut}></a>
                </h2>
            );
        }
    }
});

var LoginPrompt = React.createClass({
    mixins: [I18nMixin],
    handleLogIn: function (e) {
        var username = this.refs.username.getDOMNode().value,
            password = this.refs.password.getDOMNode().value;
        e.preventDefault();
        this.props.onLogIn(username, password);
    },
    render: function () {
        var display = this.props.topState.showLoginPrompt ? "block" : "none",
            style = {display: display},
            messages = this.messages.LoginPrompt;
        return (
            <div>
                <form onSubmit={this.handleLogIn}>
                    <fieldset>
                        <legend>{messages.loginFormTitle}</legend>
                        <p>{messages.loginFormDescription}</p>
                        <label className="username">
                            {messages.usernameFieldLabel}
                            <input ref="username" type="text" placeholder={messages.usernameFieldPlaceholder}/>
                        </label>
                        <label className="password">
                            {messages.passwordFieldLabel}
                            <input ref="password" type="password" placeholder={messages.passwordFieldPlaceholder}/>
                        </label>
                        <label className="submit">
                            {messages.submitButtonLabel}
                            <input type="submit" value={messages.submitButtonValue}/>
                        </label>
                    </fieldset>
                </form>
                <SignupForm topState={this.props.topState} onSignup={this.props.onSignup} onSetInfo={this.props.onSetInfo} onClearInfo={this.props.onClearInfo}/>
            </div>
        );
    }
});

var LogOutOutcome = React.createClass({
    mixins: [I18nMixin],
    componentWillMount: function () {
        var doLogOut = this.props.doLogOut;

        doLogOut();
    },
    render: function () {
        var m = this.messages.LogOutOutcome;
        return <div>{m.willLogYouOutShortly}</div>;
    }
});

var SignupForm = React.createClass({
    mixins: [I18nMixin, LifecycleDebug({displayName: 'SignupForm'})],
    componentDidMount: function () {
        console.log("SignupForm componentDidMount");
        if (this.props.topState.contributorAccountCreated) {
            console.log("yes?");
            this.props.onSetInfo(<span>{this.messages.SignupForm.signupSuccess}</span>, function () {
                Router.navigate('login?update='+Date.now(), {trigger: true, replace: false});
            });
        }
    },
    componentWillUpdate: function (nextProps) {
        if (!nextProps.topState.contributorAccountCreated && this.props.topState.contributorAccountCreated) {
            this.props.onClearInfo();
        }
    },
    getDefaultState: function () {
        // not to be confused with getInitialState() :-)
        var messages = this.messages;
        return {
            errors: {
                globalError: false,
                email: false,
                passhash: false,
                nickname: false,
                first_name: false,
                last_name: false
            },
            titles: {
                globalError: "",
                email: "",
                passhash: "",
                nickname: "",
                first_name: "",
                last_name: ""
            },
            placeholders: {
                email: messages.SignupForm.usernameFieldPlaceholder,
                passhash: messages.SignupForm.passwordFieldPlaceholder,
                nickname: messages.SignupForm.nicknameFieldPlaceholder,
                first_name: messages.SignupForm.firstNameFieldPlaceholder,
                last_name: messages.SignupForm.lastNameFieldPlaceholder
            },
            labels: {
                email: messages.SignupForm.usernameFieldLabel,
                passhash: messages.SignupForm.passwordFieldLabel,
                nickname: messages.SignupForm.nicknameFieldLabel,
                first_name: messages.SignupForm.firstNameFieldLabel,
                last_name: messages.SignupForm.lastNameFieldLabel
            }
        };
    },
    componentWillMount: function () {
        var messages = this.messages;
        this.setState(this.getDefaultState());
    },
    handleSignup: function (e) {
        var email = this.refs.email.getDOMNode().value,
            passhash = this.refs.passhash.getDOMNode().value,
            nickname = this.refs.nickname.getDOMNode().value,
            first_name = this.refs.first_name.getDOMNode().value,
            last_name = this.refs.last_name.getDOMNode().value;
        e.preventDefault();
        Q(this.props.onSignup({
            first_name: first_name,
            last_name: last_name,
            email: email,
            passhash: passhash,
            nickname: nickname
        }))
            .fail(function (err) {
                var newState = this.getDefaultState(),
                    errors = newState.errors;
                errors.globalError = this.messages.Errors.validationError;
                _.forEach(err.fields, function (condition, fieldName) {
                    if ('duplicate' === condition) {
                        errors[fieldName] = this.messages.Errors.duplicateField;
                    } else if ('missing' === condition) {
                        errors[fieldName] = this.messages.Errors.missingField;
                    } else if ('invalid' === condition) {
                        errors[fieldName] = this.messages.Errors.invalidField;
                    } else {
                        errors[fieldName] = condition;
                    }
                }.bind(this));
                this.setState(newState);
            }.bind(this));
    },
    render: function () {
        var messages = this.messages.SignupForm,
            cx = React.addons.classSet,
            classNames = {
                globalError: cx({global: true, error: true, hidden: !this.state.errors.globalError}),
                email: cx({error: this.state.errors.email}),
                passhash: cx({error: this.state.errors.passhash}),
                nickname: cx({error: this.state.errors.nickname}),
                first_name: cx({error: this.state.errors.first_name}),
                last_name: cx({error: this.state.errors.last_name})
            },
            titles = {
                email: this.state.errors.email || "",
                passhash: this.state.errors.passhash || "",
                nickname: this.state.errors.nickname || "",
                first_name: this.state.errors.first_name || "",
                last_name: this.state.errors.last_name || ""
            },
            placeholders = {
                email: (!this.state.errors.email && this.state.placeholders.email) || this.state.errors.email,
                passhash: (!this.state.errors.passhash && this.state.placeholders.passhash) || this.state.errors.passhash,
                nickname: (!this.state.errors.nickname && this.state.placeholders.nickname) || this.state.errors.nickname,
                first_name: (!this.state.errors.first_name && this.state.placeholders.first_name) || this.state.errors.first_name,
                last_name: (!this.state.errors.last_name && this.state.placeholders.last_name) || this.state.errors.last_name
            },
            labels = {
                email: (!this.state.errors.email && this.state.labels.email) || "* " + this.state.labels.email,
                passhash: (!this.state.errors.passhash && this.state.labels.passhash) || "* " + this.state.labels.passhash,
                nickname: (!this.state.errors.nickname && this.state.labels.nickname) || "* " + this.state.labels.nickname,
                first_name: (!this.state.errors.first_name && this.state.labels.first_name) || "* " + this.state.labels.first_name,
                last_name: (!this.state.errors.last_name && this.state.labels.last_name) || "* " + this.state.labels.last_name
            };
        console.log("errors: " + JSON.stringify(this.state.errors));
        console.log("classNames: " + JSON.stringify(classNames));
        console.log("labels: " + JSON.stringify(labels));
        return (
            <div>
                <form onSubmit={this.handleSignup}>
                    <fieldset>
                        <legend>{messages.formTitle}</legend>
                        <p className={classNames.globalError} ref="globalError">{this.state.errors.globalError}</p>
                        <p>{messages.formDescription}</p>
                        <label className="username">
                            {labels.email}
                            <input className={classNames.email} title={titles.email} ref="email" type="text" placeholder={placeholders.email}/>
                        </label>
                        <label className="password">
                            {labels.passhash}
                            <input className={classNames.passhash} title={titles.passhash} ref="passhash" type="password" placeholder={placeholders.passhash}/>
                        </label>
                        <label className="nickname">
                            {labels.nickname}
                            <input className={classNames.nickname} title={titles.nickname} ref="nickname" type="text" placeholder={placeholders.nickname}/>
                        </label>
                        <label className="firstName">
                            {labels.first_name}
                            <input className={classNames.first_name} title={titles.first_name} ref="first_name" type="text" placeholder={placeholders.first_name}/>
                        </label>
                        <label className="lastName">
                            {labels.last_name}
                            <input className={classNames.last_name} title={titles.last_name} ref="last_name" type="text" placeholder={placeholders.last_name}/>
                        </label>
                        <label className="submit">
                            {messages.submitButtonLabel}
                            <input type="submit" value={messages.submitButtonValue}/>
                        </label>
                    </fieldset>
                </form>
            </div>
        );
    },
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
        getPhraseSearchReactState({lang: lang, shortLangCode: this.state.shortLangCode, term: term, pageSize: PHRASES_PAGE_SIZE, page: page})
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
                <PhraseSearchResult searchResult={result} key={result.key} onSelectPhrase={this.props.onSelectPhrase} topState={this.props.topState}/>
            );
        }).bind(this));
        var infiniteScroll = <InfiniteScroll
                loader={<div className="loader">loading...</div>}
                loadMore={this.loadMore}
                hasMore={this.state.hasMore}
                resetPageStart={this.state.resetPageStart}
            >
                {phraseSearchResults}
            </InfiniteScroll>
        return (
            <main>
                <TopSearchCaption topState={this.state}/>
                <ul className="phraseSearchResultsList">
                    {infiniteScroll}
                </ul>
            </main>
        );
    }
});

var ContributorActivity = React.createClass({
    mixins: [LifecycleDebug({displayName: 'ContributorActivity'})],
    hasMore: function (state) {
        return state.contributorActivity.phrases.length >= PHRASES_PAGE_SIZE ||
            state.contributorActivity.definitions.length >= PHRASES_PAGE_SIZE ||
            state.contributorActivity.votes.length >= PHRASES_PAGE_SIZE;
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
        var start = (page * PHRASES_PAGE_SIZE),
            lang = this.props.topState.globalLang,
            shortLangCode = this.props.topState.shortLangCode,
            contributor_id = this.props.topState.loginInfo.id;
        console.log('load');
        getContributorActivityReactState({lang: lang, shortLangCode: shortLangCode, contributor_id: contributor_id, pageSize: PHRASES_PAGE_SIZE, page: page})
            .then(function (reactState) {
                var newContributorActivity = {
                    phrases: _.union(this.state.contributorActivity.phrases, reactState.contributorActivity.phrases),
                    definitions: _.union(this.state.contributorActivity.definitions, reactState.contributorActivity.definitions),
                    votes: _.union(this.state.contributorActivity.votes, reactState.contributorActivity.votes)
                };
                this.setState({
                    contributorActivity: newContributorActivity,
                    hasMore: this.hasMore(reactState),
                    resetPageStart: false
                });
            }.bind(this));
    },
    render: function () {
        console.log("rendering ContributorActivity, the state is: " + JSON.stringify(this.state));
        var activityEntries = [];
        _.forEach(['phrases', 'definitions', 'votes'], function (activityType) {
            _.forEach(this.state.contributorActivity[activityType], (function (activityObject) {
                var key = "activity_type:" + activityType +
                    "phrase_id:" + activityObject.phrase_id +
                    "definition_id:" + activityObject.definition_id +
                    "vote_id:" + activityObject.vote_id;
                activityObject.activityType = activityType;
                activityEntries.push(
                    <ContributorActivityItem topState={this.props.topState} activityObject={activityObject} onClickActivityItem={this.props.onClickActivityItem} key={key}/>
                );
            }).bind(this));
        }.bind(this));
        var infiniteScroll = <InfiniteScroll
                loader={<div className="loader">loading...</div>}
                loadMore={this.loadMore}
                hasMore={this.state.hasMore}
                resetPageStart={this.state.resetPageStart}
            >
                {activityEntries}
            </InfiniteScroll>
        return (
            <div>
                <div className="contributorActivity">
                    {infiniteScroll}
                </div>
            </div>
        );
    }
});

var ContributorActivityItem = React.createClass({
    mixins: [I18nMixin],
    handleClickActivityItem: function () {
        this.props.onClickActivityItem({phrase: this.props.activityObject.phrase});
    },
    render: function () {
        var phraseId = this.props.activityObject.phrase_id,
            phrase = this.props.activityObject.phrase,
            activityType = this.props.activityObject.activityType,
            vote = this.props.activityObject.vote,
            goToPhraseLinkMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.goToPhraseLink)),
            activityMessage;
        if ('phrases' === activityType) {
            activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.phraseActivityEntry), {phrase: phrase});
        } else if ('definitions' === activityType) {
            activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.definitionActivityEntry), {phrase: phrase});
        } else if ('votes' === activityType) {
            activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.voteActivityEntry), {phrase: phrase, vote: vote});
        }
        return (
            <div className="activity-item {activityType}">
                <div>{activityMessage}</div><div onClick={this.handleClickActivityItem}>{goToPhraseLinkMessage}</div>
            </div>
        );
    }
});

var TopSearchCaption = React.createClass({
    mixins: [I18nMixin],
    render: function () {
        //this.loadMessages();
        var resultsHeading;
        if (this.props.topState.searchTerm) {
            resultsHeading = this.fmt(this.msg(this.messages.TopSearchCaption.showingResultsForSearchTerm), {searchTerm: this.props.topState.searchTerm});
        } else {
            resultsHeading = '';
        }
        return (
            <h2 className="results-heading">{resultsHeading}</h2>
        );
    }
});

var PhraseSearchResult = React.createClass({
    mixins: [I18nMixin],
    render: function () {
        var definitionOrMessage,
            missingDefinitionMessage = this.messages.PhraseSearchResult.missingDefinition;
        if (this.props.searchResult && this.props.searchResult.topDefinition && this.props.searchResult.topDefinition.definition) {
            definitionOrMessage = <DefinitionInList searchResult={this.props.searchResult}/>;
        } else {
            definitionOrMessage = <div className="missing-definition">{missingDefinitionMessage}</div>
        }
        return (
            <dl>
                <PhraseInList searchResult={this.props.searchResult} onSelectPhrase={this.props.onSelectPhrase} topState={this.props.topState}/>
                {definitionOrMessage}
            </dl>
        );
    }
});

var PhraseInList = React.createClass({
    handleClick: function (e) {
        e.preventDefault();
        console.log("clicked on phrase: " + this.props.searchResult.phrase);
        var phraseData = this.props.searchResult;
        this.props.onSelectPhrase(phraseData);
    },
    render: function () {
        var phraseUrl = aUrl(util.format("/phrases/%s", this.props.searchResult.phrase), this.props.topState.shortLangCode);
        return (
            <dt onClick={this.handleClick}>
                <a href={phraseUrl}>{this.props.searchResult.phrase}</a>
            </dt>
        );
    }
});

var DefinitionInList = React.createClass({
    render: function () {
        var definition = this.props.searchResult.topDefinition.definition;
        return (
            <dd>
                <span className="oi" data-glyph="double-quote-serif-left"/>
                    {definition}
                <span className="oi" data-glyph="double-quote-serif-right"/>
            </dd>
        );
    }
});

var AddPhraseForm = React.createClass({
    mixins: [I18nMixin],
    handleSubmit: function (e) {
        var newPhrase = this.refs.newPhrase.getDOMNode().value,
            loginInfo = this.props.topState.loginInfo,
            m = this.messages.AddPhraseForm;
        e.preventDefault();
        if (!loginInfo) {
            //var displayedInfo = this.messages
            this.props.onSetInfo(m.loginRequired);
            return false;
        }
        this.props.onSubmitAddPhrase(newPhrase);
    },
    render: function () {
        //this.loadMessages();
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


module.exports.bs = bs;
module.exports.routesInfo = routesInfo;
module.exports.getNormalizedRouteInfo = getNormalizedRouteInfo;
module.exports.setupRoute = setupRoute;
module.exports.CrowDictionary = CrowDictionary;
module.exports.setInitialState = setInitialState;
module.exports.setPRequest = setPRequest;
module.exports.setBaseRoot = setBaseRoot;
module.exports.setRouter = setRouter;
module.exports.aUrl = aUrl;
module.exports.pCalculateStateBasedOnNormalizedRouteInfo = pCalculateStateBasedOnNormalizedRouteInfo;
module.exports.l10n = {};
module.exports.l10n.getL10nForLang = l10n.getL10nForLang;
