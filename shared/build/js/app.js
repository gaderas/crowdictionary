/** @jsx React.DOM */

var Q = require('q');
var appUtil = require('./util.js');
var React = require('react/addons');
//var ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;
var LifecycleDebug = require('react-lifecycle-debug');
var InfiniteScroll = require('react-infinite-scroll')(React, [LifecycleDebug({displayName: 'InfiniteScroll'})]);
var l10n = require('./l10n.js');
var Intl = global.Intl || require('intl');
//var Intl = {};
var IntlMessageFormat = require('intl-messageformat');
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

var aUrl = appUtil.aUrl;

/**
 * transform a url (no hostname), the kind that we display in anchor tags,
 * into a path string suitable for passing to Router.navigate()
 * (basically, eliminate the 'shortLangCode' path component, if set)
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
                    CrowDictionary( {nRouteInfo:nRouteInfo} ),
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
        .then(function (langInfo) { // we also have langByIp in langInfo, which we can use to tease the user to visit another lang
            return Q.all([l10n.getL10nForLang(langInfo.langByReferrer), l10n.getLocaleEndpointsMap(langInfo.langByReferrer)])
                .spread(function (l10nData, localeEndpointsMap) {
                    return {
                        l10nData: l10nData,
                        localeEndpointsMap: localeEndpointsMap,
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
                    return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
                });
        } else if (nRouteInfo.query && nRouteInfo.query.q) {
            return pL10nForLang
                .then(function (l) {
                    return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap, searchTerm: nRouteInfo.query.q}, nRouteInfo));
                });
        }
    } else if ('/:phrase' === nRouteInfo.route) {
        // "phrase page"
        console.log("nRouteInfo: " + JSON.stringify(nRouteInfo));
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/cp/:alias1/:contributor_id' === nRouteInfo.route) {
        // "contributor activity page"
        console.log("nRouteInfo: " + JSON.stringify(nRouteInfo));
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/o/:alias1' === nRouteInfo.route) {
        // "logout" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/i/:alias1' === nRouteInfo.route) {
        // "login" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/v/:alias1' === nRouteInfo.route) {
        // "login" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/y/:alias1' === nRouteInfo.route) {
        // "add phrase" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/x/:alias1' === nRouteInfo.route) {
        // "add definition" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/l/:alias1' === nRouteInfo.route) {
        // "leaderboard" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/ep/:alias1' === nRouteInfo.route) {
        // "editProfile" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/ipr/:alias1' === nRouteInfo.route) {
        // "initiatePasswordRecovery" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
            });
    } else if ('/pr/:alias1' === nRouteInfo.route) {
        // "passwordRecovery" page
        return pL10nForLang
            .then(function (l) {
                return Q(nRouteInfo.calculateStateFunc({globalLang: l.globalLang, langByIp: l.langByIp, l10nData: l.l10nData, localeEndpointsMap: l.localeEndpointsMap}, nRouteInfo));
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
        localeEndpointsMap = params.localeEndpointsMap,
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
                    localeEndpointsMap: localeEndpointsMap,
                    page: page,
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
        localeEndpointsMap = params.localeEndpointsMap,
        activityUrl = baseRoot + util.format("/v1/contributors/%d/activity?lang=%s&start=%d&limit=%d", contributor_id, lang, start, pageSize),
        shortLangCode = params.shortLangCode;

        return pRequest({url: activityUrl, json: true})
            .then(function (activityRes) {
                if (200 !== activityRes[0].statusCode) {
                    throw Error("couldn't fetch activity");
                }
                var activity = activityRes[1],
                    neededPhraseIds = _.filter(_.map(activity, function (activityItem) {
                        return 'phrase' !== activityItem.type && activityItem.phrase_id;
                    })),
                    phrasesQs = _.map(neededPhraseIds, function (id) {
                        return 'id='+id;
                    }).join('&'),
                    phrasesUrl = baseRoot + util.format("/v1/lang/%s/phrases?%s&start=%d&limit=%d", lang, phrasesQs, 0, pageSize);
                return pRequest({url: phrasesUrl, json: true})
                    .then(function (phrasesRes) {
                        if (200 !== phrasesRes[0].statusCode) {
                            throw Error("couldn't fetch phrases for activity");
                        }
                        var phrases = phrasesRes[1];
                        _.forEach(activity, function (activityItem) {
                            if ('phrase' !== activityItem.type) {
                                activityItem.phrase = _.filter(phrases, {id: activityItem.phrase_id})[0].phrase;
                            } else {
                                activityItem.phrase = activityItem.val;
                            }
                        });
                        return {
                            globalLang: lang,
                            shortLangCode: shortLangCode,
                            l10nData: l10nData,
                            localeEndpointsMap: localeEndpointsMap,
                            contributor_id: contributor_id,
                            contributorActivity: activity
                        };
                    });
            });
};

var getLeaderboardReactState = function (params) {
    var lang = params.lang,
        shortLangCode = params.shortLangCode,
        l10nData = params.l10nData,
        localeEndpointsMap = params.localeEndpointsMap,
        start = params.start,
        limit = PHRASES_PAGE_SIZE,
        leaderboardUrl = baseRoot + util.format("/v1/contributors/leaderboard?start=%d&limit=%d", start, limit),
        reactState = {
            globalLang: lang,
            shortLangCode: shortLangCode,
            l10nData: l10nData,
            localeEndpointsMap: localeEndpointsMap
        };
    return pRequest({url: leaderboardUrl, json: true})
        .then(function (leaderboardRes) {
            var leaderboard,
                shownContributorsIds,
                contributorsQs,
                contributorsUrl;
            if (200 !== leaderboardRes[0].statusCode) {
                throw Error("couldn't fetch leaderboard");
            }
            leaderboard = leaderboardRes[1];
            shownContributorsIds = _.map(leaderboard, function (leader) {
                return leader.contributor_id;
            });
            contributorsQs = _.map(shownContributorsIds, function (id) {
                return 'id=' + id;
            }).join('&');
            contributorsUrl = baseRoot + util.format("/v1/contributors?%s&start=%d&limit=%d", contributorsQs, start, limit);
            return pRequest({url: contributorsUrl, json: true})
                .then(function (contributorsRes) {
                    var contributors;
                    if (200 !== contributorsRes[0].statusCode) {
                        throw Error("couldn't fetch data for contributors in leaderboard");
                    }
                    contributors = contributorsRes[1];
                    _.forEach(leaderboard, function (leader) {
                        leader = _.merge(leader, _.filter(contributors, {id: leader.contributor_id})[0]);
                    });
                    reactState.showLeaderboard = leaderboard;
                    return reactState;
                });
        });
}

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
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                page = nRouteInfo.query.page || 0,
                loginStateUrl = baseRoot + "/v1/login",
                definitionsUrl,
                phrasesUrl;
            return Q.all([
                getPhraseSearchReactState({l10nData: l10nData, localeEndpointsMap: localeEndpointsMap, lang: lang, shortLangCode: nRouteInfo.shortLangCode, term: term, pageSize: PHRASES_PAGE_SIZE, page: page}),
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
        // phrase, was: /phrases/:phrase
        serverRoute: '/:phrase',
        serverParamNames: ['phrase'],
        clientRoute: ':phrase',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/:phrase',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                phrase = (nRouteInfo && nRouteInfo.params && nRouteInfo.params.phrase),
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                phraseUrl = baseRoot + util.format("/v1/lang/%s/phrases/%s", lang, phrase),
                loginStateUrl = baseRoot + "/v1/login",
                shortLangCode = nRouteInfo.shortLangCode;
            if ("string" !== typeof phrase || _.isEmpty(phrase)) {
                throw Error("phrase not provided in URL");
            }
            return Q.all([pRequest({url: phraseUrl, json: true}), pRequest({url: loginStateUrl, json: true})])
                .spread(function (phraseRes, loginStateRes) {
                    if (200 !== phraseRes[0].statusCode) {
                        throw Error("couldn't fetch phrase");
                    }
                    var shownPhraseData = (phraseRes[1].length && phraseRes[1][0]) || null,
                        rObj = phraseRes[1],
                        reactState = {
                            globalLang: lang,
                            shortLangCode: shortLangCode,
                            l10nData: l10nData,
                            localeEndpointsMap: localeEndpointsMap,
                            shownPhraseData: shownPhraseData
                        };

                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                    }

                    // if we don't have a phrase, redirect to addPhrase (when rendering server side)
                    if (!shownPhraseData) {
                        // return here if no phrase data, no point in fetching any definitions
                        var addPhraseUrl = aUrl(localeEndpointsMap.addPhrase.relUrl + "?phrase=" + phrase, shortLangCode);
                        reactState.serverRedirect = {code: 302, location: addPhraseUrl};
                        return reactState;
                    }

                    var phraseIds = [shownPhraseData.id];

                    return pRequest({url: baseRoot + "/v1/definitions?phraseIds=" + phraseIds.join(','), json: true})
                        .then(function (res) {
                            if (200 !== res[0].statusCode) {
                                throw Error("couldn't fetch definitions");
                            }
                            var definitions = res[1],
                                allTags = _.union(_.map(definitions, function (definition) {
                                    return _.map(definition.tags.split(/[,\n]/), function (tag) {
                                        return tag.replace(/(^\s*|\s*$)/, '');
                                    });
                                }))[0],
                                allContributors = _.union([shownPhraseData.contributor_id], _.map(definitions, function (definition) {
                                    return definition.contributor_id;
                                })),
                                tagsQs = _.map(allTags, function (tag) {
                                    return "phrase=" + tag;
                                }).join('&'),
                                contributorsQs = _.map(allContributors, function (contributor_id) {
                                    return "id=" + contributor_id;
                                }).join('&'),
                                getPhrasesUrl = baseRoot + "/v1/lang/"+lang+"/phrases?"+tagsQs,
                                getContributorsUrl = baseRoot + "/v1/contributors?"+contributorsQs;

                            reactState.shownPhraseData.definitions = definitions;
                            console.log("getContributorsUrl: " + getContributorsUrl);
                            return Q.all([pRequest({url: getPhrasesUrl, json: true}), pRequest({url: getContributorsUrl, json: true})])
                                .spread(function (phrasesRes, contributorsRes) {
                                    if (200 !== phrasesRes[0].statusCode) {
                                        console.error("couldn't fetch phrases corresponding to tags... continuing without them");
                                        reactState.shownPhraseData.existingPhraseTags = {};
                                        return reactState;
                                    }
                                    if (200 !== contributorsRes[0].statusCode) {
                                        console.error("couldn't fetch phrase and definitions contributors... fail");
                                        throw Error("couldn't fetch phrase and definitions contributors... fail");
                                    }
                                    reactState.shownPhraseData.existingPhraseTags = _.zipObject(_.map(phrasesRes[1], function (phrase) {
                                        return [phrase.phrase, phrase];
                                    }));
                                    reactState.shownPhraseData.contributorsInfo = _.zipObject(_.map(contributorsRes[1], function (contributorInfo) {
                                        return [contributorInfo.id, contributorInfo];
                                    }));
                                    console.log("we shall return reactState: " + JSON.stringify(reactState));
                                    return reactState;
                                });
                        });
                });
        }
    },
    {
        // contributorProfile, was: contributors/:contributor_id/activity
        serverRoute: '/cp/:alias1/:contributor_id',
        serverParamNames: ['alias1', 'contributor_id'],
        clientRoute: 'cp/:alias1/:contributor_id',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/cp/:alias1/:contributor_id',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                contributor_id = parseInt(nRouteInfo && nRouteInfo.params && nRouteInfo.params.contributor_id, 10),
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                loginStateUrl = baseRoot + "/v1/login",
                shortLangCode = nRouteInfo.shortLangCode;
            if (!contributor_id) {
                throw Error("contributor_id not provided in URL");
            }

            return Q.all([
                getContributorActivityReactState({l10nData: l10nData, localeEndpointsMap: localeEndpointsMap, shortLangCode: shortLangCode, lang: lang, contributor_id: contributor_id, pageSize: PHRASES_PAGE_SIZE, page: 0}),
                pRequest({method: "GET", url: loginStateUrl, json: true})
            ])
                .spread(function (reactState, loginStateRes) {
                    // add login information if we got it
                    if (200 === loginStateRes[0].statusCode) {
                        reactState.loginInfo = loginStateRes[1];
                        if (reactState.loginInfo.id === contributor_id) {
                            // user is viewing his/her own profile, therefore no need to fetch anything else
                            reactState.viewedContributor = reactState.loginInfo;
                            return reactState;
                        }
                    }
                    if (!reactState.viewedContributor) {
                        var getContributorUrl = baseRoot + "/v1/contributors?id="+contributor_id;
                        return pRequest({method: "GET", url: getContributorUrl, json: true})
                            .then(function (contribRes) {
                                if (200 !== contribRes[0].statusCode) {
                                    throw Error("failure when calling api endpoint to fetch user metadata for the requested user");
                                }
                                if (!contribRes[1].length) {
                                    throw Error("got an empty set of user info");
                                }
                                reactState.viewedContributor = contribRes[1][0];
                                return reactState;
                            });
                    }
                    // on failure of any of the promises, return basic state
                    return reactState;
                });
        }
    },
    {
        // logout
        serverRoute: '/o/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'o/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/o/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
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
        // login
        serverRoute: '/i/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'i/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/i/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
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
        // verify
        serverRoute: '/v/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'v/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/v/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
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
        // addPhrase
        serverRoute: '/y/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'y/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/y/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
                    showAddPhrase: nRouteInfo.query.phrase || true
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
        // addDefinition
        serverRoute: '/x/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'x/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/x/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
                    showAddDefinition: false,
                    alreadyAddedDefinition: false
                },
                phrase = nRouteInfo.query.phrase,
                loginStateUrl = baseRoot + "/v1/login",
                phraseUrl = baseRoot + util.format("/v1/lang/%s/phrases/%s", lang, phrase),
                definitionUrl = baseRoot + util.format("/v1/lang/%s/phrases/%s", lang, phrase);
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

                    if (nRouteInfo.query.confirmOverwrite) {
                        reactState.confirmOverwrite = true;
                    }

                    if (200 === loginStateRes[0].statusCode) {
                        // add login information if we got it
                        reactState.loginInfo = loginStateRes[1];
                    } else {
                        // if no login information present, return now
                        return reactState;
                    }

                    var existingDefinitionUrl = baseRoot + util.format("/v1/lang/%s/phrases/%s/definitions?contributor_id=%s", lang, phrase, reactState.loginInfo.id);
                    return pRequest({url: existingDefinitionUrl, json: true})
                        .then(function (definitionsRes) {
                            if (200 !== definitionsRes[0].statusCode) {
                                throw Error("couldn't fetch existing definitions to check if user already has one");
                            }
                            if (definitionsRes[1].length) {
                                reactState.alreadyAddedDefinition = definitionsRes[1][0];
                            }
                            return reactState;
                        });
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
        }
    },
    {
        // leaderboard
        serverRoute: '/l/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'l/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/l/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                loginStateUrl = baseRoot + "/v1/login",
                start = nRouteInfo.query.start || 0,
                limit = PHRASES_PAGE_SIZE,
                leaderboardUrl = baseRoot + util.format("/v1/contributors/leaderboard?start=%d&limit=%d", start, limit);
            
            return Q.all([getLeaderboardReactState({lang: lang, shortLangCode: shortLangCode, l10nData: l10nData, localeEndpointsMap: localeEndpointsMap, start: start}), pRequest({url: loginStateUrl, json: true})])
                .spread(function (reactState, loginStateRes) {
                    if (200 === loginStateRes[0].statusCode) {
                        // add login information if we got it
                        reactState.loginInfo = loginStateRes[1];
                    }
                    return reactState;
                });
            // if above promise fails, return here
            return reactState;
        }
    },
    {
        // editProfile
        serverRoute: '/ep/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'ep/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/ep/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                loginStateUrl = baseRoot + "/v1/login",
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
                    saveSuccess: !!nRouteInfo.query.saveSuccess
                };

            return pRequest({method: "GET", url: loginStateUrl, json: true})
                .then(function (loginStateRes) {
                    // fail if no login information (we *need* it)
                    if (200 !== loginStateRes[0].statusCode) {
                        throw Error("failed fetching login information in order to show edit profile page");
                    }
                    reactState.loginInfo = loginStateRes[1];
                    reactState.editProfile = true;
                    return reactState;
                });
        }
    },
    {
        // initiatePasswordRecovery
        serverRoute: '/ipr/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'ipr/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/ipr/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
                    initiatePasswordRecovery: true,
                    saveSuccess: !!nRouteInfo.query.saveSuccess,
                    qsEmail: nRouteInfo.query.email
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
        // passwordRecovery
        serverRoute: '/pr/:alias1',
        serverParamNames: ['alias1'],
        clientRoute: 'pr/:alias1',
        clientRouterFunc: clientRouterFunc,
        clientRouterFuncName: '/pr/:alias1',
        calculateStateFunc: function (overrides, nRouteInfo) {
            var lang = (overrides && overrides.globalLang) || 'es-MX',
                l10nData = (overrides && overrides.l10nData) || {},
                localeEndpointsMap = (overrides && overrides.localeEndpointsMap) || {},
                shortLangCode = nRouteInfo.shortLangCode,
                reactState = {
                    globalLang: lang,
                    shortLangCode: shortLangCode,
                    l10nData: l10nData,
                    localeEndpointsMap: localeEndpointsMap,
                    passwordRecovery: true,
                    saveSuccess: !!nRouteInfo.query.saveSuccess,
                    qsEmail: nRouteInfo.query.email,
                    qsPasswordResetCode: nRouteInfo.query.password_reset_code
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
        var state = this.getEffectiveState(); // depends on I18nMixin
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

var HashMixin = {
    componentDidMount: function () {
        //if (m = url.match(/(#.*)/)) {
            //window.location.href = m[1];
        //}
        window.location.href = '#main';
    },
};

var ScrollToTopMixin = {
    componentDidMount: function () {
        window.scroll(0, 0);
    },
    componentDidUpdate: function () {
        if (!window.location.search.contains('update')) {
            window.scroll(0, 0);
        }
    }
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


var EndpointsMixin = {
    getEndpoint: function (name, params) {
        var state = this.state || this.props.topState;
        if (!state) {
            throw Error("no state or props.topState to get Endpoints data from");
        }
        console.log("localeEndpointsMap: " + JSON.stringify(state.localeEndpointsMap));
        return this.fmt(this.msg(state.localeEndpointsMap[name].relUrl), params);
    }
};

var LinksMixin = {
    handleToLink: function (url, e) {
        var m;
        if (undefined !== e && e) {
            // since we call this without passing a DOM event in a couple of cases, we don't assume we'll always have it.
            e.preventDefault();
        }
        console.log("gonna navigate to url: " + url);
        Router.navigate(aPath(url), {trigger: true, replace: false});
    }
};


var CrowDictionary = React.createClass({displayName: 'CrowDictionary',
    mixins: [I18nMixin, LoggedInMixin, RouterMixin, CodedMessagesMixin, EndpointsMixin, LinksMixin],
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
                var fragment = aUrl(this.getEndpoint("phrase", {phrase: phrase}) + "?updated=" + Date.now(), this.state.shortLangCode);//"/phrases/"+phrase+"?updated="+Date.now();
                this.handleToLink(fragment);
                //Router.navigate(fragment, {trigger: true, replace: false});
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
                    fragment = aUrl(this.getEndpoint("phrase", {phrase: phrase}) + "?updated=" + Date.now(), this.state.shortLangCode);//"/phrases/"+phrase+"?updated="+Date.now();
                this.handleToLink(fragment);
                //Router.navigate(fragment, {trigger: true, replace: true});
            }).bind(this))
            .fail((function (err) {
                console.error("got an error: " + JSON.stringify(err, ' ', 4));
                this.setState({
                    error: "generic"
                });
            }).bind(this));
    },
    handleSubmitEditProfile: function (onConfirmSuccessCallback, enteredValues) {
        // nickname, first_name, last_name
        /*try {
            this.getLoggedInInfo(true);
        } catch (err) {
            console.error("got an error: " + err);
            this.setState({
                error: "generic"
            });
            return;
        }*/
        var lang = this.state.globalLang,
            crumb = this.state.crumb,
            email = enteredValues.email || (this.state.loginInfo && this.state.loginInfo.email) || "",
            editProfileUrl = baseRoot + "/v1/contributors?email=" + email;
        if (!email) {
            throw Error("no email could be derived from either the form values or the logged in user info");
        }
        return pRequest({method: "PUT", url: editProfileUrl, body: {email: email, nickname: enteredValues.nickname, first_name: enteredValues.first_name, last_name: enteredValues.last_name, initiate_password_recovery: enteredValues.initiate_password_recovery, password_reset_code: enteredValues.password_reset_code, new_password: enteredValues.new_password, new_password_confirm: enteredValues.new_password_confirm, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to save edited profile info");
                }
                var refreshLoginUrl = baseRoot + "/v1/login?refresh=true";
                if (!this.state.loginInfo) {
                    // if not logged in (e.g. password recovery flow), we don't have to "refresh" login info
                    onConfirmSuccessCallback();
                    return;
                }
                return pRequest({method: "GET", url: refreshLoginUrl, json: true})
                    .then(function (refreshLoginRes) {
                        if (200 !== refreshLoginRes[0].statusCode) {
                            throw Error("failed to refresh login cookies after the profile change save");
                        }
                        onConfirmSuccessCallback();
                        /*this.setState({
                            saveSuccess: 1 // need to set the state property here because the router ignores it
                        });*/
                    }.bind(this));
                //Router.navigate(fragment, {trigger: true, replace: true});
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
    handleYesnoYes: function () {
        console.log("user said 'Yes'...");
        if (this.state.yesCallback) {
            this.state.yesCallback();
            // invoke the callback (most likely Router.navigate), and we're done!
            return;
        }
        this.setState({
            yesno: undefined
        });
    },
    handleYesnoNo: function () {
        console.log("user said 'No'...");
        if (this.state.noCallback) {
            this.state.noCallback();
            // invoke the callback (most likely Router.navigate), and we're done!
            return;
        }
        this.setState({
            yesno: undefined
        });
    },
    handleSetYesno: function (yesno, yesCb, noCb) {
        this.setState({
            yesno: yesno,
            yesCallback: yesCb,
            noCallback: noCb
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
        console.log("got a vote: " + JSON.stringify(voteInfo));
        var crumb = this.state.crumb,
            addVoteUrl = util.format(baseRoot + "/v1/definitions/%d/vote", voteInfo.definitionId);
        return pRequest({method: "PUT", url: addVoteUrl, body: {vote: voteInfo.vote, definition_id: voteInfo.definitionId, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to record vote...");
                }
                var fragment = aUrl(this.getEndpoint('phrase', {phrase: voteInfo.phrase}) + "?update=" + Date.now(), this.state.shortLangCode);//"/phrases/"+voteInfo.phrase+"?update="+Date.now();
                this.handleToLink(fragment);
                //Router.navigate(fragment, {trigger: true, replace: true});
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
        var mainContent,
            titleContent = this.messages.Titles.home;
        if (this.state.error) {
            mainContent = ErrorMessage( {onClearError:this.handleClearError, topState:this.state, key:"ErrorMessage"});
        } else if (this.state.info) {
            mainContent = InfoMessage( {onClearInfo:this.handleClearInfo, topState:this.state, key:"InfoMessage"});
        } else if (this.state.yesno) {
            mainContent = YesnoMessage( {onYes:this.handleYesnoYes, onNo:this.handleYesnoNo, topState:this.state, key:"YesnoMessage"});
        } else if (this.state.showLoginPrompt) {
            mainContent = LoginPrompt( {topState:this.state, onLogIn:this.handleLogIn, onSignup:this.handleSignup, onSetInfo:this.handleSetInfo, onClearInfo:this.handleClearInfo, key:"LoginPrompt"});
        } else if (this.state.showVerificationPrompt) {
            // display form where verification code can be entered
            mainContent = VerificationPrompt( {topState:this.state, key:"VerificationPrompt"})
        } else if (this.state.validateVerification) {
            // we got the code. let's check if it's valid and display the result
            mainContent = VerificationOutcome( {topState:this.state, submitVerification:this.submitVerification, key:"VerificationOutcome"})
        } else if (this.state.doLogOut) {
            // log out
            mainContent = LogOutOutcome( {topState:this.state, doLogOut:this.doLogOut, key:"LogOutOutcome"})
        } else if (this.state.shownPhraseData) {
            titleContent = this.fmt(this.msg(this.messages.Titles.phrase), {phrase: this.state.shownPhraseData.phrase});
            mainContent = PhraseDetails( {topState:this.state, onVote:this.handleDefinitionVote, onClosePhraseDetails:this.handleClosePhraseDetails, getSearchTermFromDOM:this.getSearchTermFromDOM, onSetInfo:this.handleSetInfo, key:"PhraseDetails"});
        } else if (!_.isEmpty(this.state.contributorActivity)) {
            titleContent = this.fmt(this.msg(this.messages.Titles.profile), {nickname: this.state.viewedContributor.nickname});
            mainContent = ContributorProfile( {topState:this.state, key:"ContributorActivity"});
        } else if (this.state.showAddPhrase){
            mainContent = AddPhraseForm( {onSubmitAddPhrase:this.handleSubmitAddPhrase, onSetInfo:this.handleSetInfo, topState:this.state, key:"AddPhraseForm"});
        } else if (this.state.showAddDefinition) {
            // showAddDefinition itself is a phrase object. alreadyAddedDefinition is a definition object. confirmOverwrite is a boolean (or undefined)
            mainContent = AddDefinitionForm( {phraseData:this.state.showAddDefinition, topState:this.state, onSubmitAddDefinition:this.handleSubmitAddDefinition, onSetInfo:this.handleSetInfo, setYesno:this.handleSetYesno, key:"AddDefinitionForm"});
        } else if (this.state.editProfile) {
            // editProfile is just a boolean, get contributor data from state.loginInfo
            var formDescription = this.messages.EditProfileForm.formDescription,
                formTitle = this.messages.EditProfileForm.formTitle,
                submitButtonValue = this.messages.EditProfileForm.submitButtonValue,
                onSuccessMessage = this.messages.EditProfileForm.saveSuccess,
                onInitialSuccessCallback = this.handleToLink.bind(this, aUrl(this.getEndpoint("editContributorProfile") + "?saveSuccess=1", this.state.shortLangCode));
                onConfirmSuccessCallback = this.handleToLink.bind(this, aUrl(this.getEndpoint("contributorProfile", {contributor_id: this.state.loginInfo.id}), this.state.shortLangCode));
            mainContent = EditProfileForm( {topState:this.state, formTitle:formTitle, formDescription:formDescription, submitButtonValue:submitButtonValue, submitCallback:this.handleSubmitEditProfile.bind(this, onInitialSuccessCallback), onConfirmSuccessCallback:onConfirmSuccessCallback, successIndicatorPropertyName:"saveSuccess", successMessage:onSuccessMessage, renderedFields:["nickname", "first_name", "last_name"], prepopulatedValues:this.state.loginInfo, onSetInfo:this.handleSetInfo, key:"EditProfileForm"});
        } else if (this.state.initiatePasswordRecovery) {
            // initiatePasswordRecovery is just a boolean, get contributor data from state.loginInfo
            var formDescription = this.messages.InitiatePasswordRecoveryForm.formDescription,
                formTitle = this.messages.InitiatePasswordRecoveryForm.formTitle,
                submitButtonValue = this.messages.InitiatePasswordRecoveryForm.submitButtonValue,
                onSuccessMessage = this.messages.InitiatePasswordRecoveryForm.saveSuccess,
                onInitialSuccessCallback = this.handleToLink.bind(this, aUrl(this.getEndpoint("initiatePasswordRecovery") + "?saveSuccess=1", this.state.shortLangCode));
                onConfirmSuccessCallback = this.handleToLink.bind(this, aUrl(this.getEndpoint("search"), this.state.shortLangCode));
            mainContent = InitiatePasswordRecoveryForm( {topState:this.state, formTitle:formTitle, formDescription:formDescription, submitButtonValue:submitButtonValue, submitCallback:this.handleSubmitEditProfile.bind(this, onInitialSuccessCallback), onConfirmSuccessCallback:onConfirmSuccessCallback, successIndicatorPropertyName:"saveSuccess", successMessage:onSuccessMessage, renderedFields:["email", "initiate_password_recovery"], prepopulatedValues:{email: this.state.qsEmail, initiate_password_recovery: true}, onSetInfo:this.handleSetInfo, key:"InitiatePasswordRecoveryForm"});
        } else if (this.state.passwordRecovery) {
            // passwordRecovery is just a boolean, get contributor data from state.loginInfo
            var formDescription = this.messages.PasswordRecoveryForm.formDescription,
                formTitle = this.messages.PasswordRecoveryForm.formTitle,
                submitButtonValue = this.messages.PasswordRecoveryForm.submitButtonValue,
                onSuccessMessage = this.messages.PasswordRecoveryForm.saveSuccess,
                onInitialSuccessCallback = this.handleToLink.bind(this, aUrl(this.getEndpoint("passwordRecovery") + "?saveSuccess=1", this.state.shortLangCode));
                onConfirmSuccessCallback = this.handleToLink.bind(this, aUrl(this.getEndpoint("login"), this.state.shortLangCode));
            mainContent = PasswordRecoveryForm( {topState:this.state, formTitle:formTitle, formDescription:formDescription, submitButtonValue:submitButtonValue, submitCallback:this.handleSubmitEditProfile.bind(this, onInitialSuccessCallback), onConfirmSuccessCallback:onConfirmSuccessCallback, successIndicatorPropertyName:"saveSuccess", successMessage:onSuccessMessage, renderedFields:["email", "password_reset_code", "new_password", "new_password_confirm"], prepopulatedValues:{email: this.state.qsEmail, password_reset_code: this.state.qsPasswordResetCode}, onSetInfo:this.handleSetInfo, key:"PasswordRecoveryForm"});
        } else if (this.state.showLeaderboard) {
            // showLeaderboard itself is an object containing leaderboard data.
            titleContent = this.messages.Titles.leaderboard;
            mainContent = Leaderboard( {topState:this.state, key:"Leaderboard"});
        } else {
            titleContent = this.state.searchTerm ? this.fmt(this.msg(this.messages.Titles.search), {phrase: this.state.searchTerm}) : titleContent;
            mainContent = PhraseSearchResults( {topState:this.state, onSelectPhrase:this.handleSelectPhrase, onSetInfo:this.handleSetInfo, key:"PhraseSearchResults"});
        }
        var faviconUrl = aUrl("/static/assets/img/mexionario-64x64.png", this.state.shortLangCode);
        return (
            React.DOM.html( {lang:"en-US", dir:"ltr"} , 
            React.DOM.head(null, 
              React.DOM.meta( {charSet:"utf-8"} ),
              React.DOM.meta( {name:"viewport", content:"width=device-width"} ),
              React.DOM.link( {rel:"icon", type:"image/png", href:faviconUrl} ),
              React.DOM.title(null, titleContent),
              React.DOM.script( {src:"/static/js/dep/jquery.js"} ),
              React.DOM.script( {src:"/static/js/dep/underscore.js"} ),
              React.DOM.script( {src:"/static/js/dep/backbone.js"} ),
              React.DOM.link( {href:"/static/css/main.css", rel:"stylesheet"} )
            ),
            React.DOM.body(null, 
            React.DOM.div(null, 
                TopBar( {onUserInput:this.handleUserInput, onGlobalLangChange:this.handleGlobalLangChange, onToggleLoginPrompt:this.handleToggleLoginPrompt, onLogOut:this.handleLogOut, onToMyActivity:this.handleToMyActivity, topState:this.state, ref:"topBar"} ),
                    mainContent
            ),
            React.DOM.footer(null, this.messages.Footer.copyrightNotice),
            React.DOM.script( {src:"/static/js/app.js"} )
            )
            )
        );
    }
});

var VerificationOutcome = React.createClass({displayName: 'VerificationOutcome',
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
        return React.DOM.div(null, "Validating your account...");
    }
});

var VerificationPrompt = React.createClass({displayName: 'VerificationPrompt',
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
            React.DOM.main( {className:"verification-prompt", id:"main"}, 
                React.DOM.form( {onSubmit:this.handleSubmit}, 
                    React.DOM.fieldset(null, 
                        React.DOM.legend(null, messages.formTitle),
                        React.DOM.label(null, 
                            React.DOM.span(null, messages.verificationCodeFieldLabel),
                            React.DOM.input( {type:"text", ref:"validateVerification", placeholder:messages.verificationCodeFieldPlaceholder})
                        ),
                        React.DOM.label(null, 
                            messages.emailFieldLabel,
                            React.DOM.input( {type:"email", ref:"email", placeholder:messages.emailFieldPlaceholder})
                        ),
                        React.DOM.section( {className:"submit"}, 
                            React.DOM.input( {type:"submit", value:messages.submit})
                        )
                    )
                )
            )
        );
    }
});

/**
 * the 'error' property on the state that triggers this is a *code*
 * @TODO refactor this to work like InfoMessage, to take a string and a callback
 */
var ErrorMessage = React.createClass({displayName: 'ErrorMessage',
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
            React.DOM.main( {className:"error-message", id:"main"}, 
                React.DOM.section( {className:"message"}, 
                    React.DOM.div(null, errorMessage)
                ),
                React.DOM.section( {className:"choices"}, 
                    React.DOM.a( {href:"#", onClick:this.handleClearError}, OK)
                )
            )
        );
    }
});

