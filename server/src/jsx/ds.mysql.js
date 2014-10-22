var Q = require('q');
var mysql = require('mysql');
var _ = require('lodash');
var util = require('util');
var appUtil = require('../../../shared/build/js/util.js');

_.mixin(require('../../../shared/build/js/lodash_mixin.js'));

var Data = function (dbConfig) {
    console.log('using mysql ds with config: ' + JSON.stringify(dbConfig, ' ', 4));
    this.pool = mysql.createPool(dbConfig);
    this.pQuery = function (qs, qparams) {
        console.log('args passed to pQuery: ' + JSON.stringify(_.toArray(arguments)));
        var denodifiedQuery = Q.nbind(this.pool.query, this.pool);
        _.forEach(qparams, function (param, key) {
            param = (undefined !== param) ? param : "";
        });
        console.log("qparams (query params) are now: " + JSON.stringify(qparams));
        return Q.fcall(denodifiedQuery, qs, qparams)
            .then(function (res) {
                return res[0];
            });
    }.bind(this);
};

Data.prototype.end = function () {
    var denodifiedEnd = Q.nbind(this.pool.end, this.pool);
    return denodifiedEnd();
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
        actualLimits = splitParams[1],
        searchedKey;
    if (actualParams.id) {
        searchedKey = 'id';
    } else if (actualParams.email) {
        searchedKey = 'email';
    } else if (actualParams.status) {
        searchedKey = 'status';
    } else if (actualParams.password_reset_status) {
        searchedKey = 'password_reset_status';
    } else {
        throw Error("there's missing information in the request that prevents this service from knowing what data you want");
    }
    if (_.isString(actualParams[searchedKey])) {
        actualParams[searchedKey] = [actualParams[searchedKey]];
    }
    if ('id' === searchedKey) {
        actualParams.id = _.map(actualParams.id, function (id) {
            return parseInt(id, 10);
        });
    }
    return pQuery("SELECT * FROM `contributor` WHERE ?? IN (?)", [searchedKey, actualParams[searchedKey]]);
};

Data.prototype.createContributor = function (params, payload) {
    var pQuery = this.pQuery,
        insertBy;
    if (!payload || !payload.email) {
        throw Error("no payload (HTTP body) or no email in it");
    }
    if (params.email) {
        if (params.email !== payload.email) {
            throw Error("email in query string doesn't match email in HTTP body");
        }
        insertBy = {email: params.email};
    } else {
        throw Error("no email param passed. need it for inserts...");
    }
    return pQuery("INSERT INTO `contributor` SET ? ", payload);
};

Data.prototype.updateContributor = function (params, payload) {
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
    return pQuery("UPDATE `contributor` SET ? WHERE ?", [payload, insertBy]);
};

/**
 * NOT TO BE EXPOSED VIA AN API ENDPOINT
 * example payload: {
 *     type: email,
 *     code: "s3cr3tCODE",
 *     recipient: somebody@example.com,
 *     contributor_id: 101,
 *     //scheduled: (new Date()).toISOString(), // on row creation, `scheduled` is set automatically. on subsequent updates we set `sent`, `send_status_received`
 *     sent: (new Date()).toISOString(), // one update for `sent`, and another one later on for `send_status_received`
 *     send_status_received: (new Date()).toISOString(),
 *     send_status: "success", // "success" || "fail",
 *     send_status_message: "aws-ses-id: 432 kfjsld 32..."
 * }
 */
