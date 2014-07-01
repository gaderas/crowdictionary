var mysql = require('mysql');
var _ = require('lodash');
var util = require('util');

var Data = function (dbConfig) {
    console.log('using mysql ds with config: ' + JSON.stringify(dbConfig, ' ', 4));
    this.pool = mysql.createPool(dbConfig);
};

Data.prototype.getUser = function (username) {
    return 'hahahahha';
};
Data.prototype.getUsers = function () {
    return 'hahahahha';
};
Data.prototype.getTeam = function (teamname) {
    return 'hahahahha';
};
Data.prototype.getTeams = function () {
    return 'hahahahha';
};

module.exports = Data;