/**
 * the 'info' property on the state that triggers this is a string
 */
var InfoMessage = React.createClass({displayName: 'InfoMessage',
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
            React.DOM.main( {className:"info-message", id:"main"}, 
                React.DOM.section( {className:"message"}, 
                    React.DOM.div(null, message)
                ),
                React.DOM.section( {className:"choices"}, 
                    React.DOM.a( {href:"#", onClick:this.handleClearInfo}, OK)
                )
            )
        );
    }
});

/**
 * the 'yesno' property on the state that triggers this is a string
 */
var YesnoMessage = React.createClass({displayName: 'YesnoMessage',
    mixins: [I18nMixin],
    componentWillMount: function () {
    },
    handleYes: function () {
        this.props.onYes();
    },
    handleNo: function () {
        this.props.onNo();
    },
    render: function () {
        var message = this.props.topState.yesno,
            yes = this.messages.Errors.yes,
            no = this.messages.Errors.no;
        return (
            React.DOM.main( {className:"yesno-message", id:"main"}, 
                React.DOM.section( {className:"message"}, 
                    React.DOM.p(null, message)
                ),
                React.DOM.section( {className:"choices"}, 
                    React.DOM.a( {href:"#", onClick:this.handleYes}, yes),
                    React.DOM.a( {href:"#", onClick:this.handleNo}, no)
                )
            )
        );
    }
});