Data.prototype.putNotification = function (payload) {
    var pQuery = this.pQuery;
    console.log("on putNotification");
    return pQuery("INSERT INTO `notification` SET ? ON DUPLICATE KEY UPDATE ?", [payload, payload]);
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

/**
 * Similar to getPhrases(), and searchPhrase(). This function
 * takes in an array of searched phrases and returns *exact matches only*.
 */
Data.prototype.searchPhrases = function (params) {
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
        queriedField = (!_.isEmpty(actualParams.phrase) && _.isArray(actualParams.phrase) && 'phrase') || 'id',
        whereValues = actualParams[queriedField],
        start = parseInt(actualLimits && actualLimits.start, 10) || 0,
        limit = parseInt(actualLimits && actualLimits.limit, 10) || 2;
    if (!actualParams.lang) {
        throw Error("error. tried to query phrases without specifying 'lang'");
    }
    if (_.isEmpty(whereValues) || !_.isArray(whereValues)) {
        throw Error("no phrases to search (either by phrase or by id) were specified");
    }
    // @TODO eventually introduce LIMIT to prevent abuse
    return pQuery("SELECT * FROM `phrase` WHERE ? AND ?? in (?) ORDER BY lang, phrase ASC", [{lang: actualParams.lang}, queriedField, whereValues]);
};

/**
 * since the table's UNIQUE INDEX doesn't contain `contributor_id`, we
 * must perform a check here to see if the phrase previously existed, and
 * allow overwriting only if performed by the same contributor.
 */
Data.prototype.putPhrase = function (payload) {
    var pQuery = this.pQuery,
        insertBy;
    if (!payload.contributor_id) {
        throw Error("unauthorized non-authenticated call");
    }
    if (!payload || !payload.lang || !payload.phrase) {
        throw Error("no payload (HTTP body) or no 'lang' or 'phrase' in it");
    }
    return pQuery("SELECT * FROM `phrase` WHERE `phrase` = ?", payload.phrase)
        .then(function (phrases) {
            if (!_.isEmpty(phrases) && phrases[0].contributor_id !== payload.contributor_id) {
                throw Error("phrase already exists and is owned by a different contributor. can't update it.");
            }
            return pQuery("INSERT INTO `phrase` SET ? ON DUPLICATE KEY UPDATE ?", [payload, payload]);
        });
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
        actualLimits = splitParams[1],
        filterAnds = [],
        filterParams = [];
    if (!actualParams.phrase && !actualParams.phraseIds) {
        throw Error("error. tried to query definitions without specifying 'phrase' or 'phraseIds'");
    }
    if (actualParams.phrase && !actualParams.lang) {
        throw Error("error. tried to query definitions by 'phrase' without specifying 'lang'");
    }
    if (actualParams.phrase && actualParams.phraseIds) {
        throw Error("error. tried to query definitions specifying both 'phrase' and 'phraseIds'. only one of the two should be specified.");
    }
    // additional filtering:
    if (actualParams.contributor_id) {
        filterAnds.push(" "); // first filter item empty element so that the join below generates valid SQL
        filterAnds.push("d.contributor_id = ?");
        filterParams.push(actualParams.contributor_id);
    }

    if (actualParams.phrase) {
        return pQuery("SELECT d.* FROM `phrase` p LEFT JOIN `definition` d ON p.id = d.phrase_id WHERE ? AND ? " + filterAnds.join(" AND ") + " ORDER BY d.updated ASC", _.union([{'d.lang': actualParams.lang}, {'p.phrase': actualParams.phrase}], filterParams));
    } else {
        return pQuery("SELECT d.* FROM `definition` d WHERE `phrase_id` IN (?) ORDER BY updated ASC", _.union([actualParams.phraseIds.split(',')], filterParams));
    }
};

Data.prototype.getContributorActivity = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.filterObject(params, _.isNotUndefined),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        actualParams = splitParams[0],
        actualLimits = splitParams[1],
        cid = actualParams.contributor_id,
        lang = actualParams.lang,
        activityQuery,
        phrasesQuery,
        definitionsQuery,
        votesQuery,
        start = parseInt(actualLimits && actualLimits.start, 10) || 0,
        limit = parseInt(actualLimits && actualLimits.limit, 10) || 2;
    if (!cid) {
        throw Error("error. tried to get a contributor's activity without specifying the 'contributor_id'");
    }
    if (!lang) {
        throw Error("error. tried to get contributor's activity without specifying 'lang'");
    }
    activityQuery = "SELECT 'vote' AS type, v.id, IF(v.updated>v.created,v.updated,v.created) AS last_change, v.vote AS val, d.phrase_id FROM vote AS v LEFT JOIN definition AS d ON v.definition_id=d.id WHERE v.contributor_id = ? AND lang = ? ";
    activityQuery += "UNION SELECT 'definition' AS type, id, IF(updated>created,updated,created) AS last_change, definition AS val, phrase_id FROM definition WHERE contributor_id = ? AND lang = ? ";
    activityQuery += "UNION SELECT 'phrase' AS type, id, IF(updated>created,updated,created) AS last_change, phrase AS val, id AS phrase_id FROM phrase WHERE contributor_id = ? AND lang = ? ";
    activityQuery += "ORDER BY last_change DESC LIMIT ?, ?;";
    return pQuery(activityQuery, [cid, lang, cid, lang, cid, lang, start, limit]);
};

Data.prototype.getContributorScore = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.filterObject(params, _.isNotUndefined),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        actualParams = splitParams[0],
        actualLimits = splitParams[1],
        cid = actualParams.contributor_id,
        scoreQuery,
        start = parseInt(actualLimits && actualLimits.start, 10) || 0,
        limit = parseInt(actualLimits && actualLimits.limit, 10) || 2;
    if (!cid) {
        throw Error("error. tried to get a contributor's score without specifying the 'contributor_id'");
    }
    scoreQuery = "select count(1) as score from definition d left join vote v on d.id = v.definition_id where v.contributor_id is not null and d.contributor_id=?;";
    return pQuery(scoreQuery, [cid]);
};

Data.prototype.getContributorLeaderboard = function (params) {
    var pQuery = this.pQuery,
        existingParams = _.filterObject(params, _.isNotUndefined),
        splitParams = appUtil.splitObject(existingParams, ['start', 'limit']),
        actualParams = splitParams[0],
        actualLimits = splitParams[1],
        leaderboardQuery,
        start = parseInt(actualLimits && actualLimits.start, 10) || 0,
        limit = parseInt(actualLimits && actualLimits.limit, 10) || 2;
    leaderboardQuery = "select d.contributor_id, count(1) as score from definition d left join vote v on d.id = v.definition_id where v.contributor_id is not null group by d.contributor_id ORDER BY score DESC LIMIT ?, ?;";
    return pQuery(leaderboardQuery, [start, limit]);
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

/**
 * This function is to be called *after* having authenticated the user through other means.
 * This function doesn't attempt to authenticate the user and just performs the requested operation.
 */
Data.prototype.unsafeResetDefinitionVotes = function (definitionId) {
    var pQuery = this.pQuery;
    definitionId = parseInt(definitionId, 10);
    if (!definitionId) {
        throw Error("need a definitionId that votes will be reset for");
    }
    return pQuery("UPDATE `vote` SET `vote` = 'neutral' WHERE `definition_id` = ?", definitionId);
};

module.exports = Data;
