var Q = require('q');
var mysql = require('mysql');
var _ = require('lodash');
var util = require('util');
var appUtil = require('../../../shared/build/js/util.js');

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
};


Data.prototype.getContributors = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.reduce(params, function (result, val, key) {
            console.log('val: ' + val + ', key: ' + key);
            if (val) {
                result[key] = val;
            }
            return result;
        }, {}),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        fake = console.log('splitParams: ' + JSON.stringify(splitParams)),
        actualParams = splitParams[0],
        actualLimits = splitParams[1];
    return pQuery("SELECT * FROM `contributor` WHERE ?", actualParams);
};

Data.prototype.putContributor = function (params, payload) {
    var pQuery = this.pQuery,
        insertBy;
    if (!payload || !payload.email) {
        throw Error("no payload (HTTP body) or no email in it");
    }
    if (params.email) {
        insertBy = {email: params.email};
        if (params.email !== payload.email) {
            throw Error("email in query string doesn't match email in HTTP body");
        }
    } else if (params.id) {
        insertBy = {id: params.id};
    } else {
        throw Error("no email or id params passed. need either one of them for updates, or email for inserts...");
    }
    return pQuery("INSERT INTO `contributor` SET ? ON DUPLICATE KEY UPDATE ?", [payload, payload]);
};

Data.prototype.getPhrases = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.reduce(params, function (result, val, key) {
            if (val) {
                result[key] = val;
            }
            return result;
        }, {}),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        fake = console.log('splitParams: ' + JSON.stringify(splitParams)),
        actualParams = splitParams[0],
        actualLimits = splitParams[1],
        start = parseInt(actualLimits && actualLimits.start, 10) || 0,
        limit = parseInt(actualLimits && actualLimits.limit, 10) || 2;
    if (!actualParams.lang) {
        throw Error("error. tried to query phrases without specifying 'lang'");
    }
    if (actualParams.phrase) {
        // this is used to find exact matches, so no need for LIMIT clause
        return pQuery("SELECT * FROM `phrase` WHERE ? AND ? ORDER BY lang, phrase ASC", [{lang: actualParams.lang}, {phrase: actualParams.phrase}]);
    } else {
        return pQuery("SELECT * FROM `phrase` WHERE ? ORDER BY lang, phrase ASC LIMIT ?, ?", [actualParams, start, limit]);
    }
};

/**
 * similar to getPhrases(), but returns a set that is made up of the following
 * sub-sets in the following order:
 * * an exact match, if it exists
 * * phrases starting with search term, if they exist
 * * phrases containing search term
 */
Data.prototype.searchPhrase = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.reduce(params, function (result, val, key) {
            if (val) {
                result[key] = val;
            }
            return result;
        }, {}),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        fake = console.log('splitParams: ' + JSON.stringify(splitParams)),
        actualParams = splitParams[0],
        actualLimits = splitParams[1],
        start = parseInt(actualLimits && actualLimits.start, 10) || 0,
        limit = parseInt(actualLimits && actualLimits.limit, 10) || 2;
    if (!actualParams.lang) {
        throw Error("error. tried to query phrases without specifying 'lang'");
    }
    return pQuery("select * from phrase where phrase = ? and lang = ?" +
                  " UNION select * from phrase where phrase like ? and phrase != ?  and lang = ?" +
                  " UNION select * from phrase where phrase like ? and phrase not like ? and lang = ?" +
                  " LIMIT ?, ?",
                  [actualParams.search, actualParams.lang,
                   actualParams.search+'%', actualParams.search, actualParams.lang,
                   '%'+actualParams.search+'%', actualParams.search+'%', actualParams.lang,
                   start, limit]);
};

Data.prototype.putPhrase = function (payload) {
    var pQuery = this.pQuery,
        insertBy;
    if (!payload.contributor_id) {
        throw Error("unauthorized non-authenticated call");
    }
    if (!payload || !payload.lang || !payload.phrase) {
        throw Error("no payload (HTTP body) or no 'lang' or 'phrase' in it");
    }
    return pQuery("INSERT INTO `phrase` SET ? ON DUPLICATE KEY UPDATE ?", [payload, payload]);
};

Data.prototype.getDefinitions = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.reduce(params, function (result, val, key) {
            if (val) {
                result[key] = val;
            }
            return result;
        }, {}),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        fake = console.log('splitParams: ' + JSON.stringify(splitParams)),
        actualParams = splitParams[0],
        actualLimits = splitParams[1];
    if (!actualParams.phrase && !actualParams.phraseIds) {
        throw Error("error. tried to query definitions without specifying 'phrase' or 'phraseIds'");
    }
    if (actualParams.phrase && !actualParams.lang) {
        throw Error("error. tried to query definitions by 'phrase' without specifying 'lang'");
    }
    if (actualParams.phrase && actualParams.phraseIds) {
        throw Error("error. tried to query definitions specifying both 'phrase' and 'phraseIds'. only one of the two should be specified.");
    }

    if (actualParams.phrase) {
        return pQuery("SELECT d.* FROM `phrase` p LEFT JOIN `definition` d ON p.id = d.phrase_id WHERE ? AND ? ORDER BY d.updated ASC", [{'d.lang': actualParams.lang}, {'p.phrase': actualParams.phrase}]);
    } else {
        return pQuery("SELECT * FROM `definition` WHERE `phrase_id` IN (?) ORDER BY updated ASC", [actualParams.phraseIds.split(',')]);
    }
};

/*Data.prototype.searchDefinition
 * depending on `params.mode`, it will behave in one of the following ways:
 * # `mode` === `search`*/

Data.prototype.putDefinition = function (payload) {
    var pQuery = this.pQuery;

    if (!payload.contributor_id) {
        throw Error("unauthorized non-authenticated call");
    }
    if (!payload || !payload.lang || !payload.phrase_id || !payload.definition) {
        throw Error("no payload (HTTP body) or no 'lang', 'phrase' or 'definition' in it");
    }
    return pQuery("INSERT INTO `definition` SET ? ON DUPLICATE KEY UPDATE ?, id=LAST_INSERT_ID(id)", [payload, payload])
        .then(function () {
            return pQuery("SELECT LAST_INSERT_ID() AS last_id;")
        });
};

Data.prototype.getVotes = function (params) {
    var pQuery = this.pQuery;

    return pQuery("SELECT * FROM `vote` WHERE definition_id IN (?)", [params.definition_ids]);
};

Data.prototype.putVote = function (payload) {
    var pQuery = this.pQuery;

    if (!payload.contributor_id) {
        throw Error("unauthorized non-authenticated call");
    }
    if (!payload || !payload.definition_id || !payload.vote) {
        throw Error("no payload (HTTP body) or no 'definition_id' or 'vote' in it");
    }
    return pQuery("INSERT INTO `vote` SET ? ON DUPLICATE KEY UPDATE ?", [payload, payload]);
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