var PhraseDetails = React.createClass({displayName: 'PhraseDetails',
    mixins: [I18nMixin, ScrollToTopMixin, EndpointsMixin, LinksMixin],
    handleBack: function (e) {
        e.preventDefault();
        this.props.onClosePhraseDetails();
    },
    render: function () {
        var backToSearchResultsCaption = this.fmt(this.msg(this.messages.PhraseDetails.backToSearchResults)),
            shortLangCode = this.props.topState.shortLangCode,
            searchTerm = this.props.getSearchTermFromDOM(),
            searchRelUrl = this.getEndpoint('search'),
            backToSearchResultsRelativeUrl = searchTerm ? searchRelUrl + '?q=' + searchTerm : searchRelUrl,
            backToSearchResultsUrl = aUrl(backToSearchResultsRelativeUrl, shortLangCode);
        return (
            React.DOM.main( {className:"phrase-details", id:"main"}, 
                PhraseInDetails( {topState:this.props.topState} ),
                DefinitionsInDetails( {onVote:this.props.onVote, topState:this.props.topState, onSetInfo:this.props.onSetInfo}),
                React.DOM.div(null, 
                    React.DOM.a( {href:backToSearchResultsUrl, onClick:this.handleToLink.bind(this, backToSearchResultsUrl), className:"back oi", 'data-glyph':"arrow-thick-left"}, backToSearchResultsCaption)
                )
            )
        );
    }
});

