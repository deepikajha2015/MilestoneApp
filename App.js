Ext.define('MilestoneCFD', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    margin: '10px',

    layout: {
        type: 'vbox',
        align: 'stretch'
    },

    items: [
        {
            xtype: 'container',
            itemId: 'header',
            layout: {
                type: 'hbox',
                align: 'stretch'
            }
        }
    ],

    launch: function () {
        this.down('#header').add({
            xtype: 'rallymilestonecombobox',
            width: 200,
            height: 22,
            stateful: true,
            stateId: this.getContext().getScopedStateId('milestone'),
            context: this.getContext(),
            listeners: {
                ready: this._load,
                select: this._load,
                scope: this
            }
        });
    },

    _load: function() {
        Deft.Promise.all([
            this._loadMilestone(),
            this._loadChaptersInMilestone(),
            this._loadScheduleStateValues(),
            this._loadPreliminaryEstimateValues()
        ]).then({
            success: function() {
                this._addProjectCheckboxes();
                this._addChart();
            },
            scope: this
        });
    },

    _getMilestone: function() {
        return this.down('rallymilestonecombobox').getValue();
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
            fetch: ['ObjectID', 'Project', 'Name', 'PreliminaryEstimate', 'ActualStartDate', 'PlannedEndDate', 'AcceptedLeafStoryPlanEstimateTotal', 'LeafStoryPlanEstimateTotal'],
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

    _addProjectCheckboxes: function() {
        if(this.down('checkboxgroup')) {
            this.down('checkboxgroup').destroy();
        }
        var teams = _.reduce(this.chapters, function(projects, chapter) {
            projects[Rally.util.Ref.getOidFromRef(chapter.get('Project'))] = chapter.get('Project');
            return projects;
        }, {});
        this.down('#header').add({
            xtype: 'checkboxgroup',
            margin: '0 0 0 20px',
            height: 22,
            flex: 1,
            items: _.map(_.values(teams), function(team) {
                return { boxLabel: team.Name, name: 'project', inputValue: Rally.util.Ref.getOidFromRef(team), checked: true };
            }),
            listeners: {
                change: this._addChart,
                scope: this
            }
        });
    },

    _addChart: function () {
        if(this.down('rallychart')) {
            this.down('rallychart').destroy();
        }
        this.add({
            xtype: 'rallychart',
            flex: 1,
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: this._getStoreConfig(),
            calculatorType: 'CFDCalculator',
            calculatorConfig: {
                stateFieldName: 'ScheduleState',
                stateFieldValues: this.scheduleStateValues,
                preliminaryEstimates: this.preliminaryEstimates,
                startDate: _.min(_.compact(_.invoke(this.chapters, 'get', 'ActualStartDate'))),
                endDate: _.max(_.compact(_.invoke(this.chapters, 'get', 'PlannedEndDate'))),
                chapters: this.chapters,
                enableProjects: true
            },
            chartConfig: this._getChartConfig(),
            chartColors: ['#848689'].concat(Rally.ui.chart.Chart.prototype.chartColors)
        });
    },

    _getStoreConfig: function () {
        return {
            find: {
                _TypeHierarchy: { '$in': [ 'HierarchicalRequirement', 'PortfolioItem/Chapter'] },
                _ItemHierarchy: { '$in': _.invoke(this.chapters, 'getId')},
                _ProjectHierarchy: { '$in': Ext.Array.from(this.down('checkboxgroup').getValue().project)}
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
        var totalAcceptedPoints = _.reduce(this.chapters, function(total, chapter) {
            return total + chapter.get('AcceptedLeafStoryPlanEstimateTotal');
        },  0);
        var totalPoints = _.reduce(this.chapters, function(total, chapter) {
            var leafPlanTotal = chapter.get('LeafStoryPlanEstimateTotal');
            var prelimEstValue = _.find(this.preliminaryEstimates, function(preliminaryEstimate) {
                return Rally.util.Ref.getRelativeUri(preliminaryEstimate) === Rally.util.Ref.getRelativeUri(chapter.get('PreliminaryEstimate'));
            });
            return total + Math.max(leafPlanTotal, prelimEstValue.get('Value'));
        },  0, this);

        return {
            chart: {
                zoomType: 'xy'
            },
            title: {
                text: 'Milestone Cumulative Flow'
            },
            subtitle: {
                text: Ext.Number.toFixed(((totalAcceptedPoints / totalPoints) * 100), 2) + ' % of ' + totalPoints + ' Total Points Completed'
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
