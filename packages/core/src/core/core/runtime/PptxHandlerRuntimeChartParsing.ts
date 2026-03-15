import { XmlObject, type PptxChartData, type PptxExternalData, type PptxEmbeddedWorkbookData } from "../../types";
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
import { parseEmbeddedXlsx } from "../../utils/chart-xlsx-parser";

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

    // Parse plotVisOnly (c:plotVisOnly) — defaults to true when absent
    const plotVisibleOnly = this.parsePlotVisOnly(chartRoot);

    // Parse external data source (c:externalData)
    const externalData = await this.parseChartExternalData(
      chartSpace,
      chartPart.partPath,
    );

    // Parse embedded xlsx workbook if available
    const embeddedWorkbookData = await this.parseEmbeddedWorkbook(externalData);

    // Parse Office 2013+ chart color style (chartColorStyle*.xml)
    const chartColorStyle = await this.parseChartColorStyle(chartPartPath);

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
      ...(externalData ? { externalData } : {}),
      ...(embeddedWorkbookData ? { embeddedWorkbookData } : {}),
      ...(plotVisibleOnly !== undefined ? { plotVisibleOnly } : {}),
      ...(chartColorStyle?.palette
        ? { colorPalette: chartColorStyle.palette }
        : {}),
      ...(chartColorStyle?.method
        ? { colorMethod: chartColorStyle.method }
        : {}),
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
  private async parseCxChart(
    plotArea: XmlObject,
    chartType: PptxChartData["chartType"],
    chartSpace: XmlObject | undefined,
    chartRoot: XmlObject | undefined,
    chartPartPath: string,
    chartRelationshipId: string,
  ): Promise<PptxChartData | undefined> {
    const result = parseCxChartSeries(plotArea, this.xmlLookupService);
    if (!result) return undefined;

    const titleNode = this.xmlLookupService.getChildByLocalName(
      chartRoot,
      "title",
    );
    const titleTextValues: string[] = [];
    this.collectLocalTextValues(titleNode, "t", titleTextValues);
    const chartStyle = this.extractChartStyle(chartSpace, chartRoot);

    // Merge hasDataLabels from cx: data labels parsing
    if (result.hasDataLabels && chartStyle) {
      chartStyle.hasDataLabels = true;
    }

    // Parse plotVisOnly (c:plotVisOnly) — defaults to true when absent
    const plotVisibleOnly = this.parsePlotVisOnly(chartRoot);

    // Parse external data source (c:externalData)
    const externalData = await this.parseChartExternalData(
      chartSpace,
      chartPartPath,
    );

    // Parse embedded xlsx workbook if available
    const embeddedWorkbookData = await this.parseEmbeddedWorkbook(externalData);

    // Parse Office 2013+ chart color style (chartColorStyle*.xml)
    const chartColorStyle = await this.parseChartColorStyle(chartPartPath);

    return {
      chartType,
      categories: result.categories,
      series: result.series,
      title: titleTextValues[0],
      style: chartStyle,
      chartPartPath,
      chartRelationshipId,
      ...(externalData ? { externalData } : {}),
      ...(embeddedWorkbookData ? { embeddedWorkbookData } : {}),
      ...(plotVisibleOnly !== undefined ? { plotVisibleOnly } : {}),
      ...(chartColorStyle?.palette
        ? { colorPalette: chartColorStyle.palette }
        : {}),
      ...(chartColorStyle?.method
        ? { colorMethod: chartColorStyle.method }
        : {}),
    };
  }

  /**
   * Parse `c:plotVisOnly` from the chart root element.
   *
   * The `c:plotVisOnly` element controls whether hidden cells are plotted.
   * - `val="1"` or `val="true"` or absent → only visible data is plotted (returns `true`)
   * - `val="0"` or `val="false"` → hidden data IS plotted (returns `false`)
   *
   * Returns `undefined` when the element is absent (caller defaults to `true`).
   */
  private parsePlotVisOnly(
    chartRoot: XmlObject | undefined,
  ): boolean | undefined {
    if (!chartRoot) return undefined;

    const plotVisOnlyNode = this.xmlLookupService.getChildByLocalName(
      chartRoot,
      "plotVisOnly",
    );
    if (!plotVisOnlyNode) return undefined;

    const val = plotVisOnlyNode["@_val"];
    if (val === "0" || val === "false" || val === false) return false;
    return true;
  }

  /**
   * Parse `c:externalData` from the chart's `c:chartSpace` and resolve
   * the external relationship target from the chart part's .rels file.
   *
   * In OOXML, `c:externalData` contains `@r:id` referencing a relationship
   * in the chart part's own .rels file with `TargetMode="External"`, typically
   * pointing to an external Excel workbook.
   */
  private async parseChartExternalData(
    chartSpace: XmlObject | undefined,
    chartPartPath: string,
  ): Promise<PptxExternalData | undefined> {
    if (!chartSpace) return undefined;

    const externalDataNode = this.xmlLookupService.getChildByLocalName(
      chartSpace,
      "externalData",
    );
    if (!externalDataNode) return undefined;

    const relId = String(
      externalDataNode["@_r:id"] || externalDataNode["@_id"] || "",
    ).trim();
    if (relId.length === 0) return undefined;

    // autoUpdate can appear as a child element <c:autoUpdate val="1"/> or as
    // a direct attribute autoUpdate="1" on the c:externalData element itself.
    const autoUpdateNode = this.xmlLookupService.getChildByLocalName(
      externalDataNode,
      "autoUpdate",
    );
    const autoUpdateAttr = externalDataNode["@_autoUpdate"];
    const autoUpdate = autoUpdateNode?.["@_val"] === "1" ||
      autoUpdateNode?.["@_val"] === "true" ||
      autoUpdateAttr === "1" ||
      autoUpdateAttr === "true" ||
      false;

    // Resolve the external target from the chart part's .rels file
    let targetPath: string | undefined;
    try {
      const chartDir = chartPartPath.substring(
        0,
        chartPartPath.lastIndexOf("/") + 1,
      );
      const chartFileName = chartPartPath.substring(
        chartPartPath.lastIndexOf("/") + 1,
      );
      const chartRelsPath = `${chartDir}_rels/${chartFileName}.rels`;
      const chartRelsXml = await this.zip
        .file(chartRelsPath)
        ?.async("string");
      if (chartRelsXml) {
        const chartRelsData = this.parser.parse(chartRelsXml) as XmlObject;
        const relsContainer = chartRelsData?.Relationships as
          | XmlObject
          | undefined;
        if (relsContainer?.Relationship) {
          const rels = Array.isArray(relsContainer.Relationship)
            ? relsContainer.Relationship
            : [relsContainer.Relationship];
          for (const rel of rels) {
            if (String(rel?.["@_Id"] || "") === relId) {
              targetPath = String(rel?.["@_Target"] || "").trim() || undefined;
              break;
            }
          }
        }
      }
    } catch {
      // Chart rels file may not exist; that's fine
    }

    // Attempt to read embedded xlsx workbook from the ZIP archive
    let embeddedWorkbookData: Uint8Array | undefined;
    if (targetPath) {
      try {
        const embeddingPath = this.resolveImagePath(chartPartPath, targetPath);
        if (embeddingPath.includes("embeddings/") && embeddingPath.endsWith(".xlsx")) {
          const xlsxBinary = await this.zip
            .file(embeddingPath)
            ?.async("uint8array");
          if (xlsxBinary) {
            embeddedWorkbookData = xlsxBinary;
          }
        }
      } catch {
        // Embedded workbook may not be accessible; continue without it
      }
    }

    return {
      relId,
      targetPath,
      autoUpdate,
      ...(embeddedWorkbookData ? { embeddedWorkbookData } : {}),
    };
  }

  /**
   * Read and parse the embedded xlsx workbook referenced by chart external data.
   *
   * When an embedded xlsx binary is available in the external data reference,
   * this method uses the chart-xlsx-parser utility to extract structured
   * categories and series from the first worksheet.
   */
  private async parseEmbeddedWorkbook(
    externalData: PptxExternalData | undefined,
  ): Promise<PptxEmbeddedWorkbookData | undefined> {
    if (!externalData?.embeddedWorkbookData) return undefined;
    try {
      return await parseEmbeddedXlsx(externalData.embeddedWorkbookData);
    } catch {
      return undefined;
    }
  }

  /**
   * Read the chart part's `.rels` file and return all relationships as an
   * array of `{ id, type, target }` objects.
   */
  private async readChartRels(
    chartPartPath: string,
  ): Promise<Array<{ id: string; type: string; target: string }>> {
    try {
      const chartDir = chartPartPath.substring(
        0,
        chartPartPath.lastIndexOf("/") + 1,
      );
      const chartFileName = chartPartPath.substring(
        chartPartPath.lastIndexOf("/") + 1,
      );
      const chartRelsPath = `${chartDir}_rels/${chartFileName}.rels`;
      const chartRelsXml = await this.zip
        .file(chartRelsPath)
        ?.async("string");
      if (!chartRelsXml) return [];

      const chartRelsData = this.parser.parse(chartRelsXml) as XmlObject;
      const relsContainer = chartRelsData?.Relationships as
        | XmlObject
        | undefined;
      if (!relsContainer?.Relationship) return [];

      const rels = Array.isArray(relsContainer.Relationship)
        ? relsContainer.Relationship
        : [relsContainer.Relationship];

      return rels
        .filter((rel): rel is XmlObject => Boolean(rel))
        .map((rel) => ({
          id: String(rel["@_Id"] || "").trim(),
          type: String(rel["@_Type"] || "").trim(),
          target: String(rel["@_Target"] || "").trim(),
        }));
    } catch {
      return [];
    }
  }

  /**
   * Parse the Office 2013+ chart color style part (`chartColorStyle*.xml`)
   * referenced from the chart's relationships.
   *
   * The color style XML contains `<cs:colorStyle meth="cycle" id="10">` with
   * child `<a:schemeClr val="accent1"/>` elements that define the ordered
   * color palette.
   *
   * Returns `{ palette, method }` where `palette` is an array of resolved hex
   * colors, or `undefined` when no color style is found.
   */
  private async parseChartColorStyle(
    chartPartPath: string,
  ): Promise<
    | {
        palette: string[];
        method: PptxChartData["colorMethod"];
      }
    | undefined
  > {
    try {
      const rels = await this.readChartRels(chartPartPath);

      // Find the chartColorStyle relationship
      // Type URIs seen in the wild:
      //   http://schemas.microsoft.com/office/2014/relationships/chartColorStyle
      //   http://schemas.microsoft.com/office/2011/relationships/chartColorStyle
      const colorStyleRel = rels.find(
        (r) =>
          r.type.includes("chartColorStyle") ||
          r.type.includes("chartColor"),
      );
      if (!colorStyleRel) return undefined;

      // Resolve the color style XML path relative to the chart part
      const colorStylePath = this.resolveImagePath(
        chartPartPath,
        colorStyleRel.target,
      );
      const colorStyleXml = await this.zip
        .file(colorStylePath)
        ?.async("string");
      if (!colorStyleXml) return undefined;

      const parsed = this.parser.parse(colorStyleXml) as XmlObject;

      // The root element is <cs:colorStyle> (may appear with or without
      // namespace prefix)
      const colorStyle =
        this.xmlLookupService.getChildByLocalName(parsed, "colorStyle") ??
        parsed;

      // Read the method attribute: "cycle" | "withinLinear" | "acrossLinear"
      const methodStr = String(
        colorStyle["@_meth"] || "cycle",
      ).trim() as PptxChartData["colorMethod"];
      const method: PptxChartData["colorMethod"] =
        methodStr === "withinLinear" || methodStr === "acrossLinear"
          ? methodStr
          : "cycle";

      // Collect all scheme color and explicit color children
      const palette: string[] = [];
      this.collectColorStylePalette(colorStyle, palette);

      if (palette.length === 0) return undefined;

      return { palette, method };
    } catch {
      return undefined;
    }
  }

  /**
   * Traverse a `<cs:colorStyle>` element and extract ordered palette colors.
   *
   * Child elements can be:
   * - `<a:schemeClr val="accent1"/>` — resolved via theme color map
   * - `<a:srgbClr val="4472C4"/>` — explicit RGB
   */
  private collectColorStylePalette(
    node: XmlObject | undefined,
    output: string[],
  ): void {
    if (!node) return;

    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("@_")) continue;
      const localName = this.compatibilityService.getXmlLocalName(key);

      if (localName === "schemeClr") {
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) {
          const resolved = this.resolveChartSchemeColor(item);
          if (resolved) output.push(resolved);
        }
      } else if (localName === "srgbClr") {
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) {
          const hex = String(
            typeof item === "object" && item !== null
              ? (item as XmlObject)["@_val"]
              : item ?? "",
          ).trim();
          if (hex.length > 0) {
            output.push(hex.startsWith("#") ? hex : `#${hex}`);
          }
        }
      }
    }
  }

  /**
   * Resolve a scheme color reference (`<a:schemeClr val="accent1"/>`) to a
   * concrete hex color using the presentation theme color map.
   */
  private resolveChartSchemeColor(
    schemeClrNode: unknown,
  ): string | undefined {
    if (!schemeClrNode) return undefined;

    let val: string;
    if (typeof schemeClrNode === "string") {
      val = schemeClrNode;
    } else if (typeof schemeClrNode === "object" && schemeClrNode !== null) {
      val = String(
        (schemeClrNode as XmlObject)["@_val"] || "",
      ).trim();
    } else {
      return undefined;
    }

    if (val.length === 0) return undefined;

    // Look up in theme color map (same mechanism as SmartArt color resolution)
    const mapped = this.themeColorMap[val];
    if (mapped) return mapped.startsWith("#") ? mapped : `#${mapped}`;

    return undefined;
  }
}