var AddDefinitionForm = React.createClass({displayName: 'AddDefinitionForm',
    mixins: [I18nMixin, EndpointsMixin, LinksMixin],
    componentDidMount: function () {
        var phrase = this.props.phraseData.phrase,
            shortLangCode = this.props.topState.shortLangCode;
        if (this.props.topState.alreadyAddedDefinition && !this.props.topState.confirmOverwrite) {
            var confirmUrl = aUrl(this.getEndpoint('addDefinition') + "?phrase=" + phrase + "&confirmOverwrite=true", shortLangCode),
                cancelUrl = aUrl(this.getEndpoint('phrase', {phrase: phrase}), shortLangCode);
            this.props.setYesno(
                this.messages.AddDefinitionForm.confirmOverwrite,
                this.handleToLink.bind(this, confirmUrl),
                this.handleToLink.bind(this, cancelUrl)
            );
        }
    },
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
        var phrase = this.props.phraseData.phrase,
            addDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinition), {phrase: phrase}),
            placeholderDefinition = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionPlaceHolder), {phrase: phrase}),
            placeholderExamples = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionExamplesPlaceHolder), {phrase: phrase}),
            placeholderTags = this.fmt(this.msg(this.messages.AddDefinitionForm.addDefinitionTagsPlaceHolder), {phrase: phrase}),
            submit = this.messages.AddDefinitionForm.submitDefinition,
            definitionLabel = this.messages.AddDefinitionForm.definitionLabel,
            examplesLabel = this.messages.AddDefinitionForm.examplesLabel,
            tagsLabel = this.messages.AddDefinitionForm.tagsLabel,
            myPreviousDefinition = this.props.topState.alreadyAddedDefinition,
            defaultDefinition = (myPreviousDefinition && myPreviousDefinition.definition) || "",
            defaultExamples = (myPreviousDefinition && myPreviousDefinition.examples) || "",
            defaultTags = (myPreviousDefinition && myPreviousDefinition.tags) || "";
console.log("myPreviousDefinition: " + JSON.stringify(myPreviousDefinition));
        return (
            React.DOM.main( {className:"add-definition", id:"main"}, 
                React.DOM.form( {onSubmit:this.handleSubmit}, 
                    React.DOM.h2(null, addDefinition),
                    React.DOM.label(null, 
                        React.DOM.span(null, definitionLabel),
                        React.DOM.textarea( {placeholder:placeholderDefinition, ref:"newDefinition", autoCorrect:"off", autoCapitalize:"none", spellCheck:"false", defaultValue:defaultDefinition})
                    ),
                    React.DOM.label(null, 
                        React.DOM.span(null, examplesLabel),
                        React.DOM.textarea( {placeholder:placeholderExamples, ref:"examples", autoCorrect:"off", autoCapitalize:"none", spellCheck:"false", defaultValue:defaultExamples})
                    ),
                    React.DOM.label(null, 
                        React.DOM.span(null, tagsLabel),
                        React.DOM.textarea( {placeholder:placeholderTags, ref:"tags", autoCorrect:"off", autoCapitalize:"none", spellCheck:"false", defaultValue:defaultTags})
                    ),
                    React.DOM.section( {className:"submit"}, 
                        React.DOM.input( {type:"submit", value:submit})
                    )
                )
            )
        );
    }
});

var PhraseInDetails = React.createClass({displayName: 'PhraseInDetails',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    render: function () {
        var phrase = this.props.topState.shownPhraseData.phrase,
            loginInfo = this.props.topState.loginInfo,
            addDefinitionCaption = this.messages.PhraseInDetails.addDefinitionCaption,
            addUrl = aUrl(this.getEndpoint('addDefinition') + "?phrase=" + phrase, this.props.topState.shortLangCode),
            addDefinitionElem = (loginInfo && React.DOM.p(null, addDefinitionCaption,": ", React.DOM.a( {className:"oi", 'data-glyph':"plus", title:addDefinitionCaption, href:addUrl, onClick:this.handleToLink.bind(this, addUrl)}))) || "";
        return (
            React.DOM.section( {className:"phrase-top"}, 
                React.DOM.h2(null, phrase),
                addDefinitionElem
            )
        );
    }
});

var DefinitionsInDetails = React.createClass({displayName: 'DefinitionsInDetails',
    render: function () {
        var definitionElements = _.map(this.props.topState.shownPhraseData.definitions, (function (definitionData, idx) {
            return (
                DefinitionInDetails( {onVote:this.props.onVote, topState:this.props.topState, onSetInfo:this.props.onSetInfo, key:idx})
            );
        }).bind(this))
        return (
            React.DOM.ul(null, definitionElements)
        );
    }
});

/**
 * thumbs icon "designmodo_linecons_free-like.svg" native dimensions are 32x32,
 * so all svg transformations (e.g.: rotation) have to take this into account.
 */
