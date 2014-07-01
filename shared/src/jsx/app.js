/** @jsx React.DOM */

var React = require('react');
var bs = require('./bootstrap.js');
var _ = require('lodash');

var Layout = bs.Layout;
var Widget = bs.Widget;

var CrowDictionary = React.createClass({
    getInitialState: function () {
        return {
            viewing: 'PhraseSearchResults',
            searchTerm: 'hijazo de mi vidaza',
            searchResults: [
                {phrase: 'hijazo de mi vidaza', topDefinition: 'asi le dicen al muñecón', key: 1},
                {phrase: 'hijo del mal dormir', topDefinition: 'cuando alguien te cae mal', key: 2}
            ]
        };
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
              <script src="/static/js/app.js" />
            </head>
            <body>
            <div>
                <TopBar onUserInput={this.handleUserInput}/>
                <PhraseSearchResults searchTerm={this.state.searchTerm} searchResults={this.state.searchResults}/>
            </div>
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

var pages = {
    '/': {
        /*'func': function (params) {
            console.log('route /');
            var component = (
                <InterfaceComponent router=
            );
            return component;
            //var markup = React.renderComponentToString(component);
            //return markup;
        },*/
        'paramNames': []
    },
    '/searchPhrase/:searchTerm': {
        /*'func': function (params) {
            console.log('route /posts/:id');
            var component = (
                <Layout>
                    <p>From server: <Widget clientOrServer="server" postId={params.id}/></p>
                    <p><div id="client"></div></p>
                </Layout>
            );
            return component;
            //var markup = React.renderComponentToString(component);
            //return markup;
        },*/
        'paramNames': ['searchTerm']
    }
};

/*var Widget = React.createClass({
    render: function () {
        return <p>hello there!</p>;
    }
});*/
/*React.renderComponent(
    <h1>Hello, world!</h1>,
    document.getElementById('example')
);*/

module.exports.bs = bs;
module.exports.pages = pages;
module.exports.InterfaceComponent = InterfaceComponent;
module.exports.CrowDictionary = CrowDictionary;
