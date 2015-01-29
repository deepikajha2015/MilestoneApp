Ext.define('CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',

    getMetrics: function() {
        return _.map(this.stateFieldValues, function(stateFieldValue) {
            return  {
                as: stateFieldValue,
                groupByField: this.stateFieldName,
                allowedValues: [stateFieldValue],
                f: 'groupByCount',
                display: 'area'
            };
        }, this);
    }
});