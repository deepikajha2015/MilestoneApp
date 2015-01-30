Ext.define('CFDCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',

    getMetrics: function () {
        return [
            {
                as: 'Estimate',
                field: 'Estimate',
                display: 'area',
                f: 'sum'
            }
        ].concat(_.map(this.stateFieldValues, function (stateFieldValue) {
                return  {
                    field: 'PlanEstimate',
                    as: stateFieldValue,
                    f: 'filteredSum',
                    filterField: this.stateFieldName,
                    filterValues: [stateFieldValue],
                    display: 'area'
                };
            }, this));
    },

    _getPreliminaryEstimateById: _.memoize(function (preliminaryEstimate) {
        return _.find(this.preliminaryEstimates, function (pe) {
            return Rally.util.Ref.getRelativeUri(pe) === Rally.util.Ref.getRelativeUri(preliminaryEstimate);
        });
    }),

    _getChapterById: _.memoize(function (chapterId) {
        return _.find(this.chapters, function (chapter) {
            return chapter.getId() === chapterId;
        });
    }),

    getDerivedFieldsOnInput: function () {
        var self = this;
        return [
            {
                "as": "Estimate",
                "f": function (snapshot) {
                    if(snapshot.State) {
                        var chapter = self._getChapterById(snapshot.ObjectID);
                        var preliminaryEstimate = self._getPreliminaryEstimateById(chapter.get('PreliminaryEstimate'));
                        return Math.max(preliminaryEstimate.get('Value'), snapshot.LeafStoryPlanEstimateTotal || 0);
                    }
                    return 0;
                }
            }
        ];
    }
});