var DefinitionInDetails = React.createClass({displayName: 'DefinitionInDetails',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    handleVote: function (e) {
        e.preventDefault();
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
        //this.setupThumbsDOM(true);
    },
    componentDidUpdate: function () {
        //this.setupThumbsDOM(false);
    },
    render: function () {
        var userVote = this.getCurrentUserVote(),
            definitionObj = this.props.topState.shownPhraseData.definitions[this.props.key],
            phrase = this.props.topState.shownPhraseData.phrase,
            definition = definitionObj.definition,
            examples = definitionObj.examples,
            tags = _.map(definitionObj.tags.split(/[,\n]/), function (tag, idx) {
                return DefinitionTag( {topState:this.props.topState, tag:tag.replace(/(^\s*|\s*$)/, ''), key:idx})
            }.bind(this)),
            votesUpCount = _.filter(definitionObj.votes, {vote: "up"}).length,
            votesDownCount = _.filter(definitionObj.votes, {vote: "down"}).length,
            thumbsUpMessage = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsUpMessage), {numVotes: votesUpCount}),
            thumbsDownMessage = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsDownMessage), {numVotes: votesDownCount}),
            thumbsUpTitle = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsUpTitle), {currentVote: userVote}),
            thumbsDownTitle = this.fmt(this.msg(this.messages.DefinitionInDetails.thumbsDownTitle), {currentVote: userVote}),
            definitionAbbr = this.messages.Abbreviations.definition,
            exampleAbbr = this.messages.Abbreviations.example,
            tagsCaption = this.messages.DefinitionInDetails.tags,
            byCaption = this.messages.DefinitionInDetails.by,
            authorNick = this.props.topState.shownPhraseData.contributorsInfo[definitionObj.contributor_id].nickname || "??",
            authorProfileUrl = aUrl(this.getEndpoint('contributorProfile', {contributor_id: definitionObj.contributor_id}), this.props.topState.shortLangCode),
            cx = React.addons.classSet,
            upClasses = ('up' === userVote && cx({up: true, voted: true})) || cx({up: true}),
            downClasses = ('down' === userVote && cx({down: true, voted: true})) || cx({down: true});
        return (
            React.DOM.li(null, 
                React.DOM.dl(null, 
                    React.DOM.dt(null, phrase),
                    React.DOM.dd( {className:"definition"}, 
                        React.DOM.span( {className:"abbr"}, definitionAbbr),
                        definition
                    ),
                    React.DOM.dd( {className:"examples"}, 
                        React.DOM.span( {className:"abbr"}, exampleAbbr),
                        React.DOM.span( {className:"oi", 'data-glyph':"double-quote-serif-left"}),
                            examples,
                        React.DOM.span( {className:"oi", 'data-glyph':"double-quote-serif-right"})
                    ),
                    React.DOM.dd( {className:"tags"}, React.DOM.span(null, tagsCaption),React.DOM.ul(null, tags))
                ),
                React.DOM.div( {className:"author"}, 
                    React.DOM.span( {className:"by"}, byCaption, " ", React.DOM.a( {href:authorProfileUrl, onClick:this.handleToLink.bind(this, authorProfileUrl)}, authorNick))
                ),
                React.DOM.div( {className:"votes"}, 
                    React.DOM.div( {className:upClasses}, 
                        React.DOM.a( {className:"up oi", href:"#", 'data-glyph':"thumb-up", title:thumbsUpTitle, onClick:this.handleVote}),
                        React.DOM.p(null, thumbsUpMessage)
                    ),
                    React.DOM.div( {className:downClasses}, 
                        React.DOM.a( {className:"down oi", href:"#", 'data-glyph':"thumb-down", title:thumbsDownTitle, onClick:this.handleVote}),
                        React.DOM.p(null, thumbsDownMessage)
                    )
                )
            )
        );
    }
});

var DefinitionTag = React.createClass({displayName: 'DefinitionTag',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    render: function () {
        var tag = this.props.tag,
            existingPhraseTag = this.props.topState.shownPhraseData.existingPhraseTags[tag],
            phraseUrl = existingPhraseTag && aUrl(this.getEndpoint('phrase', {phrase: tag}), this.props.topState.shortLangCode),
            loginInfo = this.props.topState.loginInfo;
            
        if (phraseUrl) {
            return (
                React.DOM.li( {className:"exists"}, React.DOM.a( {className:"tag", href:phraseUrl, onClick:this.handleToLink.bind(this, phraseUrl)}, tag))
            );
        } else if (loginInfo) {
            phraseUrl = aUrl(this.getEndpoint("addPhrase") + "?phrase=" + tag);
            return (
                React.DOM.li( {className:"not-exists"}, React.DOM.a( {className:"tag", href:phraseUrl, onClick:this.handleToLink.bind(this, phraseUrl)}, tag))
            );
        }
        return (
            React.DOM.li(null, React.DOM.span( {className:"tag"}, tag))
        );
    }
});


var TopBar = React.createClass({displayName: 'TopBar',
    getSearchTerm: function () {
        return (this.refs.searchBar && this.refs.searchBar.getSearchTerm()) || "";
    },
    render: function () {
        return (
            React.DOM.header( {className:"TopBar"}, 
                NavBar( {onGlobalLangChange:this.props.onGlobalLangChange, onToggleLoginPrompt:this.props.onToggleLoginPrompt, onLogOut:this.props.onLogOut, topState:this.props.topState, onToMyActivity:this.props.onToMyActivity} ),
                SearchBar( {onUserInput:this.props.onUserInput, topState:this.props.topState, ref:"searchBar"} )
            )
        );
    }
});

var SearchBar = React.createClass({displayName: 'SearchBar',
    mixins: [I18nMixin, LinksMixin],
    getSearchTerm: function () {
        try {
            // React quirk: this throws when called on the server side, so we try/catch it...
            return (this.refs.searchInput && this.refs.searchInput.getDOMNode() && this.refs.searchInput.getDOMNode().value) || "";
        } catch (err) {
            console.log("caught: " + err + "... returning '' (empty string)");
            return "";
        }
    },
    handleSubmit: function (e) {
        var url = aUrl("/?q=" + this.refs.searchInput.getDOMNode().value, this.props.topState.shortLangCode);
        this.refs.searchInput.getDOMNode().blur();
        e.preventDefault();
        this.handleToLink(url, e);
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
        var placeholder = this.fmt(this.msg(this.messages.SearchBar.placeHolder)),
            value = this.props.topState.searchTerm || "",
            formActionUrl = aUrl("/", this.props.topState.shortLangCode);
        return (
            React.DOM.section( {className:"SearchBar", id:"searchbar"}, 
            React.DOM.form( {action:formActionUrl, onSubmit:this.handleSubmit, className:"SearchBar oi", 'data-glyph':"magnifying-glass"}, 
            React.DOM.input( {type:"search", defaultValue:value, placeholder:placeholder, ref:"searchInput"})
            )
            )
        );
    }
});

var NavBar = React.createClass({displayName: 'NavBar',
    mixins: [I18nMixin, LinksMixin],
    render: function () {
        //this.loadMessages();
        var home = this.fmt(this.msg(this.messages.NavBar.home)),
            about = this.fmt(this.msg(this.messages.NavBar.about)),
            jobs = this.fmt(this.msg(this.messages.NavBar.jobs)),
            homeUrl = aUrl("/", this.props.topState.shortLangCode);
        return (
            React.DOM.nav( {className:"NavBar"}, 
                React.DOM.h2( {className:"home"}, React.DOM.a( {className:"oi", 'data-glyph':"home", title:home, onClick:this.handleToLink.bind(this, homeUrl), href:homeUrl})),
                UserLinks( {phraseData:this.props.topState.shownPhraseData, topState:this.props.topState, onToMyActivity:this.props.onToMyActivity}),
                LoginStatus( {topState:this.props.topState, onToggleLoginPrompt:this.props.onToggleLoginPrompt, onLogOut:this.props.onLogOut})
            )
        );
    }
});

var UserLinks = React.createClass({displayName: 'UserLinks',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    handleToMyActivity: function (e) {
        e.preventDefault();
        this.props.onToMyActivity();
    },
    render: function () {
        var loginInfo = this.props.topState.loginInfo,
            shortLangCode = this.props.topState.shortLangCode;
        if (undefined === loginInfo) {
            return (
                React.DOM.h2( {className:"user-links"})
            );
        } else {
            var addMessage,
                addUrl,
                myActivityMessage = this.messages.UserLinks.myActivity,
                myActivityUrl = aUrl(this.getEndpoint('contributorProfile', {contributor_id: loginInfo.id}), shortLangCode),
                leaderboardMessage = this.messages.UserLinks.leaderboard,
                leaderboardUrl = aUrl(this.getEndpoint('leaderboard'), shortLangCode);
            if (!this.props.phraseData) {
                // viewing list of phrases. show option to add a phrase.
                addMessage = this.messages.UserLinks.addPhrase;
                addUrl = aUrl(this.getEndpoint('addPhrase'));
            } else {
                var phrase = this.props.phraseData.phrase;
                addMessage = this.fmt(this.msg(this.messages.UserLinks.addDefinition), {phrase: phrase});
                addUrl = aUrl(this.getEndpoint('addDefinition') + "?phrase="+phrase);
            }
            return (
                React.DOM.h2( {className:"user-links"}, 
                    React.DOM.a( {className:"oi", 'data-glyph':"person", title:myActivityMessage, href:myActivityUrl, onClick:this.handleToLink.bind(this, myActivityUrl)}),
                    React.DOM.a( {className:"oi", 'data-glyph':"people", title:leaderboardMessage, href:leaderboardUrl, onClick:this.handleToLink.bind(this, leaderboardUrl)}),
                    React.DOM.a( {className:"oi", 'data-glyph':"plus", title:addMessage, href:addUrl, onClick:this.handleToLink.bind(this, addUrl)})
                )
            );
        }
    }
});

var LoginStatus = React.createClass({displayName: 'LoginStatus',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
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
                loginUrl = aUrl(this.getEndpoint('login'), shortLangCode);
            return (
                React.DOM.h2( {className:"login-info"}, React.DOM.a( {className:"oi", 'data-glyph':"account-login", title:greeting, href:loginUrl, onClick:this.handleToLink.bind(this, loginUrl)}))
            );
        } else {
            var //greeting = this.fmt(this.msg(this.messages.LoginStatus.loggedInGreeting), {username: loginInfo.email}),
                logOutMessage = this.fmt(this.msg(this.messages.LoginStatus.logOutMessage)),
                logOutUrl = aUrl(this.getEndpoint('logout'), shortLangCode),
                addMessage,
                addUrl;
            return (
                React.DOM.h2( {className:"login-info"}, 
                    React.DOM.a( {className:"oi", 'data-glyph':"account-logout", title:logOutMessage, href:logOutUrl, onClick:this.handleToLink.bind(this, logOutUrl)})
                )
            );
        }
    }
});

