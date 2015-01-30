Ext.define('MilestoneApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    config: {
        defaultSettings: {
            milestone: '/milestone/28857949153'
        }
    },

    launch: function () {
        Deft.Promise.all([
            this._loadMilestone(),
            this._loadChaptersInMilestone(),
            this._loadScheduleStateValues(),
            this._loadPreliminaryEstimateValues()
        ]).then({
            success: function() {
                this._addChart();
            },
            scope: this
        });
    },

    _getMilestone: function() {
        return this.getSetting('milestone');
    },

    _loadMilestone: function() {
        var milestoneId = Rally.util.Ref.getOidFromRef(this._getMilestone());
        return Rally.data.ModelFactory.getModel({
            type: 'Milestone',
            success: function (model) {
                model.load(milestoneId, {
                    fetch: ['TargetDate'],
                    callback: function (record) {
                        this.milestone = record;
                    },
                    scope: this
                });
            },
            scope: this
        });
    },

    _loadChaptersInMilestone: function() {
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'portfolioitem/chapter',
            fetch: ['ObjectID', 'PreliminaryEstimate'],
            filters: [
                {
                    property: 'Milestones',
                    operator: 'contains',
                    value: this._getMilestone()
                }
            ],
            context: {
                project: null
            },
            limit: Infinity
        });
        return store.load().then({
            success: function(records) {
                this.chapters = records;
            },
            scope: this
        });
    },

    _loadPreliminaryEstimateValues: function () {
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'preliminaryestimate',
            fetch: ['Name', 'Value'],
            limit: Infinity
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
                preliminaryEstimates: this.preliminaryEstimates,
                endDate: this.milestone.get('TargetDate'),
                chapters: this.chapters
            },
            chartConfig: this._getChartConfig()
        });
    },

    _getStoreConfig: function () {
        return {
            find: {
                _TypeHierarchy: { '$in': [ 'HierarchicalRequirement', 'PortfolioItem/Chapter'] },
                _ItemHierarchy: { '$in': _.invoke(this.chapters, 'getId')}
            },
            fetch: ['ScheduleState', 'PlanEstimate', 'PortfolioItem', 'LeafStoryPlanEstimateTotal', 'State'],
            hydrate: ['ScheduleState', 'State'],
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
                tickInterval: 15,
                title: {
                    text: 'Date'
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Points'
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
