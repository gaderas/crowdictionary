var _ = require('lodash');
var util = require('util');

var Data = function () {
};

Data.prototype.teamsData = {
    mx: {
        codename: "mx",
        name: "Mexico",
        lang: "es-MX",
        players: [
            {
                name: "Nacho Ambriz",
                position: "striker",
                age: 35
            },
            {
                name: "Jorge Campos",
                position: "goalkeeper",
                age: 34
            }
        ],
        awards: [
            {
                name: "Gold Cup",
                edition: "2004"
            }
        ]
    },
    gb: {
        codename: "gb",
        name: "England",
        lang: "en-GB",
        players: [
            {
                name: "Owen",
                position: "striker",
                age: 35
            },
            {
                name: "Winston Churchill",
                position: "goalkeeper",
                age: 89
            }
        ],
        awards: [
            {
                name: "World Cup",
                edition: "pre-historic times"
            }
        ]
    },
    de: {
        codename: "de",
        name: "Germany",
        lang: "de-DE",
        players: [
            {
                name: "Lothar Matthaeus",
                position: "striker",
                age: 35
            },
            {
                name: "Rudy Weller",
                position: "defender",
                age: 34
            }
        ],
        awards: [
            {
                name: "World Cup",
                edition: "1990"
            },
            {
                name: "World Cup",
                edition: "2002"
            }
        ]
    }
};

Data.prototype.usersData = {
    'germoad': {
        username: 'germoad',
        name: "Gerardo Moad",
        age: 32,
        tagline: "i'm your dad"
    },
    'sanx': {
        username: 'sanx',
        name: "Martin Mout",
        age: 55,
        tagline: "sono un italiano vero"
    },
    'lw': {
        username: 'lw',
        name: "Lusito Buelti",
        age: 33,
        tagline: "football is my name"
    },
    'gporras': {
        username: 'gporras',
        name: "Le Tocaye",
        age: 66,
        tagline: "chicken wings are the love of my life"
    }
};

Data.prototype.getTeams = function () {
    return this.teamsData;
};

Data.prototype.getTeam = function (teamname) {
    var teamData;
    if (undefined !== this.teamsData[teamname]) {
        teamData = this.teamsData[teamname];
    } else {
        teamData = _.toArray(this.teamsData).find(function (val, idx, coll) {
            return idx === teamname.length % coll.length;
        });
    }
    return teamData;
};

Data.prototype.getUsers = function () {
    return this.usersData;
};

Data.prototype.getUser = function (username) {
    var userData;
    if (undefined !== this.usersData[username]) {
        userData = this.usersData[username];
    } else {
        userData = _.toArray(this.usersData).find(function (val, idx, coll) {
            return idx === username.length % coll.length;
        });
    }
    return userData;
};

module.exports = Data;