var LoginPrompt = React.createClass({displayName: 'LoginPrompt',
    mixins: [I18nMixin, EndpointsMixin],
    handleLogIn: function (e) {
        var username = this.refs.username.getDOMNode().value,
            password = this.refs.password.getDOMNode().value;
        e.preventDefault();
        this.props.onLogIn(username, password);
    },
    render: function () {
        var forgotPasswordUrl = aUrl(this.getEndpoint('initiatePasswordRecovery'), this.props.topState.shortLangCode),
            display = this.props.topState.showLoginPrompt ? "block" : "none",
            style = {display: display},
            messages = this.messages.LoginPrompt;
        return (
            React.DOM.main( {className:"login", id:"main"}, 
                React.DOM.form( {className:"login", onSubmit:this.handleLogIn}, 
                    React.DOM.fieldset(null, 
                        React.DOM.legend(null, messages.loginFormTitle),
                        React.DOM.p(null, messages.loginFormDescription),
                        React.DOM.label( {className:"username"}, 
                            messages.usernameFieldLabel,
                            React.DOM.input( {ref:"username", type:"email", placeholder:messages.usernameFieldPlaceholder})
                        ),
                        React.DOM.label( {className:"password"}, 
                            messages.passwordFieldLabel,
                            React.DOM.input( {ref:"password", type:"password", placeholder:messages.passwordFieldPlaceholder})
                        ),
                        React.DOM.label( {className:"submit"}, 
                            messages.submitButtonLabel,
                            React.DOM.input( {type:"submit", value:messages.submitButtonValue})
                        ),
                        React.DOM.section( {className:"forgotPassword"}, 
                            React.DOM.a( {href:forgotPasswordUrl}, messages.forgotPassword)
                        )
                    )
                ),
                SignupForm( {topState:this.props.topState, onSignup:this.props.onSignup, onSetInfo:this.props.onSetInfo, onClearInfo:this.props.onClearInfo})
            )
        );
    }
});

var LogOutOutcome = React.createClass({displayName: 'LogOutOutcome',
    mixins: [I18nMixin],
    componentWillMount: function () {
        var doLogOut = this.props.doLogOut;

        doLogOut();
    },
    render: function () {
        var m = this.messages.LogOutOutcome;
        return React.DOM.div(null, m.willLogYouOutShortly);
    }
});

var SignupForm = React.createClass({displayName: 'SignupForm',
    mixins: [I18nMixin, EndpointsMixin, LinksMixin, LifecycleDebug({displayName: 'SignupForm'})],
    componentDidMount: function () {
        console.log("SignupForm componentDidMount");
        if (this.props.topState.contributorAccountCreated) {
            var loginUrl = aUrl(this.getEndpoint("login") + "?update=" + Date.now(), this.props.topState.shortLangCode);
            this.props.onSetInfo(
                React.DOM.span(null, this.messages.SignupForm.signupSuccess),
                this.handleToLink.bind(this, loginUrl)
            );
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
            nickname: nickname,
            preferred_langs: this.props.topState.globalLang
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
            React.DOM.form( {className:"signup", onSubmit:this.handleSignup}, 
                React.DOM.fieldset(null, 
                    React.DOM.legend(null, messages.formTitle),
                    React.DOM.p( {className:classNames.globalError, ref:"globalError"}, this.state.errors.globalError),
                    React.DOM.p(null, messages.formDescription),
                    React.DOM.label( {className:"username"}, 
                        labels.email,
                        React.DOM.input( {className:classNames.email, title:titles.email, ref:"email", type:"email", placeholder:placeholders.email})
                    ),
                    React.DOM.label( {className:"password"}, 
                        labels.passhash,
                        React.DOM.input( {className:classNames.passhash, title:titles.passhash, ref:"passhash", type:"password", placeholder:placeholders.passhash})
                    ),
                    React.DOM.label( {className:"nickname"}, 
                        labels.nickname,
                        React.DOM.input( {className:classNames.nickname, title:titles.nickname, ref:"nickname", type:"text", placeholder:placeholders.nickname, autoCorrect:"off", autoCapitalize:"none", spellCheck:"false"})
                    ),
                    React.DOM.label( {className:"firstName"}, 
                        labels.first_name,
                        React.DOM.input( {className:classNames.first_name, title:titles.first_name, ref:"first_name", type:"text", placeholder:placeholders.first_name, autoCorrect:"off", spellCheck:"false"})
                    ),
                    React.DOM.label( {className:"lastName"}, 
                        labels.last_name,
                        React.DOM.input( {className:classNames.last_name, title:titles.last_name, ref:"last_name", type:"text", placeholder:placeholders.last_name, autoCorrect:"off", spellCheck:"false"})
                    ),
                    React.DOM.label( {className:"submit"}, 
                        messages.submitButtonLabel,
                        React.DOM.input( {type:"submit", value:messages.submitButtonValue})
                    )
                )
            )
        );
    },
});

var PromptsMixin = {
    getInitialState: function() {
        return this.props.topState;
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
            showPrompt: true,
            info: info,
            clearInfoCallback: cb
        });
    },
    handleYesnoYes: function () {
        console.log("user said 'Yes'...");
        if (this.state.yesCallback) {
            this.state.yesCallback();
            // invoke the callback (most likely Router.navigate), and we're done!
            return;
        }
        this.setState({
            yesno: undefined
        });
    },
    handleYesnoNo: function () {
        console.log("user said 'No'...");
        if (this.state.noCallback) {
            this.state.noCallback();
            // invoke the callback (most likely Router.navigate), and we're done!
            return;
        }
        this.setState({
            yesno: undefined
        });
    },
    handleSetYesno: function (yesno, yesCb, noCb) {
        this.setState({
            yesno: yesno,
            yesCallback: yesCb,
            noCallback: noCb
        });
    },
    getPromptElements: function () {
        var mainContent,
            state = this.state;
        if (this.state.error) {
            mainContent = ErrorMessage( {onClearError:this.handleClearError, topState:state, key:"ErrorMessage"});
        } else if (this.state.info) {
            mainContent = InfoMessage( {onClearInfo:this.handleClearInfo, topState:state, key:"InfoMessage"});
        } else if (this.state.yesno) {
            mainContent = YesnoMessage( {onYes:this.handleYesnoYes, onNo:this.handleYesnoNo, topState:state, key:"YesnoMessage"});
        }
        return mainContent;
    }
};

