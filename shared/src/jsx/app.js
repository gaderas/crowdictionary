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
var EventEmitter = require('events').EventEmitter;
var pRequest,
    setPRequest = function (incoming) {
        pRequest = incoming;
        l10n.setPRequest(pRequest);
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
        nRouteInfo = getNormalizedRouteInfo('client', routeInfo, params),
        hostname = window.location.hostname;


    console.log('hostname: ' + hostname);
    console.log('routeInfo: ' + JSON.stringify(routeInfo, ' ', 4));
    console.log('args: ' + JSON.stringify(args, ' ', 4));
    console.log('nRouteInfo: ' + JSON.stringify(nRouteInfo, ' ', 4));
    Q(routeInfo.calculateStateFunc())
        .then((function (state) {
            console.log("state so far: " + state);
            return l10n.getAvailableLangs()
                .then(function (langs) {
                    console.log("available langs: " + JSON.stringify(langs));
                    state.lang = appUtil.getLangBasedOnHostname(hostname, langs);
                    return l10n.getL10nForLang(state.lang);
                })
                .then(function (l10nData) {
                    console.log("gonna set state.l10nData to : " + JSON.stringify(l10nData));
                    state.l10nData = l10nData;
                    setInitialState(state);
                })
                .then((function () {
                    console.log("lang is: " + state.lang + ", and l10nData: " + JSON.stringify(state.l10nData));
                    return React.renderComponent(
                        <CrowDictionary calculateStateFunc={routeInfo.calculateStateFunc} />,
                        document
                    );
                }.bind(this)));
        }).bind(this));
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


var I18nMixin = {
    messages: null,
    loadMessages: function () {
        this.messages = this.props.topState.l10nData.messages;
    },
    msg: function (messageStr) {
        return new IntlMessageFormat(messageStr, this.props.topState.lang);
    },
    fmt: function (messageObj, values) {
        return messageObj.format(values);
    }
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
    handleLogIn: function (username, password) {
        console.log("user: " + username + ", pass: " + password);
        loginStateUrl = "http://localhost:3000/v1/login";
        return pRequest({method: "POST", url: loginStateUrl, body: {email: username, passhash: password}, json:true})
            .then((function(res) {
                if (200 !== res[0].statusCode) {
                    throw Error("invalid credentials");
                }
                console.log("login success!");
                console.log("res is: " + JSON.stringify(res, ' ', 4));
                var rObj = res[1]; // it's already json because we called `pRequest` with `{json:true}`
                console.log("rObj: " + JSON.stringify(rObj, ' ', 4));
                return this.props.calculateStateFunc(this.state.globalLang, this.state.searchTerm);
            }).bind(this))
            .then((function (newState) {
                newState.showLoginPrompt = false;
                this.replaceState(newState);
                this.forceUpdate();
            }).bind(this))
            .fail(function (err) {
                console.error("failed with error: " + JSON.stringify(err));
            });
    },
    handleLogOut: function () {
        var logOutUrl = "http://localhost:3000/v1/logout";
        return pRequest(logOutUrl)
            .then((function (res) {
                return this.props.calculateStateFunc(this.state.globalLang, this.state.searchTerm);
            }).bind(this))
            .then((function (newState) {
                this.replaceState(newState);
            }).bind(this));
    },
    handleSubmitAddPhrase: function (phrase) {
        console.log("got a new phrase: " + phrase);
        var lang = this.state.globalLang,
            crumb = this.state.loginInfo.crumb,
            addPhraseUrl = util.format("http://localhost:3000/v1/lang/%s/phrases/%s", lang, phrase);
        return pRequest({method: "PUT", url: addPhraseUrl, body: {phrase: phrase, lang: lang, crumb: crumb}, json: true})
            .then((function (res) {
                if (200 !== res[0].statusCode) {
                    throw Error("failed to add a new phrase...");
                }
                return this.props.calculateStateFunc(this.state.globalLang, this.state.searchTerm);
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
                mainContent = <PhraseDetails topState={this.state} onClosePhraseDetails={this.handleClosePhraseDetails}/>;
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
                <AddDefinitionForm topState={this.props.topState} />
                <div>
                    <a onClick={this.handleBack}>Back</a>
                </div>
            </div>
        );
    }
});

var AddDefinitionForm = React.createClass({
    handleSubmit: function (e) {
        var newPhrase = this.refs.newPhrase.getDOMNode().value;
        e.preventDefault();
        //this.props.onSubmitAddPhrase(newPhrase);
    },
    render: function () {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <span>Add phrase</span>
                    <textarea placeholder="enter a new definition for phrase '' here" ref="newPhrase"/>
                    <input type="submit" name="submit"/>
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
            console.log("tutti: " + JSON.stringify(this.messages));
            console.log("il posto: " + this.messages.top.greeting.notLoggedIn);
            var greeting = this.fmt(this.msg(this.messages.top.greeting.notLoggedIn));
            return (
                <span onClick={this.handleClick}>{greeting}</span>
            );
        } else {
            return (
                <span>Welcome '{loginInfo.email}'! <a onClick={this.handleLogOut}>Log out</a></span>
            );
        }
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
                <AddPhraseForm onSubmitAddPhrase={this.props.onSubmitAddPhrase}/>
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
    handleSubmit: function (e) {
        var newPhrase = this.refs.newPhrase.getDOMNode().value;
        e.preventDefault();
        this.props.onSubmitAddPhrase(newPhrase);
    },
    render: function () {
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <span>Add phrase</span>
                    <textarea placeholder="enter a new phrase here" ref="newPhrase"/>
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
module.exports.l10n = {};
module.exports.l10n.getAvailableLangs = l10n.getAvailableLangs;
module.exports.l10n.getL10nForLang = l10n.getL10nForLang;
