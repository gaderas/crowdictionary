var dsFactory = function (nconf) {
    var Ds;
    if ('mock' === nconf.get('data:source')) {
        Ds = require('./ds.mock.js');
        return new Ds();
    } else if ('mysql' === nconf.get('data:source')) {
        Ds = require('./ds.mysql.js');
        return new Ds(nconf.get('data:dbConfig'));
    } else {
        return false;
    }
};


module.exports = dsFactory;