// args: formDescription, submitCallback, onConfirmSuccessCallback, successIndicatorPropertyName, successMessage, renderedFields, prepopulatedValues
var ProfileFormMixin = {
    mixins: [I18nMixin, EndpointsMixin, LinksMixin, PromptsMixin, LifecycleDebug({displayName: 'ProfileFormMixin'})],
    componentWillMount: function () {
        this.setState(this.getDefaultState());
    },
    componentDidMount: function () {
        console.log("componentDidMount");
        var onConfirmSuccessCallback = this.props.onConfirmSuccessCallback,
            successIndicatorPropertyName = this.props.successIndicatorPropertyName,
            successMessage = this.props.successMessage;
        if (this.props.topState[successIndicatorPropertyName]) {
            //var profileUrl = aUrl(this.getEndpoint("contributorProfile", {contributor_id: this.props.topState.loginInfo.id}) + "?update=" + Date.now(), this.props.topState.shortLangCode);
            this.props.onSetInfo(
                React.DOM.span(null, successMessage),
                onConfirmSuccessCallback
                //<span>{this.messages.SignupForm.editSuccess}</span>,
                //this.handleToLink.bind(this, profileUrl)
            );
        }
    },
    componentWillReceiveProps: function (nextProps) {
        var onConfirmSuccessCallback = this.props.onConfirmSuccessCallback,
            successIndicatorPropertyName = this.props.successIndicatorPropertyName,
            successMessage = this.props.successMessage;
        console.log("old success indicator: " + this.props.topState[successIndicatorPropertyName]);
        console.log("next success indicator: " + nextProps.topState[successIndicatorPropertyName]);
        if (nextProps.topState[successIndicatorPropertyName]) {
            this.handleSetInfo(
                React.DOM.span(null, successMessage),
                onConfirmSuccessCallback
                //<span>{this.messages.SignupForm.editSuccess}</span>,
                //this.handleToLink.bind(this, profileUrl)
            );
        }
        /*if (!nextProps.topState[successIndicatorPropertyName] && this.props.topState[successIndicatorPropertyName]) {
            this.props.onClearInfo();
        }*/
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
                last_name: false,
                initiate_password_recovery: false,
                password_reset_code: false,
                new_password: false,
                new_password_confirm: false
            },
            titles: {
                globalError: "",
                email: "",
                passhash: "",
                nickname: "",
                first_name: "",
                last_name: "",
                initiate_password_recovery: "",
                password_reset_code: "",
                new_password: "",
                new_password_confirm: ""
            },
            placeholders: {
                email: messages.SignupForm.usernameFieldPlaceholder,
                passhash: messages.SignupForm.passwordFieldPlaceholder,
                nickname: messages.SignupForm.nicknameFieldPlaceholder,
                first_name: messages.SignupForm.firstNameFieldPlaceholder,
                last_name: messages.SignupForm.lastNameFieldPlaceholder,
                initiate_password_recovery: "",
                password_reset_code: messages.SignupForm.passwordResetCodeFieldPlaceholder,
                new_password: messages.SignupForm.newPasswordFieldPlaceholder,
                new_password_confirm: messages.SignupForm.newPasswordConfirmFieldPlaceholder
            },
            labels: {
                email: messages.SignupForm.usernameFieldLabel,
                passhash: messages.SignupForm.passwordFieldLabel,
                nickname: messages.SignupForm.nicknameFieldLabel,
                first_name: messages.SignupForm.firstNameFieldLabel,
                last_name: messages.SignupForm.lastNameFieldLabel,
                initiate_password_recovery: "",
                password_reset_code: messages.SignupForm.passwordResetCodeFieldLabel,
                new_password: messages.SignupForm.newPasswordFieldLabel,
                new_password_confirm: messages.SignupForm.newPasswordConfirmFieldLabel
            }
        };
    },
    handleSubmit: function (e) {
        e.preventDefault();
        var renderedFields = this.props.renderedFields,
            submitCallback = this.props.submitCallback,
            enteredValues = _.zipObject(_.map(renderedFields, function (fieldName) {
                return [fieldName, this.refs[fieldName].getDOMNode().value];
            }.bind(this)));
        console.log("renderedFields: " + JSON.stringify(renderedFields) + ", enteredValues: " + JSON.stringify(enteredValues));
        Q(submitCallback(enteredValues))
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
    getRenderedForm: function () {
        var renderedFields = this.props.renderedFields,
            submitCallback = this.props.submitCallback,
            formTitle = this.props.formTitle,
            formDescription = this.props.formDescription,
            submitButtonValue = this.props.submitButtonValue,
            messages = this.messages.SignupForm,
            cx = React.addons.classSet,
            classNames = {
                globalError: cx({global: true, error: true, hidden: !this.state.errors.globalError}),
                email: cx({error: this.state.errors.email}),
                passhash: cx({error: this.state.errors.passhash}),
                nickname: cx({error: this.state.errors.nickname}),
                first_name: cx({error: this.state.errors.first_name}),
                last_name: cx({error: this.state.errors.last_name}),
                initiate_password_recovery: "",
                password_reset_code: cx({error: this.state.errors.password_reset_code}),
                new_password: cx({error: this.state.errors.new_password}),
                new_password_confirm: cx({error: this.state.errors.new_password_confirm})
            },
            titles = {
                email: this.state.errors.email || "",
                passhash: this.state.errors.passhash || "",
                nickname: this.state.errors.nickname || "",
                first_name: this.state.errors.first_name || "",
                last_name: this.state.errors.last_name || "",
                initiate_password_recovery: "",
                password_reset_code: this.state.errors.password_reset_code || "",
                new_password: this.state.errors.new_password || "",
                new_password_confirm: this.state.errors.new_password_confirm || ""
            },
            placeholders = {
                email: (!this.state.errors.email && this.state.placeholders.email) || this.state.errors.email,
                passhash: (!this.state.errors.passhash && this.state.placeholders.passhash) || this.state.errors.passhash,
                nickname: (!this.state.errors.nickname && this.state.placeholders.nickname) || this.state.errors.nickname,
                first_name: (!this.state.errors.first_name && this.state.placeholders.first_name) || this.state.errors.first_name,
                last_name: (!this.state.errors.last_name && this.state.placeholders.last_name) || this.state.errors.last_name,
                initiate_password_recovery: "",
                password_reset_code: (!this.state.errors.password_reset_code && this.state.placeholders.password_reset_code) || this.state.errors.password_reset_code,
                new_password: (!this.state.errors.new_password && this.state.placeholders.new_password) || this.state.errors.new_password,
                new_password_confirm: (!this.state.errors.new_password_confirm && this.state.placeholders.new_password_confirm) || this.state.errors.new_password_confirm
            },
            labels = {
                email: (!this.state.errors.email && this.state.labels.email) || "* " + this.state.labels.email,
                passhash: (!this.state.errors.passhash && this.state.labels.passhash) || "* " + this.state.labels.passhash,
                nickname: (!this.state.errors.nickname && this.state.labels.nickname) || "* " + this.state.labels.nickname,
                first_name: (!this.state.errors.first_name && this.state.labels.first_name) || "* " + this.state.labels.first_name,
                last_name: (!this.state.errors.last_name && this.state.labels.last_name) || "* " + this.state.labels.last_name,
                initiate_password_recovery: "",
                password_reset_code: (!this.state.errors.password_reset_code && this.state.labels.password_reset_code) || "* " + this.state.labels.password_reset_code,
                new_password: (!this.state.errors.new_password && this.state.labels.new_password) || "* " + this.state.labels.new_password,
                new_password_confirm: (!this.state.errors.new_password_confirm && this.state.labels.new_password_confirm) || "* " + this.state.labels.new_password_confirm
            },
            types = {
                email: 'email',
                passhash: 'password',
                nickname: 'text',
                first_name: 'text',
                last_name: 'text',
                initiate_password_recovery: 'hidden',
                password_reset_code: 'text',
                new_password: 'password',
                new_password_confirm: 'password'
            },
            elements = _.map(renderedFields, function (fieldName) {
                var defaultValue = (this.props.prepopulatedValues && this.props.prepopulatedValues[fieldName]) || "";
                return React.DOM.label( {className:fieldName, key:fieldName}, 
                    labels[fieldName],
                    React.DOM.input( {className:classNames[fieldName], title:titles[fieldName], ref:fieldName, type:types[fieldName], placeholder:placeholders[fieldName], defaultValue:defaultValue})
                );
            }.bind(this));
        console.log("errors: " + JSON.stringify(this.state.errors));
        console.log("classNames: " + JSON.stringify(classNames));
        console.log("labels: " + JSON.stringify(labels));
        if (this.state.showPrompt) {
            return this.getPromptElements();
        }
        return (
            React.DOM.form( {className:"user-form", onSubmit:this.handleSubmit}, 
                React.DOM.fieldset(null, 
                    React.DOM.legend(null, formTitle),
                    React.DOM.p( {className:classNames.globalError, ref:"globalError"}, this.state.errors.globalError),
                    React.DOM.p(null, formDescription),
                    elements,
                    React.DOM.label( {className:"submit"}, 
                        messages.submitButtonLabel,
                        React.DOM.input( {type:"submit", value:submitButtonValue})
                    )
                )
            )
        );
    }
};
var EditProfileForm = React.createClass({displayName: 'EditProfileForm',
    mixins: [ProfileFormMixin, LoggedInMixin],
    componentWillMount: function () {
        try {
            this.getLoggedInInfo(true);
        } catch (err) {
            console.error("got an error: " + err);
            this.setState({
                error: "generic"
            });
            return;
        }
    },
    render: function () {
        return (
            React.DOM.main( {className:"edit-profile", id:"main"}, 
                this.getRenderedForm()
            )
        );
    }
});
var InitiatePasswordRecoveryForm = React.createClass({displayName: 'InitiatePasswordRecoveryForm',
    mixins: [ProfileFormMixin],
    render: function () {
        return (
            React.DOM.main( {className:"initiate-password-recovery", id:"main"}, 
                this.getRenderedForm()
            )
        );
    }
});
var PasswordRecoveryForm = React.createClass({displayName: 'PasswordRecoveryForm',
    mixins: [ProfileFormMixin],
    render: function () {
        return (
            React.DOM.main( {className:"password-recovery", id:"main"}, 
                this.getRenderedForm()
            )
        );
    }
});


var PhraseSearchResults = React.createClass({displayName: 'PhraseSearchResults',
    mixins: [LifecycleDebug({displayName: 'PhraseSearchResults'}), LinksMixin, I18nMixin],
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
    componentWillMount: function () {
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
            lang = this.state.globalLang,
            localeEndpointsMap = this.state.localeEndpointsMap;
        console.log('load');
        getPhraseSearchReactState({lang: lang, localeEndpointsMap: localeEndpointsMap, shortLangCode: this.state.shortLangCode, term: term, pageSize: PHRASES_PAGE_SIZE, page: page})
            .then(function (reactState) {
                // the only part of the newly computed reactState that we'll use is the searchResults array to append it to our current one...
                this.setState({
                    searchResults: _.union(this.state.searchResults, reactState.searchResults),
                    hasMore: this.hasMore(reactState),
                    resetPageStart: false
                });
            }.bind(this));
    },
    getPagination: function() {
        console.log("on page: " + page + ", this.hackPagination: " + this.hackPagination);
        var term = this.state.searchTerm,
            shortLangCode = this.state.shortLangCode,
            page = !this.hackPagination ? parseInt(this.state.page, 10) : (parseInt(this.state.page, 10) + 1),
            links = [];
        console.log("on page: " + page + ", this.hackPagination: " + this.hackPagination + ", this.state.page: " + this.state.page);
        this.hackPagination = true; // ugly hack to get around non asynchronous implementation. not very important since we only have pagination for SEO
        for (var i=page-10; i<page; i++) {
            if (i >= 0) {
                var pageUrl = (term && aUrl(util.format("/?q=%s&page=%d", term, i), shortLangCode)) || aUrl(util.format("/?page=%d", i), shortLangCode);
                links.push(React.DOM.li(null, React.DOM.a( {href:pageUrl, onClick:this.handleToLink.bind(this, pageUrl), key:i}, i + 1)));
            }
        }
        links.push(React.DOM.li(null, React.DOM.span( {key:"current"}, page + 1)));
        if (this.state.hasMore) {
            var nextPage = page + 2,
                pageUrl = (term && aUrl(util.format("/?q=%s&page=%d", term, nextPage), shortLangCode)) || aUrl(util.format("/?page=%d", nextPage), shortLangCode);
            links.push(React.DOM.li(null, React.DOM.a( {href:pageUrl, onClick:this.handleToLink.bind(this, pageUrl), key:"next"}, nextPage)));
        }
        return (
            React.DOM.ol(null, 
                links
            )
        );
    },
    render: function () {
        console.log("rendering PhraseSearchResults, the state is: " + JSON.stringify(this.state));
        var phraseSearchResults = [];
        _.forEach(this.state.searchResults, (function (result) {
            //phrase topDefinition
            phraseSearchResults.push(
                PhraseSearchResult( {searchResult:result, key:result.key, onSelectPhrase:this.props.onSelectPhrase, topState:this.props.topState})
            );
        }).bind(this));
        var infiniteScroll = InfiniteScroll(
                {loader:React.DOM.div( {className:"loader"}, "loading..."),
                loadMore:this.loadMore,
                hasMore:this.state.hasMore,
                resetPageStart:this.state.resetPageStart}
            , 
                phraseSearchResults
            ),
            searchTerm = this.props.topState.searchTerm,
            topSearchCaption = (searchTerm && TopSearchCaption( {topState:this.props.topState})) || "" ;
        return (
            React.DOM.main( {className:"phrase-list", id:"main"}, 
                topSearchCaption,
                React.DOM.ul( {className:"phraseSearchResultsList"}, 
                    infiniteScroll
                ),
                React.DOM.section( {className:"pagination"}, 
                    React.DOM.h3(null, this.messages.Pagination.pages),
                    this.getPagination()
                )
            )
        );
    }
});

