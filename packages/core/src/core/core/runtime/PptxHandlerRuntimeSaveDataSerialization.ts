import { XmlObject, type PptxTableData, type PptxChartData } from "../../types";
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from "./PptxHandlerRuntimeSaveTableStyles";
import {
  buildChartPoints,
  replaceFirstTextValueInTree,
  serializeCellMergeAttributes,
  serializeTablePropertyFlags,
} from "./save-table-merge-helpers";
import { rebuildTableXmlFromData } from "./table-structural-ops";

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
  /**
   * Serialise modified `PptxTableData` back into the graphic frame's
   * raw XML so that the round-tripped file preserves edits.
   *
   * When the number of rows or columns in `PptxTableData` differs from the
   * existing XML (i.e. structural changes were made), the `<a:tblGrid>` and
   * `<a:tr>` elements are rebuilt from scratch. Otherwise, the method
   * updates cells in place, preserving the original XML structure.
   */
  protected serializeTableDataToXml(
    shape: XmlObject,
    tableData: PptxTableData,
  ): void {
    try {
      const graphicData = shape["a:graphic"]?.["a:graphicData"] as
        | XmlObject
        | undefined;
      const tbl = graphicData?.["a:tbl"];
      if (!tbl) return;

      // ── Serialize table-level properties (tblPr) ──────────────
      serializeTablePropertyFlags(tbl as XmlObject, tableData);

      // ── Detect structural changes (row/column count mismatch) ──
      const xmlRows = this.ensureArray(tbl["a:tr"]);
      const xmlColCount = this.ensureArray(
        (tbl as XmlObject)["a:tblGrid"]?.["a:gridCol"],
      ).length;
      const dataRowCount = tableData.rows.length;
      const dataColCount = tableData.columnWidths.length;

      const structureChanged =
        dataRowCount !== xmlRows.length || dataColCount !== xmlColCount;

      if (structureChanged) {
        // Rebuild the entire table grid and rows from PptxTableData
        rebuildTableXmlFromData(
          tbl as XmlObject,
          tableData,
          PptxHandlerRuntime.EMU_PER_PX,
          this.ensureArray.bind(this),
        );

        // After rebuilding, apply text and style to all cells
        const rebuiltRows = this.ensureArray((tbl as XmlObject)["a:tr"]);
        for (let rIdx = 0; rIdx < tableData.rows.length; rIdx++) {
          const dataRow = tableData.rows[rIdx];
          const xmlRow = rebuiltRows[rIdx] as XmlObject | undefined;
          if (!xmlRow) continue;

          const xmlCells = this.ensureArray(xmlRow["a:tc"]);
          for (let cIdx = 0; cIdx < dataRow.cells.length; cIdx++) {
            const cell = dataRow.cells[cIdx];
            const xmlCell = xmlCells[cIdx] as XmlObject | undefined;
            if (!xmlCell) continue;

            if (cell.text !== undefined) {
              this.writeTableCellText(xmlCell, cell.text);
            }
            if (cell.style) {
              this.writeTableCellStyle(xmlCell, cell.style);
            }
          }
        }
        return;
      }

      // ── No structural change: update cells in place ──
      for (
        let rIdx = 0;
        rIdx < Math.min(tableData.rows.length, xmlRows.length);
        rIdx++
      ) {
        const dataRow = tableData.rows[rIdx];
        const xmlRow = xmlRows[rIdx] as XmlObject;

        // Update row height
        if (dataRow.height !== undefined && dataRow.height > 0) {
          xmlRow["@_h"] = String(
            Math.round(dataRow.height * PptxHandlerRuntime.EMU_PER_PX),
          );
        }

        const xmlCells = this.ensureArray(xmlRow["a:tc"]);
        for (
          let cIdx = 0;
          cIdx < Math.min(dataRow.cells.length, xmlCells.length);
          cIdx++
        ) {
          const cell = dataRow.cells[cIdx];
          const xmlCell = xmlCells[cIdx] as XmlObject;

          // Serialize cell merge attributes
          serializeCellMergeAttributes(xmlCell, cell);

          // Update text
          if (cell.text !== undefined) {
            this.writeTableCellText(xmlCell, cell.text);
          }

          // Update cell style
          if (cell.style) {
            this.writeTableCellStyle(xmlCell, cell.style);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to serialize table data:", e);
    }
  }

  /** Pending chart data updates to process in the async save method. */
  protected pendingChartUpdates?: Array<{
    chartData: PptxChartData;
    slidePath: string;
  }>;

  /**
   * Collect chart data for deferred async processing during save.
   */
  protected serializeChartDataToXml(
    chartData: PptxChartData,
    _slidePath: string,
  ): void {
    if (!chartData.chartPartPath) return;
    if (!this.pendingChartUpdates) {
      this.pendingChartUpdates = [];
    }
    this.pendingChartUpdates.push({ chartData, slidePath: _slidePath });
  }

  /**
   * Process all pending chart data updates (called from the async save method).
   */
  protected async processPendingChartUpdates(): Promise<void> {
    if (!this.pendingChartUpdates || this.pendingChartUpdates.length === 0)
      return;

    for (const { chartData } of this.pendingChartUpdates) {
      const chartPartPath = chartData.chartPartPath;
      if (!chartPartPath) continue;

      const chartFile = this.zip.file(chartPartPath);
      if (!chartFile) continue;

      try {
        const chartXmlStr = await chartFile.async("string");
        const chartXmlData = this.parser.parse(chartXmlStr) as XmlObject;

        const chartSpace = this.xmlLookupService.getChildByLocalName(
          chartXmlData,
          "chartSpace",
        );
        if (!chartSpace) continue;

        const chartRoot = this.xmlLookupService.getChildByLocalName(
          chartSpace,
          "chart",
        );
        if (!chartRoot) continue;

        const plotArea = this.xmlLookupService.getChildByLocalName(
          chartRoot,
          "plotArea",
        );
        if (!plotArea) continue;

        // Find the chart type container (e.g. c:barChart, c:lineChart)
        const chartTypeKey = Object.keys(plotArea).find((key) =>
          this.compatibilityService.getXmlLocalName(key).endsWith("Chart"),
        );
        if (!chartTypeKey) continue;

        const chartTypeContainer = plotArea[chartTypeKey] as
          | XmlObject
          | undefined;
        if (!chartTypeContainer) continue;

        // Update grouping mode
        if (chartData.grouping) {
          const groupingKey = Object.keys(chartTypeContainer).find(
            (key) =>
              this.compatibilityService.getXmlLocalName(key) === "grouping",
          );
          if (groupingKey) {
            (chartTypeContainer[groupingKey] as XmlObject)["@_val"] =
              chartData.grouping;
          }
        }

        // Update series data
        const seriesNodes = this.xmlLookupService.getChildrenArrayByLocalName(
          chartTypeContainer,
          "ser",
        );

        for (
          let si = 0;
          si < Math.min(seriesNodes.length, chartData.series.length);
          si++
        ) {
          const seriesNode = seriesNodes[si];
          const seriesData = chartData.series[si];

          // Update series name
          const txNode = this.xmlLookupService.getChildByLocalName(
            seriesNode,
            "tx",
          );
          if (txNode) {
            this.updateChartCacheValues(txNode, false, [seriesData.name]);
          }

          // Update category labels (on first series only)
          if (si === 0) {
            const catNode =
              this.xmlLookupService.getChildByLocalName(seriesNode, "cat") ||
              this.xmlLookupService.getChildByLocalName(seriesNode, "xVal");
            if (catNode) {
              this.updateChartCacheValues(catNode, false, chartData.categories);
            }
          }

          // Update values
          const valNode =
            this.xmlLookupService.getChildByLocalName(seriesNode, "val") ||
            this.xmlLookupService.getChildByLocalName(seriesNode, "yVal");
          if (valNode) {
            this.updateChartCacheValues(
              valNode,
              true,
              seriesData.values.map(String),
            );
          }

          // Update series colour
          if (seriesData.color) {
            const spPr = this.xmlLookupService.getChildByLocalName(
              seriesNode,
              "spPr",
            );
            if (spPr) {
              const solidFillKey = Object.keys(spPr).find(
                (k) =>
                  this.compatibilityService.getXmlLocalName(k) === "solidFill",
              );
              if (solidFillKey) {
                (spPr as XmlObject)[solidFillKey] = {
                  "a:srgbClr": {
                    "@_val": seriesData.color.replace("#", ""),
                  },
                };
              }
            }
          }
        }

        // Update chart title
        if (chartData.title !== undefined) {
          const titleNode = this.xmlLookupService.getChildByLocalName(
            chartRoot,
            "title",
          );
          if (titleNode) {
            this.replaceFirstTextValue(titleNode, "t", chartData.title);
          }
        }

        // Update external data autoUpdate attribute (c:externalData / c:autoUpdate)
        if (chartData.externalData?.autoUpdate !== undefined) {
          const externalDataNode =
            this.xmlLookupService.getChildByLocalName(
              chartSpace,
              "externalData",
            );
          if (externalDataNode) {
            // Update child element form: <c:autoUpdate val="0|1"/>
            const autoUpdateNode =
              this.xmlLookupService.getChildByLocalName(
                externalDataNode,
                "autoUpdate",
              );
            if (autoUpdateNode) {
              autoUpdateNode["@_val"] = chartData.externalData.autoUpdate
                ? "1"
                : "0";
            }
            // Also update direct attribute form if present
            if (externalDataNode["@_autoUpdate"] !== undefined) {
              externalDataNode["@_autoUpdate"] =
                chartData.externalData.autoUpdate ? "1" : "0";
            }
          }
        }

        // Update plotVisOnly (c:plotVisOnly)
        if (chartData.plotVisibleOnly !== undefined) {
          const plotVisOnlyNode =
            this.xmlLookupService.getChildByLocalName(
              chartRoot,
              "plotVisOnly",
            );
          const val = chartData.plotVisibleOnly ? "1" : "0";
          if (plotVisOnlyNode) {
            plotVisOnlyNode["@_val"] = val;
          } else {
            // Insert new c:plotVisOnly element into chartRoot
            (chartRoot as XmlObject)["c:plotVisOnly"] = { "@_val": val };
          }
        }

        // Update axis logBase (c:scaling/c:logBase)
        if (chartData.axes) {
          const axisTypeNames = ["valAx", "catAx", "dateAx", "serAx"] as const;
          for (const axisTypeName of axisTypeNames) {
            const axisNodes =
              this.xmlLookupService.getChildrenArrayByLocalName(
                plotArea,
                axisTypeName,
              );
            for (const axisNode of axisNodes) {
              const axIdNode = this.xmlLookupService.getChildByLocalName(
                axisNode,
                "axId",
              );
              const xmlAxisId = axIdNode
                ? parseInt(String(axIdNode["@_val"]), 10)
                : undefined;
              const matchingAxis = chartData.axes.find(
                (a) => a.axisId !== undefined && a.axisId === xmlAxisId,
              );
              if (!matchingAxis) continue;

              const scalingNode = this.xmlLookupService.getChildByLocalName(
                axisNode,
                "scaling",
              );
              if (!scalingNode) continue;

              if (matchingAxis.logBase !== undefined && matchingAxis.logBase > 0) {
                // Set or update logBase
                const logBaseKey = Object.keys(scalingNode).find(
                  (k) =>
                    this.compatibilityService.getXmlLocalName(k) === "logBase",
                );
                if (logBaseKey) {
                  (scalingNode[logBaseKey] as XmlObject)["@_val"] =
                    String(matchingAxis.logBase);
                } else {
                  (scalingNode as XmlObject)["c:logBase"] = {
                    "@_val": String(matchingAxis.logBase),
                  };
                }
              } else if (matchingAxis.logScale === false) {
                // Remove logBase if log scale was explicitly disabled
                const logBaseKey = Object.keys(scalingNode).find(
                  (k) =>
                    this.compatibilityService.getXmlLocalName(k) === "logBase",
                );
                if (logBaseKey) {
                  delete scalingNode[logBaseKey];
                }
              }
            }
          }
        }

        // Write updated chart XML back
        this.zip.file(chartPartPath, this.builder.build(chartXmlData));
      } catch (e) {
        console.warn(
          `[pptx-save] Failed to serialize chart data for ${chartPartPath}:`,
          e,
        );
      }
    }

    this.pendingChartUpdates = undefined;
  }

  /**
   * Update the cached point values in a chart reference node
   * (numRef/strRef or numLit/strLit).
   */
  protected updateChartCacheValues(
    container: XmlObject,
    isNumeric: boolean,
    values: string[],
  ): void {
    const refName = isNumeric ? "numRef" : "strRef";
    const litName = isNumeric ? "numLit" : "strLit";
    const cacheName = isNumeric ? "numCache" : "strCache";

    const refNode =
      this.xmlLookupService.getChildByLocalName(container, refName) ||
      this.xmlLookupService.getChildByLocalName(container, litName);
    if (!refNode) return;

    const cacheNode =
      this.xmlLookupService.getChildByLocalName(refNode, cacheName) || refNode;
    if (!cacheNode) return;

    // Update point count
    const ptCountNode = this.xmlLookupService.getChildByLocalName(
      cacheNode,
      "ptCount",
    );
    if (ptCountNode) {
      ptCountNode["@_val"] = String(values.length);
    }

    // Find the key used for pt elements
    const ptKey = Object.keys(cacheNode).find(
      (key) => this.compatibilityService.getXmlLocalName(key) === "pt",
    );
    if (!ptKey) return;

    // Rebuild point array
    cacheNode[ptKey] = buildChartPoints(values);
  }

  /** Replace the first text value found deep in the node tree. */
  protected replaceFirstTextValue(
    node: unknown,
    localName: string,
    newValue: string,
  ): boolean {
    return replaceFirstTextValueInTree(node, localName, newValue, (key) =>
      this.compatibilityService.getXmlLocalName(key),
    );
  }
}
