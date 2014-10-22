var isEmptyValue = function (value) {
    return _.isEmpty(value) || value.toString().replace(/\s+/g, '') === '';
};

module.exports = {
    isEmptyValue: isEmptyValue,
    isNotEmptyValue: function (value) {
        return !isEmptyValue(value);
    },
    isNotEmpty: function (value) {
        return !_.isEmpty(value);
    },
    isUndefined: function (value) {
        return (undefined === value);
    },
    isNotUndefined: function (value) {
        return (undefined !== value);
    },
    filterObject: function (obj, callback) {
        /*if (this.isObject(callback)) {
            // _.where style callback should be used
        } else if (this.isString(callback)) {
            // _.pluck style callback should be used
        }*/
        return this.reduce(obj, function (acc, val, key) {
            if (callback(val)) {
                acc[key] = val;
            }
            return acc;
        }, {});
    }
};