var Leaderboard = React.createClass({displayName: 'Leaderboard',
    mixins: [I18nMixin],
    hasMore: function (state) {
        return state.showLeaderboard.length >= PHRASES_PAGE_SIZE;
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
            l10nData = this.props.topState.l10nData;
            //getContributorActivityReactState({lang: lang, shortLangCode: shortLangCode, contributor_id: contributor_id, pageSize: PHRASES_PAGE_SIZE, page: page})
        getLeaderboardReactState({lang: lang, shortLangCode: shortLangCode, l10nData: l10nData, start: start})
            .then(function (reactState) {
                var newShowLeaderboard = _.union(this.state.showLeaderboard, reactState.showLeaderboard);
                this.setState({
                    showLeaderboard: newShowLeaderboard,
                    hasMore: this.hasMore(reactState),
                    resetPageStart: false
                });
            }.bind(this));
    },
    render: function () {
        console.log("rendering Leaderboard, the state is: " + JSON.stringify(this.state));
        var leaderboardEntries = [];
            _.forEach(this.state.showLeaderboard, (function (li) {
                var key = "contributor_id:" + li.contributor_id;
                leaderboardEntries.push(
                    LeaderboardItem( {topState:this.props.topState, leaderboardObject:li, key:key})
                );
            }).bind(this)),
            infiniteScroll = InfiniteScroll(
                {loader:React.DOM.div( {className:"loader"}, "loading..."),
                loadMore:this.loadMore,
                hasMore:this.state.hasMore,
                resetPageStart:this.state.resetPageStart}
            , 
                leaderboardEntries
            ),
            m = this.messages.Leaderboard;
        return (
            React.DOM.main( {className:"leaderboard", id:"main"}, 
                React.DOM.h2(null, m.leaderboard),
                React.DOM.table(null, 
                    React.DOM.thead(null, React.DOM.tr(null, React.DOM.th(null, m.user),React.DOM.th( {title:m.pointCalculationRulesTitle}, m.points))),
                    React.DOM.tbody(null, infiniteScroll)
                )
            )
        );
    }
});

var LeaderboardItem = React.createClass({displayName: 'LeaderboardItem',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    render: function () {
        var lo = this.props.leaderboardObject,
            contributorUrl = aUrl(this.getEndpoint('contributorProfile', {contributor_id: lo.contributor_id}), this.props.topState.shortLangCode);
        return (
            React.DOM.tr(null, 
                React.DOM.td(null, React.DOM.a( {href:contributorUrl, onClick:this.handleToLink.bind(this, contributorUrl)}, lo.nickname)),
                React.DOM.td( {title:this.messages.Leaderboard.pointCalculationRulesTitle}, lo.score)
            )
        );
    }
});

var ContributorProfile = React.createClass({displayName: 'ContributorProfile',
    mixins: [I18nMixin, ScrollToTopMixin, LinksMixin, EndpointsMixin],
    render: function () {
        var editElement = '',
            m = this.messages.ContributorProfile,
            c = this.props.topState.viewedContributor,
            viewDefinitionsUrl = aUrl(util.format("/contributors/%d/activity?view=%s", c.id, 'definitions')),
            viewPhrasesUrl = aUrl(util.format("/contributors/%d/activity?view=%s", c.id, 'phrases')),
            viewVotesUrl = aUrl(util.format("/contributors/%d/activity?view=%s", c.id, 'votes')),
            editProfileUrl;
        if (!_.isEmpty(this.props.topState.loginInfo) && this.props.topState.contributor_id === this.props.topState.loginInfo.id) {
            // the user is viewing his/her own profile. show edit links, etc.
            editProfileUrl = aUrl(this.getEndpoint('editContributorProfile'), this.props.topState.shortLangCode);
            editElement = React.DOM.a( {className:"oi", 'data-glyph':"pencil", href:editProfileUrl, onClick:this.handleToLink.bind(this, editProfileUrl)}, m.editLink);
        }
        return (
            React.DOM.main( {className:"contributor-profile", id:"main"}, 
                React.DOM.h2(null, m.title),
                React.DOM.section( {className:"contributor-info"}, 
                    React.DOM.dl(null, 
                        React.DOM.dt(null, m.nickname),
                        React.DOM.dd(null, c.nickname)
                    ),
                    React.DOM.dl(null, 
                        React.DOM.dt(null, m.firstName),
                        React.DOM.dd(null, c.first_name)
                    ),
                    React.DOM.dl(null, 
                        React.DOM.dt(null, m.lastName),
                        React.DOM.dd(null, c.last_name)
                    ),
                    editElement
                ),
                React.DOM.section( {className:"contributor-activity"}, 
                    ContributorActivity( {topState:this.props.topState})
                )
            )
        );
    }
});

var ContributorActivity = React.createClass({displayName: 'ContributorActivity',
    mixins: [LifecycleDebug({displayName: 'ContributorActivity'})],
    hasMore: function (state) {
        return state.contributorActivity.length >= PHRASES_PAGE_SIZE;
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
            l10nData = this.props.topState.l10nData,
            localeEndpointsMap = this.props.topState.localeEndpointsMap,
            lang = this.props.topState.globalLang,
            shortLangCode = this.props.topState.shortLangCode,
            contributor_id = this.props.topState.contributor_id;
        console.log('load');
        getContributorActivityReactState({l10nData: l10nData, localeEndpointsMap: localeEndpointsMap, lang: lang, shortLangCode: shortLangCode, contributor_id: contributor_id, pageSize: PHRASES_PAGE_SIZE, page: page})
            .then(function (reactState) {
                var newContributorActivity = _.union(this.state.contributorActivity, reactState.contributorActivity);
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
            _.forEach(this.state.contributorActivity, (function (ai) {
                var key = "activity_type:" + ai.type +
                    "phrase_id:" + ai.phrase_id +
                    "id:" + ai.id;
                activityEntries.push(
                    ContributorActivityItem( {topState:this.props.topState, activityObject:ai, key:key})
                );
            }).bind(this)),
            infiniteScroll = InfiniteScroll(
                {loader:React.DOM.div( {className:"loader"}, "loading..."),
                loadMore:this.loadMore,
                hasMore:this.state.hasMore,
                resetPageStart:this.state.resetPageStart}
            , 
                activityEntries
            );
        return (
            React.DOM.div(null, 
                infiniteScroll
            )
        );
    }
});

var ContributorActivityItem = React.createClass({displayName: 'ContributorActivityItem',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    render: function () {
        var ao = this.props.activityObject,
            phraseId = ao.phrase_id,
            phrase = ao.phrase,
            phraseUrl = aUrl(this.getEndpoint('phrase', {phrase: phrase}), this.props.topState.shortLangCode),
            activityType = ao.type,
            val = ao.val,
            goToPhraseLinkMessage = this.messages.ContributorActivityItem.goToPhraseLink,
            activityMessage,
            cx = React.addons.classSet,
            containerClasses,
            whose = (this.props.topState.loginInfo && this.props.topState.loginInfo.id && this.props.topState.loginInfo.id === this.props.topState.contributor_id && 'own') || 'others';
        if ('phrase' === activityType) {
            if ('own' === whose) {
                activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.ownPhraseActivityEntry), {phrase: phrase});
            } else {
                activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.othersPhraseActivityEntry), {phrase: phrase});
            }
        } else if ('definition' === activityType) {
            if ('own' === whose) {
                activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.ownDefinitionActivityEntry), {phrase: phrase});
            } else {
                activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.othersDefinitionActivityEntry), {phrase: phrase});
            }
        } else if ('vote' === activityType) {
            if ('own' === whose) {
                activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.ownVoteActivityEntry), {phrase: phrase, vote: val});
            } else {
                activityMessage = this.fmt(this.msg(this.messages.ContributorActivityItem.othersVoteActivityEntry), {phrase: phrase, vote: val});
            }
        }
        containerClasses = cx({'activity-item': true, activityType: true});
        return (
            React.DOM.div( {className:containerClasses}, 
                React.DOM.p(null, activityMessage, " (",React.DOM.a( {href:phraseUrl, onClick:this.handleToLink.bind(this, phraseUrl)}, goToPhraseLinkMessage,")"))
            )
        );
    }
});

var TopSearchCaption = React.createClass({displayName: 'TopSearchCaption',
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
            React.DOM.h2( {className:"results-heading"}, resultsHeading)
        );
    }
});

var PhraseSearchResult = React.createClass({displayName: 'PhraseSearchResult',
    mixins: [I18nMixin],
    render: function () {
        var definitionOrMessage,
            missingDefinitionMessage = this.messages.PhraseSearchResult.missingDefinition;
        if (this.props.searchResult && this.props.searchResult.topDefinition && this.props.searchResult.topDefinition.definition) {
            definitionOrMessage = DefinitionInList( {searchResult:this.props.searchResult, topState:this.props.topState});
        } else {
            definitionOrMessage = React.DOM.div( {className:"missing-definition"}, missingDefinitionMessage)
        }
        return (
            React.DOM.dl(null, 
                PhraseInList( {searchResult:this.props.searchResult, onSelectPhrase:this.props.onSelectPhrase, topState:this.props.topState}),
                definitionOrMessage
            )
        );
    }
});

var PhraseInList = React.createClass({displayName: 'PhraseInList',
    mixins: [I18nMixin, LinksMixin, EndpointsMixin],
    handleClick: function (e) {
        e.preventDefault();
        console.log("clicked on phrase: " + this.props.searchResult.phrase);
        var phraseData = this.props.searchResult;
        this.props.onSelectPhrase(phraseData);
    },
    render: function () {
        var phraseUrl = aUrl(this.getEndpoint('phrase', {phrase: this.props.searchResult.phrase}), this.props.topState.shortLangCode);
        return (
            React.DOM.dt(null, 
                React.DOM.a( {href:phraseUrl, onClick:this.handleToLink.bind(this, phraseUrl)}, this.props.searchResult.phrase)
            )
        );
    }
});

var DefinitionInList = React.createClass({displayName: 'DefinitionInList',
    mixins: [I18nMixin],
    render: function () {
        var definition = this.props.searchResult.topDefinition.definition,
            definitionAbbr = this.messages.Abbreviations.definition;
        return (
            React.DOM.dd(null, 
                React.DOM.span( {className:"abbr"}, definitionAbbr),
                definition
            )
        );
    }
});

var AddPhraseForm = React.createClass({displayName: 'AddPhraseForm',
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
        var showAddPhrase = this.props.topState.showAddPhrase,
            initialPhrase = (_.isString(showAddPhrase) && showAddPhrase) || "";
            addPhrase = this.fmt(this.msg(this.messages.AddPhraseForm.addPhrase)),
            placeholder = this.fmt(this.msg(this.messages.AddPhraseForm.newPhrasePlaceHolder)),
            submit = this.fmt(this.msg(this.messages.AddPhraseForm.submitPhrase));
        return (
            React.DOM.main( {className:"add-phrase", id:"main"}, 
                React.DOM.form( {onSubmit:this.handleSubmit}, 
                    React.DOM.fieldset(null, 
                        React.DOM.legend(null, addPhrase),
                        React.DOM.input( {type:"text", placeholder:placeholder, ref:"newPhrase", defaultValue:initialPhrase, autoCorrect:"off", autoCapitalize:"none", spellCheck:"false"}),
                        React.DOM.input( {type:"submit", value:submit})
                    )
                )
            )
        );
    }
});


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
