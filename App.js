Ext.define('MilestoneApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function () {
        Deft.Promise.all([
            this._loadScheduleStateValues(),
            this._loadPreliminaryEstimateValues()
        ]).then({
            success: function() {
                this._addChart();
            },
            scope: this
        });
    },

    _loadPreliminaryEstimateValues: function () {
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'preliminaryestimate',
            fetch: ['Name', 'Value']
        });
        return store.load().then({
            success: function(records) {
                this.preliminaryEstimates = records;
            },
            scope: this
        });
    },

    _loadScheduleStateValues: function () {
        return Rally.data.ModelFactory.getModel({
            type: 'UserStory',
            success: function (model) {
                model.getField('ScheduleState').getAllowedValueStore().load({
                    callback: function (records) {
                        this.scheduleStateValues = _.invoke(records, 'get', 'StringValue');
                    },
                    scope: this
                });
            },
            scope: this
        });
    },

    _addChart: function () {
        this.add({
            xtype: 'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: this._getStoreConfig(),
            calculatorType: 'CFDCalculator',
            calculatorConfig: {
                stateFieldName: 'ScheduleState',
                stateFieldValues: this.scheduleStateValues,
                preliminaryEstimates: this.preliminaryEstimates
            },
            chartConfig: this._getChartConfig()
        });
    },

    /**
     * Generate the store config to retrieve all snapshots for stories and defects in the current project scope
     * within the last 30 days
     */
    _getStoreConfig: function () {
        return {
            find: {
                _TypeHierarchy: { '$in': [ 'HierarchicalRequirement', 'portfolioitem/chapter'] },
                Children: null,
                _ProjectHierarchy: this.getContext().getProject().ObjectID,
                _ValidFrom: {'$gt': Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(new Date(), 'day', -30)) }
            },
            fetch: ['ScheduleState'],
            hydrate: ['ScheduleState'],
            sort: {
                _ValidFrom: 1
            },
            context: this.getContext().getDataContext(),
            limit: Infinity
        };
    },

    /**
     * Generate a valid Highcharts configuration object to specify the chart
     */
    _getChartConfig: function () {
        return {
            chart: {
                zoomType: 'xy'
            },
            title: {
                text: 'Milestone Cumulative Flow'
            },
            xAxis: {
                tickmarkPlacement: 'on',
                tickInterval: 20,
                title: {
                    text: 'Date'
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Count'
                    }
                }
            ],
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    }
                },
                area: {
                    stacking: 'normal'
                }
            }
        };
    }
});
