import { XmlObject, type PptxChartData } from "../../types";
import {
  parseSeriesTrendlines,
  parseSeriesErrBars,
  parseDataTable,
  parseLineStyle,
} from "../../utils/chart-advanced-parser";
import {
  parseSeriesDataPoints,
  parseSeriesDataLabels,
  parseSeriesExplosion,
  parseMarker,
} from "../../utils/chart-series-detail-parser";
import {
  parseChartAxes,
  parseChart3DSurfaces,
} from "../../utils/chart-axis-parser";
import { parseCxChartSeries } from "../../utils/chart-cx-parser";

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeChartDetection";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  public async getChartDataForGraphicFrame(
    slidePath: string,
    graphicFrame: XmlObject | undefined,
  ): Promise<PptxChartData | undefined> {
    const graphicData = this.xmlLookupService.getChildByLocalName(
      this.xmlLookupService.getChildByLocalName(graphicFrame, "graphic"),
      "graphicData",
    );
    const chartReference = this.xmlLookupService.getChildByLocalName(
      graphicData,
      "chart",
    );
    const chartRelationshipId = String(chartReference?.["@_r:id"] || "").trim();
    if (chartRelationshipId.length === 0) return undefined;

    const chartPart = await this.readXmlPartByRelationshipId(
      slidePath,
      chartRelationshipId,
    );
    if (!chartPart) return undefined;

    const chartSpace = this.xmlLookupService.getChildByLocalName(
      chartPart.xml,
      "chartSpace",
    );
    const chartRoot = this.xmlLookupService.getChildByLocalName(
      chartSpace,
      "chart",
    );
    const plotArea = this.xmlLookupService.getChildByLocalName(
      chartRoot,
      "plotArea",
    );
    if (!plotArea) return undefined;

    const chartType = this.detectChartType(plotArea);
    const seriesContainerKey = Object.keys(plotArea).find((key) =>
      this.compatibilityService.getXmlLocalName(key).endsWith("Chart"),
    );

    // cx: namespace (Office 2016+) charts use plotAreaRegion instead of *Chart
    if (!seriesContainerKey) {
      return this.parseCxChart(
        plotArea, chartType, chartSpace, chartRoot, chartPart.partPath,
        chartRelationshipId,
      );
    }

    const seriesContainer = plotArea[seriesContainerKey] as
      | XmlObject
      | undefined;
    const seriesList = this.xmlLookupService.getChildrenArrayByLocalName(
      seriesContainer,
      "ser",
    );
    if (seriesList.length === 0) return undefined;

    const categoriesFromFirstSeries = this.extractChartPointValues(
      this.xmlLookupService.getChildByLocalName(seriesList[0], "cat"),
      false,
    );
    const categories = categoriesFromFirstSeries.length
      ? categoriesFromFirstSeries
      : this.extractChartPointValues(
          this.xmlLookupService.getChildByLocalName(seriesList[0], "xVal"),
          false,
        );

    const series = this.buildChartSeries(seriesList, categories);

    const titleNode = this.xmlLookupService.getChildByLocalName(
      chartRoot,
      "title",
    );
    const titleTextValues: string[] = [];
    this.collectLocalTextValues(titleNode, "t", titleTextValues);

    // Extract chart styling
    const chartStyle = this.extractChartStyle(chartSpace, chartRoot);

    // Extract grouping mode (bar/line/area)
    let grouping: PptxChartData["grouping"];
    const groupingNode = this.xmlLookupService.getChildByLocalName(
      seriesContainer,
      "grouping",
    );
    if (groupingNode?.["@_val"]) {
      const groupingVal = String(groupingNode["@_val"]).trim();
      if (groupingVal === "stacked") grouping = "stacked";
      else if (groupingVal === "percentStacked") grouping = "percentStacked";
      else grouping = "clustered";
    }

    // Store the chart part path for round-trip save
    const chartPartPath = chartPart.partPath;

    // Parse data table (c:dTable)
    const dataTable = parseDataTable(plotArea, this.xmlLookupService);
    // Parse drop lines (c:dropLines) and hi-low lines (c:hiLowLines)
    const lineStyleColorAdapter = {
      parseColor: (n: XmlObject | undefined, p?: string) =>
        this.parseColor(n, p),
    };
    const dropLines = parseLineStyle(
      seriesContainer,
      "dropLines",
      this.xmlLookupService,
      lineStyleColorAdapter,
    );
    const hiLowLines = parseLineStyle(
      seriesContainer,
      "hiLowLines",
      this.xmlLookupService,
      lineStyleColorAdapter,
    );

    // Parse axis formatting (c:catAx, c:valAx, c:dateAx, c:serAx)
    const axes = parseChartAxes(
      plotArea,
      this.xmlLookupService,
      lineStyleColorAdapter,
      (key: string) => this.compatibilityService.getXmlLocalName(key),
    );

    // Parse 3D surfaces (c:floor, c:sideWall, c:backWall)
    const surfaces = chartRoot
      ? parseChart3DSurfaces(
          chartRoot,
          this.xmlLookupService,
          lineStyleColorAdapter,
        )
      : {};

    return {
      chartType,
      categories,
      series,
      title: titleTextValues[0],
      style: chartStyle,
      grouping,
      chartPartPath,
      chartRelationshipId,
      ...(dataTable ? { dataTable } : {}),
      ...(dropLines ? { dropLines } : {}),
      ...(hiLowLines ? { hiLowLines } : {}),
      ...(axes.length > 0 ? { axes } : {}),
      ...(surfaces.floor ? { floor: surfaces.floor } : {}),
      ...(surfaces.sideWall ? { sideWall: surfaces.sideWall } : {}),
      ...(surfaces.backWall ? { backWall: surfaces.backWall } : {}),
    };
  }

  private buildChartSeries(
    seriesList: XmlObject[],
    categories: string[],
  ): PptxChartData["series"] {
    return seriesList.map((seriesNode, seriesIndex) => {
      const seriesName = this.extractChartSeriesName(seriesNode);
      const values = this.extractChartPointValues(
        this.xmlLookupService.getChildByLocalName(seriesNode, "val") ||
          this.xmlLookupService.getChildByLocalName(seriesNode, "yVal"),
        true,
      )
        .map((value) => Number.parseFloat(value))
        .filter((value) => Number.isFinite(value));

      const seriesShapeProperties = this.xmlLookupService.getChildByLocalName(
        seriesNode,
        "spPr",
      );
      const seriesColor = this.parseColor(
        this.xmlLookupService.getChildByLocalName(
          seriesShapeProperties,
          "solidFill",
        ),
      );

      const fallbackValues =
        values.length > 0
          ? values
          : categories.map((_, index) => index + 1 + seriesIndex);

      // Parse trendlines (c:trendline)
      const colorAdapter = {
        parseColor: (n: XmlObject | undefined, p?: string) =>
          this.parseColor(n, p),
      };
      const trendlines = parseSeriesTrendlines(
        seriesNode,
        this.xmlLookupService,
        colorAdapter,
      );
      // Parse error bars (c:errBars)
      const errBars = parseSeriesErrBars(
        seriesNode,
        this.xmlLookupService,
        this.extractChartPointValues.bind(this),
      );

      // Parse data points (c:dPt)
      const dataPoints = parseSeriesDataPoints(
        seriesNode,
        this.xmlLookupService,
        colorAdapter,
      );

      // Parse series marker (c:marker)
      const seriesMarker = parseMarker(
        this.xmlLookupService.getChildByLocalName(seriesNode, 'marker'),
        this.xmlLookupService,
        colorAdapter,
      );

      // Parse individual data labels (c:dLbl)
      const dataLabels = parseSeriesDataLabels(
        seriesNode,
        this.xmlLookupService,
      );

      // Parse series-level explosion (c:explosion for pie)
      const explosion = parseSeriesExplosion(
        seriesNode,
        this.xmlLookupService,
      );

      return {
        name:
          seriesName.trim().length > 0
            ? seriesName
            : `Series ${seriesIndex + 1}`,
        values: fallbackValues,
        color: seriesColor,
        ...(trendlines.length > 0 ? { trendlines } : {}),
        ...(errBars.length > 0 ? { errBars } : {}),
        ...(dataPoints.length > 0 ? { dataPoints } : {}),
        ...(seriesMarker ? { marker: seriesMarker } : {}),
        ...(dataLabels.length > 0 ? { dataLabels } : {}),
        ...(explosion !== undefined ? { explosion } : {}),
      };
    });
  }

  /**
   * Parse a cx: namespace (Office 2016+) chart using the utility parser.
   */
  private parseCxChart(
    plotArea: XmlObject,
    chartType: PptxChartData["chartType"],
    chartSpace: XmlObject | undefined,
    chartRoot: XmlObject | undefined,
    chartPartPath: string,
    chartRelationshipId: string,
  ): PptxChartData | undefined {
    const result = parseCxChartSeries(plotArea, this.xmlLookupService);
    if (!result) return undefined;

    const titleNode = this.xmlLookupService.getChildByLocalName(
      chartRoot,
      "title",
    );
    const titleTextValues: string[] = [];
    this.collectLocalTextValues(titleNode, "t", titleTextValues);
    const chartStyle = this.extractChartStyle(chartSpace, chartRoot);

    return {
      chartType,
      categories: result.categories,
      series: result.series,
      title: titleTextValues[0],
      style: chartStyle,
      chartPartPath,
      chartRelationshipId,
    };
  }
}
