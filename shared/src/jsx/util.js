/** @jsx React.DOM */

_ = require('lodash');

var _getObjectWithWithoutProps = function (object, props, withProps) {
    return _.reduce(object, function (acc, val, key) {
        if (withProps) {
            if (-1 !== _.indexOf(props, key)) {
                acc[key] = val;
            }
        } else {
            if (-1 === _.indexOf(props, key)) {
                acc[key] = val;
            }
        }
        return acc;
    }, {});
};

var getObjectWithProps = function (object, props) {
    return _getObjectWithWithoutProps(object, props, true);
};

var getObjectWithoutProps = function (object, props) {
    return _getObjectWithWithoutProps(object, props, false);
};

/**
 * @param object
 * @param array of string ennumerating properties that should
 *        be in return[1], but not on return[0]
 * @return array of objects. array[0] is an object that doesn't
 *         have properties with names ennumerated in specialProps,
 *         and array[1] is the complement
 */
var splitObject = function (obj, specialProps) {
    return [
        _.reduce(obj, function (acc, val, key) {
            if (-1 === _.indexOf(specialProps, key)) {
                acc[key] = val;
            }
            return acc;
        }, {}),
        _.reduce(obj, function (acc, val, key) {
            if (-1 !== _.indexOf(specialProps, key)) {
                acc[key] = val;
            }
            return acc;
        }, {})
    ];
};

module.exports.getObjectWithProps = getObjectWithProps;
module.exports.getObjectWithoutProps = getObjectWithoutProps;
module.exports.splitObject = splitObject;
