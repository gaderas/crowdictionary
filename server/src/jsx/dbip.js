var util = require('util');
var phpjs = require('./phpjs-funcs');
var mysql = require('mysql');
var _ = require('lodash');
var Q = require('q');

var Data = function (dbConfig) {
    console.log('using mysql ds with config: ' + JSON.stringify(dbConfig, ' ', 4));
    this.pool = mysql.createPool(dbConfig);
    this.query = (function () {
        console.log('args passed to query: ' + JSON.stringify(_.toArray(arguments)));
        this.pool.query.apply(this.pool, _.toArray(arguments));
    }).bind(this),
    this.pQuery = (function (query) {
        return Q.nbind(this.query, this.pool).apply(this.pool, _.toArray(arguments))
            .then(function (res) {
                return res[0];
            });
    }).bind(this);
    this.table = dbConfig.table;
};

Data.prototype.pLookup = function (ip) {
    var inet_pton = phpjs.inet_pton,
        inet_ntop = phpjs.inet_ntop;
    return this.pDoLookup(this.addr_type(ip), new Buffer(inet_pton(ip), 'binary'))
        .then(function (res) {
            var ret = res[0];
            if (!res.length) {
                throw Error("address not found: " + ip);
            }
            ret = res[0];
            ret.ip_start = inet_ntop(ret.ip_start.toString('binary'));
            ret.ip_end = inet_ntop(ret.ip_end.toString('binary'));
            return ret;
        });
};

Data.prototype.pDoLookup = function (addr_type, addr_start) {
    var pQuery = this.pQuery,
        table = this.table;
    return pQuery("select * from ?? where addr_type = ? and ip_start <= ? order by ip_start desc limit 1", [table, addr_type, addr_start]);
};

Data.prototype.addr_type = function (addr) {
    var ip2long = phpjs.ip2long,
        inet_pton = phpjs.inet_pton;
    if (ip2long(addr) !== false) {
        return "ipv4";
    } else if ((addr.match(/^[0-9a-fA-F:]+$/)) && inet_pton(addr)) {
        return "ipv6";
    } else {
        throw ("DBIP Exception: unknown address type for " + addr);
    }
}

module.exports = Data;
