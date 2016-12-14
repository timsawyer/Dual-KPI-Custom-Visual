/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {

    export interface IDualKpiDataPoint {
        date: Date;
        value: number;
    }

    export interface IDualKpiData {
        // data bound
        topChartName: string;
        bottomChartName: string;
        topValues: Array<IDualKpiDataPoint>;
        bottomValues: Array<IDualKpiDataPoint>;
        topValueAsPercent: boolean;
        bottomValueAsPercent: boolean;
        warningState: number;

        // formatting pane
        title: string;
        abbreviateValues: boolean;
        topChartToolTipText: string;
        bottomChartToolTipText: string;
        errorTooltipText: string;
        showStaleDataWarning: boolean;
        staleDataTooltipText: string;
        staleDataThreshold: number;
        topPercentCalcDate: Date;
        bottomPercentCalcDate: Date;

        dataColor: string;
        textColor: string;
        opacity: number;

        topChartAxisMin: number;
        topChartAxisMax: number;
        bottomChartAxisMin: number;
        bottomChartAxisMax: number;
        topChartZeroLine: boolean;
        bottomChartZeroLine: boolean;


        topChartType: string;
        bottomChartType: string;
    }

    export interface IAxisConfig {
        min: number;
        max: number;
    };

    export enum DualKpiSize {
        extrasmall,
        small,
        medium,
        large
    };

    export class DualKpi implements IVisual {

        private static defaultValues = {
            titleText: "Title",
            abbreviateValues: false,
            topChartToolTipText: "",
            bottomChartToolTipText: "",
            errorTooltipText: "Error",
            showStaleDataWarning: true,
            staleDataTooltipText: "",
            staleDataThreshold: 2,
            topPercentCalcDate: null,
            bottomPercentCalcDate: null,

            dataColor: "#01b8aa",
            textColor: "#212121",
            opacity: 30,

            topChartAxisMin: null,
            topChartAxisMax: null,
            bottomChartAxisMin: null,
            bottomChartAxisMax: null,
            topChartZeroLine: false,
            bottomChartZeroLine: false,

            topChartType: "area",
            bottomChartType: "area"
        };

        private static properties = {
            titleText:              { objectName: "dualKpiProperties", propertyName: "titleText" },
            abbreviateValues:       { objectName: "dualKpiProperties", propertyName: "abbreviateValues" },
            topChartToolTipText:    { objectName: "dualKpiProperties", propertyName: "topChartToolTipText" },
            bottomChartToolTipText: { objectName: "dualKpiProperties", propertyName: "bottomChartToolTipText" },
            errorTooltipText:       { objectName: "dualKpiProperties", propertyName: "errorTooltipText" },
            showStaleDataWarning:   { objectName: "dualKpiProperties", propertyName: "showStaleDataWarning" },
            staleDataTooltipText:   { objectName: "dualKpiProperties", propertyName: "staleDataTooltipText" },
            staleDataThreshold:     { objectName: "dualKpiProperties", propertyName: "staleDataThreshold" },
            topPercentCalcDate:     { objectName: "dualKpiProperties", propertyName: "topPercentCalcDate" },
            bottomPercentCalcDate:  { objectName: "dualKpiProperties", propertyName: "bottomPercentCalcDate" },

            dataColor:              { objectName: "dualKpiColors", propertyName: "dataColor" },
            textColor:              { objectName: "dualKpiColors", propertyName: "textColor" },
            opacity:                { objectName: "dualKpiColors", propertyName: "opacity" },

            topChartAxisMin:        { objectName: "dualKpiAxis", propertyName: "topChartAxisMin" },
            topChartAxisMax:        { objectName: "dualKpiAxis", propertyName: "topChartAxisMax" },
            bottomChartAxisMin:     { objectName: "dualKpiAxis", propertyName: "bottomChartAxisMin" },
            bottomChartAxisMax:     { objectName: "dualKpiAxis", propertyName: "bottomChartAxisMax" },
            topChartZeroLine:       { objectName: "dualKpiAxis", propertyName: "topChartZeroLine" },
            bottomChartZeroLine:    { objectName: "dualKpiAxis", propertyName: "bottomChartZeroLine" },

            topChartType:           { objectName: "dualKpiChart", propertyName: "topChartType" },
            bottomChartType:        { objectName: "dualKpiChart", propertyName: "bottomChartType" }
        };

        private dataView: DataView;
        private data: IDualKpiData;
        private target: HTMLElement;
        private size: DualKpiSize;
        private sizeCssClass: string;
        private svgRoot: d3.Selection<SVGElement>;
        private bottomContainer: d3.Selection<SVGElement>;
        private mobileTooltip: d3.Selection<SVGElement>;
        private valueFormatter: Function;
        private commaNumberFormatter: Function;
        private timeFormatter: Function;
        private dataBisector: Function;

        private chartLeftMargin = 30;
        private touchEventsEnabled: boolean = false;

        constructor(options: VisualConstructorOptions) {
            this.target = options.element;
            d3.select(this.target.parentNode).attr("style", "-webkit-tap-highlight-color: transparent;");
            this.svgRoot = d3.select(this.target).append("svg").attr("class", "dualKpi");
            this.size = DualKpiSize.small;
            this.sizeCssClass = "small";
            this.valueFormatter = d3.format(".3s");
            this.commaNumberFormatter = d3.format(",");
            this.timeFormatter = d3.time.format("%m/%d/%y");
            this.dataBisector = d3.bisector((d: IDualKpiDataPoint) => { return d.date; }).left;
        }

        public update(options: VisualUpdateOptions) {
            this.svgRoot.selectAll("*").remove();
            this.dataView = options.dataViews[0];

            if (this.dataView && this.dataView.metadata && this.dataView.metadata.columns) {
                this.data = this.converter(this.dataView);

                let availableHeight = options.viewport.height < 90 ? 90 : options.viewport.height,
                    availableWidth = options.viewport.width < 220 ? 220 : options.viewport.width,
                    chartWidth = availableWidth,
                    chartSpaceBetween, chartTitleSpace, iconOffset;

                if (availableHeight >= 450) {
                    this.size = DualKpiSize.large;
                    this.sizeCssClass = "large";
                    iconOffset = -1;
                    chartSpaceBetween = 25;
                    chartTitleSpace = 46;
                }
                else if (availableHeight >= 280) {
                    this.size = DualKpiSize.medium;
                    this.sizeCssClass = "medium";
                    iconOffset = -8;
                    chartSpaceBetween = 20;
                    chartTitleSpace = 30;
                }
                else if (availableHeight >= 120) {
                    this.size = DualKpiSize.small;
                    this.sizeCssClass = "small";
                    iconOffset = -6;
                    chartSpaceBetween = 15;
                    chartTitleSpace = 22;
                }
                else {
                    this.size = DualKpiSize.extrasmall;
                    this.sizeCssClass = "extra-small";
                    iconOffset = -8;
                    chartSpaceBetween = 6;
                    chartTitleSpace = 18;
                }

                this.svgRoot.attr("width", availableWidth)
                            .attr("height", availableHeight);

                let chartHeight = (availableHeight - (chartSpaceBetween + chartTitleSpace)) / 2;
                let topChartAxisConfig = { min: this.data.topChartAxisMin, max: this.data.topChartAxisMax };
                let bottomChartAxisConfig = { min: this.data.bottomChartAxisMin, max: this.data.bottomChartAxisMax };

                let topChartPercentChangeStartPoint = this.getPercentChangeStartPoint(this.data.topValues, this.data.topPercentCalcDate);
                let bottomChartPercentChangeStartPoint = this.getPercentChangeStartPoint(this.data.bottomValues, this.data.bottomPercentCalcDate);

                // draw top chart
                this.drawChart( 0, chartWidth, chartHeight, this.data.topValues,
                                this.data.topChartName, this.data.topValueAsPercent,
                                this.data.topChartToolTipText, topChartAxisConfig,
                                topChartPercentChangeStartPoint, this.data.abbreviateValues,
                                this.data.topChartType, this.data.topChartZeroLine
                            );
                // draw bottom chart
                this.drawChart( chartHeight + chartSpaceBetween, chartWidth,
                                chartHeight, this.data.bottomValues, this.data.bottomChartName,
                                this.data.bottomValueAsPercent, this.data.bottomChartToolTipText,
                                bottomChartAxisConfig, bottomChartPercentChangeStartPoint,
                                this.data.abbreviateValues, this.data.bottomChartType, this.data.bottomChartZeroLine
                            );

                this.drawBottomContainer(chartWidth, chartHeight, chartTitleSpace, chartSpaceBetween, iconOffset);
            }
        }

        public destroy(): void {
            this.svgRoot.selectAll("*").remove();
            this.data = null;
            this.dataView = null;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
            let instances: VisualObjectInstance[] = [];
            switch (options.objectName) {
                case "dualKpiProperties":
                    let dualKpiProperties: VisualObjectInstance = {
                        objectName: "dualKpiProperties",
                        displayName: "Dual KPI Properties",
                        selector: null,
                        properties: {
                            titleText:              DualKpi.getTitleText(this.dataView),
                            abbreviateValues:       DualKpi.getAbbreviateValues(this.dataView),
                            topChartToolTipText:    DualKpi.getTopChartToolTipText(this.dataView),
                            bottomChartToolTipText: DualKpi.getBottomChartToolTipText(this.dataView),
                            errorTooltipText:       DualKpi.getErrorTooltipText(this.dataView),
                            showStaleDataWarning:   DualKpi.getShowStaleDataWarning(this.dataView),
                            staleDataTooltipText:   DualKpi.getStaleDataTooltipText(this.dataView),
                            staleDataThreshold:     DualKpi.getStaleDataThreshold(this.dataView),
                            topPercentCalcDate:     DualKpi.getTopPercentCalcDate(this.dataView),
                            bottomPercentCalcDate:  DualKpi.getBottomPercentCalcDate(this.dataView)
                        }
                    };
                    instances.push(dualKpiProperties);
                    break;
                case "dualKpiColors":
                    let dualKpiColors: VisualObjectInstance = {
                        objectName: "dualKpiColors",
                        displayName: "Dual KPI Colors",
                        selector: null,
                        properties: {
                            dataColor:  DualKpi.getDataColor(this.dataView),
                            textColor:  DualKpi.getTextColor(this.dataView),
                            opacity:    DualKpi.getOpacity(this.dataView)
                        }
                    };
                    instances.push(dualKpiColors);
                    break;
                case "dualKpiAxis":
                    let dualKpiAxis: VisualObjectInstance = {
                        objectName: "dualKpiAxis",
                        displayName: "Dual KPI Axis Settings",
                        selector: null,
                        properties: {
                            topChartAxisMin:        DualKpi.getTopChartAxisMin(this.dataView),
                            topChartAxisMax:        DualKpi.getTopChartAxisMax(this.dataView),
                            bottomChartAxisMin:     DualKpi.getBottomChartAxisMin(this.dataView),
                            bottomChartAxisMax:     DualKpi.getBottomChartAxisMax(this.dataView),
                            topChartZeroLine:       DualKpi.getTopChartZeroLine(this.dataView),
                            bottomChartZeroLine:    DualKpi.getBottomChartZeroLine(this.dataView)
                        }
                    };
                    instances.push(dualKpiAxis);
                    break;
                case "dualKpiChart":
                    let dualKpiChart: VisualObjectInstance = {
                        objectName: "dualKpiChart",
                        displayName: "Dual KPI Chart Types",
                        selector: null,
                        properties: {
                            topChartType:    DualKpi.getTopChartType(this.dataView),
                            bottomChartType: DualKpi.getBottomChartType(this.dataView)
                        }
                    };
                    instances.push(dualKpiChart);
                    break;
            }
            return instances;
        }

        private static getValue<T>(objects: DataViewObjects, property: any, defaultValue?: T): T {
            if (!objects || !objects[property.objectName]) {
                return defaultValue;
            }

            let objectOrMap = objects[property.objectName];
            let object = <DataViewObject>objectOrMap;
            let propertyValue = <T>object[property.propertyName];

            if (propertyValue === undefined) {
                return defaultValue;
            }

            return propertyValue;
        }

        private static getTitleText(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.titleText, DualKpi.defaultValues.titleText);
        }

        private static getAbbreviateValues(dataView: DataView): boolean {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.abbreviateValues, DualKpi.defaultValues.abbreviateValues);
        }

        private static getTopChartToolTipText(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.topChartToolTipText, DualKpi.defaultValues.topChartToolTipText);
        }

        private static getBottomChartToolTipText(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.bottomChartToolTipText, DualKpi.defaultValues.bottomChartToolTipText);
        }

        private static getErrorTooltipText(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.errorTooltipText, DualKpi.defaultValues.errorTooltipText);
        }

        private static getShowStaleDataWarning(dataView: DataView): boolean {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.showStaleDataWarning, DualKpi.defaultValues.showStaleDataWarning);
        }

        private static getStaleDataTooltipText(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.staleDataTooltipText, DualKpi.defaultValues.staleDataTooltipText);
        }

        private static getStaleDataThreshold(dataView: DataView): number {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.staleDataThreshold, DualKpi.defaultValues.staleDataThreshold);
        }

        private static getTopPercentCalcDate(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.topPercentCalcDate, DualKpi.defaultValues.topPercentCalcDate);
        }

        private static getBottomPercentCalcDate(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.bottomPercentCalcDate, DualKpi.defaultValues.bottomPercentCalcDate);
        }

        private static getDataColor(dataView: DataView): Fill {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.dataColor, { solid: { color: DualKpi.defaultValues.dataColor }});
        }

        private static getTextColor(dataView: DataView): Fill {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.textColor, { solid: { color: DualKpi.defaultValues.textColor }});
        }

        private static getOpacity(dataView: DataView): number {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.opacity, DualKpi.defaultValues.opacity);
        }

        private static getTopChartAxisMin(dataView: DataView): number {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.topChartAxisMin, DualKpi.defaultValues.topChartAxisMin);
        }

        private static getTopChartAxisMax(dataView: DataView): number {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.topChartAxisMax, DualKpi.defaultValues.topChartAxisMax);
        }

        private static getBottomChartAxisMin(dataView: DataView): number {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.bottomChartAxisMin, DualKpi.defaultValues.bottomChartAxisMin);
        }

        private static getBottomChartAxisMax(dataView: DataView): number {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.bottomChartAxisMax, DualKpi.defaultValues.bottomChartAxisMax);
        }

        private static getTopChartZeroLine(dataView: DataView): boolean {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.topChartZeroLine, DualKpi.defaultValues.topChartZeroLine);
        }

        private static getBottomChartZeroLine(dataView: DataView): boolean {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.bottomChartZeroLine, DualKpi.defaultValues.bottomChartZeroLine);
        }

        private static getTopChartType(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.topChartType, DualKpi.defaultValues.topChartType);
        }

        private static getBottomChartType(dataView: DataView): string {
            return dataView && dataView.metadata && DualKpi.getValue(dataView.metadata.objects, DualKpi.properties.bottomChartType, DualKpi.defaultValues.bottomChartType);
        }

        private getDaysBetween(date1: Date, date2: Date): number {
            let oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
            let dayRange = Math.round( Math.abs( date1.getTime() - date2.getTime() )  / oneDay);
            return dayRange;
        }

        private percentFormatter(value: number, showPlusMinus?: boolean): string {
            var prefix = value >= 0 ? "+" : "",
                valueString = (value * 100).toFixed(1) + "%";

            if (showPlusMinus) {
                valueString = prefix + valueString;
            }

            return valueString;
        }

        private getPercentChange(startValue: number, endValue: number): string {
            if (startValue === 0) {
                return "n/a";
            }

            let diff = endValue - startValue;
            let percentChange  = Math.abs(diff/startValue);

            if (endValue < startValue) {
                percentChange = percentChange * -1;
            }

            return this.percentFormatter(percentChange, true);
        }

        private getPercentChangeStartPoint(chartData: Array<IDualKpiDataPoint>, percentCalcDate: Date): IDualKpiDataPoint {
            if (percentCalcDate !== null) {
                let closestIndex = 0,
                    percentCalcDateTime = percentCalcDate.getTime(),
                    i, currTime;

                // keep track of closest date to configured date
                // as soon as we find a date that is more recent than configured date
                // break and use the last date that was older than configured date.
                // always break if we find a date that is exactly equal
                for (i = 0; i < chartData.length; i++) {
                    currTime = chartData[i].date.getTime();

                    if (currTime === percentCalcDateTime) {
                        closestIndex = i;
                        break;
                    }
                    else if (currTime < percentCalcDateTime) {
                        closestIndex = i;
                    }
                    else {
                        break;
                    }
                }
                return chartData[closestIndex];
            }

            return chartData[0];
        }

        private getFormatSymbol(format: string): string {
            let symbolPatterns: string[] = [
                "[$]",      // dollar sign
                "[€]",      // euro sign
                "[£]",      // british pound sign
                "[¥]",      // yen / yuan sign
                "[₩]",      // korean won sign
                "[%]",      // percent sign
            ];

            let symbolMatcher = new RegExp(symbolPatterns.join("|"), "g");
            let symbols = [];
            let match = symbolMatcher.exec(format);

            if (!match) {
                return undefined;
            }
            else {
                return match[0];
            }
        }

        private converter(dataView: DataView): IDualKpiData {
            let data = {} as IDualKpiData;
            let topValueFormatSymbol = "";
            let bottomValueFormatSymbol = "";

            data.topChartName = "";
            data.bottomChartName = "";
            data.topValues = [];
            data.bottomValues = [];
            data.warningState = 0;

            // get formatting pane values
            data.title = DualKpi.getTitleText(dataView);
            data.abbreviateValues = DualKpi.getAbbreviateValues(dataView);
            data.topChartToolTipText = DualKpi.getTopChartToolTipText(dataView);
            data.bottomChartToolTipText = DualKpi.getBottomChartToolTipText(dataView);
            data.errorTooltipText = DualKpi.getErrorTooltipText(dataView);
            data.showStaleDataWarning = DualKpi.getShowStaleDataWarning(dataView);
            data.staleDataTooltipText = DualKpi.getStaleDataTooltipText(dataView);
            data.staleDataThreshold = DualKpi.getStaleDataThreshold(dataView);

            data.dataColor = DualKpi.getDataColor(dataView).solid.color;
            data.textColor = DualKpi.getTextColor(dataView).solid.color;
            data.opacity = DualKpi.getOpacity(dataView);

            data.topChartAxisMin = DualKpi.getTopChartAxisMin(dataView);
            data.topChartAxisMax = DualKpi.getTopChartAxisMax(dataView);
            data.bottomChartAxisMin = DualKpi.getBottomChartAxisMin(dataView);
            data.bottomChartAxisMax = DualKpi.getBottomChartAxisMax(dataView);
            data.topChartZeroLine = DualKpi.getTopChartZeroLine(dataView);
            data.bottomChartZeroLine = DualKpi.getBottomChartZeroLine(dataView);

            data.topChartType = DualKpi.getTopChartType(dataView);
            data.bottomChartType = DualKpi.getBottomChartType(dataView);

            let axisCol = -1, topValuesCol = -1, bottomValuesCol = -1, warningStateCol = -1,
                topPercentDateCol = -1, bottomPercentDateCol = -1,
                rows = [],
                i;

            let metadataColumns = dataView.metadata.columns;
            for (let i = 0; i < metadataColumns.length; i++) {
                let col = metadataColumns[i];
                if (col.roles) {
                    // not else ifs because in a column can have multiple roles
                    if (col.roles["axis"])
                        axisCol = i;
                    if (col.roles["topvalues"]) {
                        topValuesCol = i;
                        data.topChartName = col.displayName;
                        topValueFormatSymbol = this.getFormatSymbol(col.format);
                    }
                    if (col.roles["bottomvalues"]) {
                        bottomValuesCol = i;
                        data.bottomChartName = col.displayName;
                        bottomValueFormatSymbol = this.getFormatSymbol(col.format);
                    }
                    if (col.roles["warningstate"]) {
                        warningStateCol = i;
                    }
                    if (col.roles["toppercentdate"]) {
                        topPercentDateCol = i;
                    }
                    if (col.roles["bottompercentdate"]) {
                        bottomPercentDateCol = i;
                    }
                }
            }

            if (dataView && dataView.table) {
                rows = dataView.table.rows;
            }

            data.topValueAsPercent = topValueFormatSymbol === "%" ? true : false;
            data.bottomValueAsPercent = bottomValueFormatSymbol === "%" ? true : false;

            // if percent dates are in data use that, otherwise get from formatting pane/default values
            data.topPercentCalcDate = topPercentDateCol > -1 && rows[0] ? new Date(rows[0][topPercentDateCol]) : new Date(DualKpi.getTopPercentCalcDate(dataView));
            data.bottomPercentCalcDate = bottomPercentDateCol > -1 && rows[0] ? new Date(rows[0][bottomPercentDateCol]) : new Date(DualKpi.getBottomPercentCalcDate(dataView));

            for (i = 0; i < rows.length; i++) {
                let date = axisCol > -1 ? new Date(rows[i][axisCol]) : new Date();
                let topValue = topValuesCol > -1 ? rows[i][topValuesCol] : 0;
                let bottomValue = bottomValuesCol > -1 ? rows[i][bottomValuesCol] : 0;

                if (data.topValueAsPercent) {
                    topValue *= 100;
                }

                if (data.bottomValueAsPercent) {
                    bottomValue *= 100;
                }

                data.topValues.push({
                    date: date,
                    value: topValue
                });

                data.bottomValues.push({
                    date: date,
                    value: bottomValue
                });
            }

            if (warningStateCol) {
                data.warningState = rows[rows.length -1][warningStateCol];
            }
            return data;
        }

        private createHoverDataContainer(chartBottom: number, chartLeft: number, chartWidth: number): d3.Selection<SVGElement> {
            let hoverDataContainer = this.svgRoot.append("g")
                                        .attr("class", "hover-data-container")
                                        .classed("invisible", true);

            let hoverValue = hoverDataContainer.append("text")
                .attr("class", "hover-text date")
                .classed(this.sizeCssClass, true)
                .attr("fill", this.data.textColor)
                .text("0");

            hoverDataContainer.append("text")
                .attr("class", "hover-text value")
                .classed(this.sizeCssClass, true)
                .attr("text-anchor", "middle")
                .attr("transform", "translate(" + (chartWidth/2) + ",0)")
                .attr("fill", this.data.textColor)
                .text("0");

            hoverDataContainer.append("text")
                .attr("class", "hover-text percent")
                .classed(this.sizeCssClass, true)
                .attr("text-anchor", "end")
                .text("0")
                .attr("fill", this.data.textColor)
                .attr("transform", "translate(" + (chartWidth) + ",0)");

            let hoverValueHeight = (hoverValue.node() as SVGTextElement).getBBox().height;
            hoverDataContainer.attr("transform", "translate(" + chartLeft + "," + (chartBottom + hoverValueHeight - 2)  + ")");

            return hoverDataContainer;
        }

        /*
        *   to show tooltip information on mobile we show a popup on touch event
        */
        private showMobileTooltip(message: string) {
            if (!this.mobileTooltip) {
                this.mobileTooltip = d3.select(this.target).append("div")
                    .classed({"hidden": true, "mobile-tooltip": true});

                this.svgRoot.on("touchstart", () => {
                    this.hideMobileTooltip();
                });

                this.mobileTooltip.on("touchstart", () => {
                    this.hideMobileTooltip();
                });

                this.touchEventsEnabled = true;
            }
            // prevent hide from being called, and prevent hover interaction from occuring on same event
            console.log("stopping prop");
            (d3.event as TouchEvent).stopPropagation();

            this.mobileTooltip.html(message);
            this.mobileTooltip.classed("hidden", false);
        }

        private hideMobileTooltip() {
            this.mobileTooltip.classed("hidden", true);
        }

        private showHoverData(hoverDataContainer: d3.Selection<SVGElement>, dataPoint: IDualKpiDataPoint, latestValue: number, valueAsPercent: boolean, abbreviateValue: boolean) {
            hoverDataContainer.select(".hover-text.date")
                .datum(dataPoint)
                .text((d: IDualKpiDataPoint) => this.timeFormatter(d.date));

            hoverDataContainer.select(".hover-text.value")
                .datum(dataPoint)
                .text((d: IDualKpiDataPoint) => {
                    let value = abbreviateValue ? this.valueFormatter(d.value) : this.commaNumberFormatter(Math.round(d.value));
                    if (valueAsPercent) {
                        return this.percentFormatter(value / 100);
                    }
                    return value;
                });

            hoverDataContainer.select(".hover-text.percent")
                .datum(dataPoint)
                .text((d: IDualKpiDataPoint) => {
                    return this.getPercentChange(d.value, latestValue) + " since";
                });

            this.bottomContainer.classed("hidden", true);
            hoverDataContainer.classed("invisible", false);
        }

        private hideHoverData(hoverDataContainer: d3.Selection<SVGElement>) {
            hoverDataContainer.classed("invisible", true);
            this.bottomContainer.classed("hidden", false);
        }

        private drawBottomContainer(chartWidth: number, chartHeight: number, chartTitleSpace: number, chartSpaceBetween: number, iconOffset: number): void {
            let warningIconShowing = false;
            let infoIconShowing = false;

            this.bottomContainer = this.svgRoot.append("g")
                .attr("class", "bottom-title-container")
                .classed("invisible", true);

            let chartTitleElement = this.bottomContainer.append("text")
                .attr("class", "title")
                .classed(this.sizeCssClass, true)
                .text(this.data.title);

            let chartTitleElementWidth = (chartTitleElement.node() as SVGTextElement).getBBox().width;
            let chartTitleElementHeight = (chartTitleElement.node() as SVGTextElement).getBBox().height;
            let iconWidth = 22;
            let iconScaleTransform = "";
            let iconY = (-chartTitleSpace + (chartTitleSpace/2) + iconOffset);

            if (this.size === DualKpiSize.small || this.size === DualKpiSize.extrasmall) {
                iconScaleTransform = "scale(0.75)";
                iconWidth = 16;
            }

            // add warning icon
            if (this.data.warningState < 0) {
                let warningGroup = this.bottomContainer.append("g")
                .attr("transform", "translate(0," + (iconY) + ")");

                warningGroup.append("path")
                    .attr("d", "M24,24H8l8-16L24,24z M9.7,23h12.6L16,10.4L9.7,23z M16.5,19.8h-1v-5.4h1V19.8z M16.5,20.8v1.1h-1v-1.1H16.5z")
                    .attr("fill", "#E81123")
                    .attr("stroke", "transparent")
                    .attr("stroke-width", "5") // fills in path so that title tooltip will show
                    .attr("class", "warning-icon")
                    .attr("transform", iconScaleTransform)
                    .classed(this.sizeCssClass, true)
                    .append("title")
                            .text(this.data.errorTooltipText);

                // move title over to account for icon
                chartTitleElement.attr("transform", "translate(" + (iconWidth + 6) + ",0)");

                warningGroup.on("touchstart", () => this.showMobileTooltip(this.data.errorTooltipText));
            }

            // add info icon
            let today = new Date();
            let dataDaysOld = this.getDaysBetween(this.data.topValues[this.data.topValues.length-1].date, today);
            if(dataDaysOld >= this.data.staleDataThreshold && this.data.showStaleDataWarning) {
                infoIconShowing = true;
                let infoMessage = "Data is " + dataDaysOld + " days old. " + this.data.staleDataTooltipText;
                let infoGroup = this.bottomContainer.append("g")
                    .attr("transform", "translate(" + (chartWidth - iconWidth - 8) + "," + (iconY) + ")");

                infoGroup.append("path")
                    .attr("d", "M24,16c0,1.4-0.4,2.8-1,4c-0.7,1.2-1.7,2.2-2.9,2.9c-1.2,0.7-2.5,1-4,1s-2.8-0.4-4-1c-1.2-0.7-2.2-1.7-2.9-2.9 C8.4,18.8,8,17.4,8,16c0-1.5,0.4-2.8,1.1-4c0.8-1.2,1.7-2.2,2.9-2.9S14.6,8,16,8s2.8,0.3,4,1.1c1.2,0.7,2.2,1.7,2.9,2.9 C23.6,13.2,24,14.5,24,16z M12.6,22c1.1,0.6,2.2 0.9,3.4,0.9s2.4-0.3,3.5-0.9c1-0.6,1.9-1.5,2.5-2.6c0.6-1,1-2.2,1-3.4 s-0.3-2.4-1-3.5s-1.5-1.9-2.5-2.5c-1.1-0.6-2.2-1-3.5-1s-2.4,0.4-3.4,1c-1.1,0.6-1.9,1.4-2.6,2.5c-0.6,1.1-0.9,2.2-0.9,3.5 c0,1.2,0.3,2.4,0.9,3.4C10.6,20.5,11.4,21.4,12.6,22z M16.5,17.6h-1v-5.4h1V17.6z M16.5 19.7h-1v-1.1h1V19.7z")
                    .attr("fill", "#3599B8")
                    .attr("stroke", "transparent")
                    .attr("stroke-width", "5") // fills in path so that title tooltip will show
                    .attr("class", "info-icon")
                    .attr("transform", iconScaleTransform)
                    .classed(this.sizeCssClass, true)
                    .append("title")
                        .text(infoMessage);

                infoGroup.on("touchstart", () => this.showMobileTooltip(infoMessage));
             }

            // add day range text
            let dayRange = this.getDaysBetween(this.data.topValues[0].date, this.data.topValues[this.data.topValues.length-1].date);
            let dayRangeElement = this.bottomContainer.append("text")
                .attr("class", "date-range-text")
                .classed(this.sizeCssClass, true)
                .attr("text-anchor", "end")
                .text("last " + dayRange + " days");

            let dayRangeElementWidth = (dayRangeElement.node() as SVGTextElement).getBBox().width;
            let dayRangeLeft = chartWidth - 8;
            if(infoIconShowing) {
                dayRangeLeft -= (iconWidth);// width of icon + 8px padding
            }
            dayRangeElement.attr("transform", "translate(" + (dayRangeLeft) + ",0)");

            this.bottomContainer.attr("transform", "translate(5," + ((chartHeight * 2) + chartSpaceBetween + chartTitleElementHeight) + ")")
            this.bottomContainer.classed("invisible", false);
        }

        private drawChart(  top: number, width: number, height: number, chartData: Array<IDualKpiDataPoint>,
                            chartTitle: string, valueAsPercent: boolean, tooltipText: string,
                            axisConfig: IAxisConfig, percentChangeStartPoint: IDualKpiDataPoint,
                            abbreviateValue: boolean, chartType: string, showZeroLine: boolean): void
        {
            let axisNumberFormatter = d3.format(".2s");
            let latestValue = chartData[chartData.length-1].value;

            let margin = {top: 5, right: 0, bottom: 0, left: this.chartLeftMargin};
            if(this.size === DualKpiSize.medium || this.size === DualKpiSize.large) {
                margin.left = 40;
            }

            let calcWidth = width - margin.right - margin.left,
                calcHeight = height - margin.top - margin.bottom,
                minValue = d3.min(chartData, (d) => d.value),
                maxValue = d3.max(chartData, (d) => d.value);

            let axisMinValue = axisConfig.min !== null ? axisConfig.min : minValue;
            let axisMaxValue = axisConfig.max !== null ? axisConfig.max : maxValue;

            let chartGroup = this.svgRoot.append("g")
                    .attr("transform", "translate(" + margin.left + "," + (top + margin.top) + ")");

            let xScale = d3.time.scale()
                .domain(d3.extent(chartData, (d) => d.date))
                .range([0, calcWidth]);

            let yScale = d3.scale.linear()
                .domain([axisMinValue, axisMaxValue])
                .range([calcHeight, 0]);

            let yAxis = d3.svg.axis()
                .scale(yScale)
                .tickValues([axisMinValue, axisMaxValue])
                .tickFormat((d) => {
                    let axisTickLabel = String(axisNumberFormatter(d));
                    if (valueAsPercent) {
                        axisTickLabel = axisTickLabel + "%";
                    }
                    return axisTickLabel;
                })
                .orient("left");

            let seriesRenderer, fill, stroke, strokeWidth;

            if (chartType === "area"){
                seriesRenderer = d3.svg.area()
                    .x((d: any) => xScale(d.date))
                    .y0(calcHeight)
                    .y1((d: any) => yScale(d.value));

                fill = this.data.dataColor;
                stroke = "none";
                strokeWidth = 0;
            }
            else {
                seriesRenderer = d3.svg.line()
                    .x((d: any) => xScale(d.date))
                    .y((d: any) => yScale(d.value));

                fill = "none";
                stroke = this.data.dataColor;
                strokeWidth = 2;
            }

            chartGroup.append("path")
                .datum(chartData)
                .attr("class", "area")
                .attr("style", "opacity: " + (this.data.opacity / 100))
                .attr("fill", fill)
                .attr("stroke", stroke)
                .attr("stroke-width", strokeWidth)
                .attr("d", seriesRenderer as any);

            // DRAW line for x axis at zero position
            if (showZeroLine) {
                let axisLine = d3.svg.line()
                    .x((d: any) => xScale(d.date))
                    .y((d: any) => yScale(0));

                chartGroup.append("path")
                    .datum(chartData)
                    .attr("class", "zero-axis")
                    .attr("d", axisLine as any);
            }

            chartGroup.append("g")
                .attr("class", "axis")
                .classed(this.sizeCssClass, true)
                .call(yAxis);

            /* Add elements for hover behavior ******************************************************/
            let hoverLine = chartGroup.append("rect")
                .classed("hidden", true)
                .attr("width", 1)
                .attr("height", calcHeight)
                .attr("fill", "#777");

            let chartBottom = top + margin.top + calcHeight;
            let chartLeft = margin.left;
            let hoverDataContainer = this.createHoverDataContainer(chartBottom, chartLeft, calcWidth);

            let mousemove = (e: any) => {
                console.log(e.type);
                let leftPosition = e.clientX - margin.left;
                let topPosition = e.clientY;

                if (e.type === "touchmove" || e.type === "touchstart") {
                    leftPosition = e.touches[0].clientX - this.chartLeftMargin;
                    topPosition = e.touches[0].clientY;
                }

                if(leftPosition > 0 && leftPosition < width && topPosition < (height*2 + 15)) {
                    hoverLine.classed("hidden", false);
                    hoverLine.attr("transform", "translate(" + leftPosition + ",0)");

                    let x = xScale.invert(leftPosition)
                    let i = this.dataBisector(chartData, x, 1);
                    let dataPoint = chartData[i];

                    if (dataPoint) {
                        this.showHoverData(hoverDataContainer, dataPoint, latestValue, valueAsPercent, abbreviateValue);
                    }
                }
                else {
                    hoverLine.classed("hidden", true);
                    this.hideHoverData(hoverDataContainer);
                }
            };

            this.target.addEventListener("mousemove", mousemove);
            this.target.addEventListener("touchmove", mousemove);
            this.target.addEventListener("touchstart", mousemove);

            let mouseout = (e: MouseEvent) => {
                hoverLine.classed("hidden", true);
                this.hideHoverData(hoverDataContainer);
            };

            this.target.addEventListener("mouseout", mouseout, true);
            this.target.addEventListener("touchleave", mouseout, true);

            /* ADD OVERLAY TEXT ********************************************/
            let percentChange = this.getPercentChange(percentChangeStartPoint.value, chartData[chartData.length-1].value);
            let formattedValue = abbreviateValue ? this.valueFormatter(latestValue) : this.commaNumberFormatter(Math.round(latestValue));

            if (valueAsPercent) {
                formattedValue = this.percentFormatter(latestValue / 100);
                // if value is a percent, only show difference changed, not percent of percent
                percentChange = this.percentFormatter((chartData[chartData.length-1].value - percentChangeStartPoint.value) / 100, true);
            }

            let chartOverlayTextGroup = chartGroup.append("g");
            let dataTitle = chartOverlayTextGroup.append("text")
                .classed("invisible", true)
                .attr("class", "data-title")
                .classed(this.sizeCssClass, true)
                .attr("fill", this.data.textColor)
                .text(chartTitle + " (" + percentChange + ")");

            let dataValue = chartOverlayTextGroup.append("text")
                .classed("invisible", true)
                .attr("class", "data-value")
                .classed(this.sizeCssClass, true)
                .attr("fill", this.data.textColor)
                .text(formattedValue);

            let dataTitleHeight = (dataTitle.node() as SVGTextElement).getBBox().height;
            let dataValueHeight = (dataValue.node() as SVGTextElement).getBBox().height;
            let verticalCentering = (calcHeight / 2) - dataTitleHeight; // bump slightly above perfectly vertically centered on chart

            // calc horizontal centering
            let dataTitleWidth = (dataTitle.node() as SVGTextElement).getBBox().width;
            let dataValueWidth = (dataValue.node() as SVGTextElement).getBBox().width;
            let dataTitleHorzCentering = ((calcWidth/2)) - (dataTitleWidth/2);
            let dataValueHorzCentering = ((calcWidth/2)) - (dataValueWidth/2);

            // apply centerings, then unhide text
            dataTitle.attr("transform", "translate(" + dataTitleHorzCentering + ",0)");
            dataValue.attr("transform", "translate(" + dataValueHorzCentering + "," + (dataValueHeight * 10 / 11) + ")");
            chartOverlayTextGroup.attr("transform", "translate(0," + verticalCentering + ")");
            dataTitle.classed("invisible", false);
            dataValue.classed("invisible", false);

            // set rect dimensions
            // add rect to overlay section so that tooltip shows up more easily
            let overlayRect = chartOverlayTextGroup.append("rect").attr("style", "stroke: none; fill: #000;opacity:0;");

            // add tooltip
            let percentChangeDesc = percentChange + " change since " + this.timeFormatter(percentChangeStartPoint.date);
            let overlayTooltipText = tooltipText + " " + percentChangeDesc;
            overlayRect.append("title").text(overlayTooltipText);
            overlayRect.attr("width", dataTitleWidth)
                .attr("height", dataTitleHeight + dataValueHeight)
                .attr("transform", "translate(" + dataTitleHorzCentering + "," + (-dataTitleHeight) + ")");

            overlayRect.on("touchstart", () => this.showMobileTooltip(overlayTooltipText));
            overlayRect.on("mousemove", () => {
                if (this.touchEventsEnabled) {
                    (d3.event as Event).stopPropagation();
                }
            });
        }


    }  /*close IVisual*/
} /*close export*/