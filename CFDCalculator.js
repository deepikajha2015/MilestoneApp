Ext.define('CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',

    getMetrics: function () {
        return _.map(this.stateFieldValues, function (stateFieldValue) {
                return  {
                    field: 'PlanEstimate',
                    as: stateFieldValue,
                    f: 'filteredSum',
                    filterField: this.stateFieldName,
                    filterValues: [stateFieldValue],
                    display: 'area'
                };
            }, this);
    },

    getDerivedFieldsAfterSummary: function () {
        var stateFieldValues = this.stateFieldValues;
        return  [
            {
                as: 'Ideal',
                f: function (row, index, summaryMetrics, seriesData) {
                    var data = _.last(seriesData),
                        max = _.reduce(_.filter(_.keys(data), function(key) {
                            return _.contains(stateFieldValues, key); }), function(accum, key) {
                            return accum + data[key];
                        }, 0),
                        increments = seriesData.length - 1,
                        incrementAmount;
                    if (increments === 0) {
                        return max;
                    }
                    incrementAmount = max / increments;
                    return Math.floor(100 * (index * incrementAmount)) / 100;
                },
                display: 'line'
            },
            {
                as: 'Actual',
                f: function(row, index, summaryMetrics, seriesData) {
                    var today = Rally.util.DateTime.toIsoString(new Date());
                    var endIndex = _.findIndex(seriesData, function(data) { return data.tick > today; });
                    if(index <= endIndex) {
                        var acceptedSeriesData = _.pluck(seriesData, 'Accepted');
                        var slope = (acceptedSeriesData[0] - acceptedSeriesData[endIndex]) / (0 - endIndex);
                        return index * slope;
                    }
                },
                display: 'line'
            }
        ];
    }
});