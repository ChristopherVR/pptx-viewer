import { XmlObject, type PptxTableData, type PptxChartData, type PptxChartSeries } from "../../types";
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
        let chartTypeKey = Object.keys(plotArea).find((key) =>
          this.compatibilityService.getXmlLocalName(key).endsWith("Chart"),
        );
        if (!chartTypeKey) continue;

        let chartTypeContainer = plotArea[chartTypeKey] as
          | XmlObject
          | undefined;
        if (!chartTypeContainer) continue;

        // ── Handle chart type change ──────────────────────────────
        const expectedXmlTag = this.chartTypeToXmlTag(chartData.chartType);
        const currentLocalName = this.compatibilityService.getXmlLocalName(chartTypeKey);
        if (expectedXmlTag && currentLocalName !== expectedXmlTag) {
          // Move the container to a new key under plotArea
          const newKey = `c:${expectedXmlTag}`;
          (plotArea as XmlObject)[newKey] = chartTypeContainer;
          delete (plotArea as XmlObject)[chartTypeKey];
          chartTypeKey = newKey;
        }

        // Update grouping mode
        const groupingKey = Object.keys(chartTypeContainer).find(
          (key) =>
            this.compatibilityService.getXmlLocalName(key) === "grouping",
        );
        if (chartData.grouping) {
          if (groupingKey) {
            (chartTypeContainer[groupingKey] as XmlObject)["@_val"] =
              chartData.grouping;
          } else {
            // Insert grouping element if the chart type supports it
            chartTypeContainer["c:grouping"] = { "@_val": chartData.grouping };
          }
        } else if (groupingKey) {
          // Remove grouping if it was cleared (e.g. switching to pie)
          delete chartTypeContainer[groupingKey];
        }

        // ── Update series data ────────────────────────────────────
        const seriesNodes = this.xmlLookupService.getChildrenArrayByLocalName(
          chartTypeContainer,
          "ser",
        );

        // Find the key used for series elements in the XML
        const seriesKey = Object.keys(chartTypeContainer).find(
          (key) => this.compatibilityService.getXmlLocalName(key) === "ser",
        ) ?? "c:ser";

        // Update existing series that are present in both XML and data
        const commonCount = Math.min(seriesNodes.length, chartData.series.length);
        for (let si = 0; si < commonCount; si++) {
          const seriesNode = seriesNodes[si];
          const seriesData = chartData.series[si];

          // Update series index
          const idxNode = this.xmlLookupService.getChildByLocalName(
            seriesNode,
            "idx",
          );
          if (idxNode) {
            idxNode["@_val"] = String(si);
          }
          const orderNode = this.xmlLookupService.getChildByLocalName(
            seriesNode,
            "order",
          );
          if (orderNode) {
            orderNode["@_val"] = String(si);
          }

          // Update series name
          const txNode = this.xmlLookupService.getChildByLocalName(
            seriesNode,
            "tx",
          );
          if (txNode) {
            this.updateChartCacheValues(txNode, false, [seriesData.name]);
          }

          // Update category labels on every series (not just the first)
          const catNode =
            this.xmlLookupService.getChildByLocalName(seriesNode, "cat") ||
            this.xmlLookupService.getChildByLocalName(seriesNode, "xVal");
          if (catNode) {
            this.updateChartCacheValues(catNode, false, chartData.categories);
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

        // ── Add new series (when data has more series than XML) ───
        if (chartData.series.length > seriesNodes.length) {
          // Use the last existing series as a template, or build minimal
          const templateSeries = seriesNodes.length > 0
            ? seriesNodes[seriesNodes.length - 1]
            : undefined;

          const newSeriesXmlNodes: XmlObject[] = [];
          for (let si = seriesNodes.length; si < chartData.series.length; si++) {
            const seriesData = chartData.series[si];
            const newNode = this.buildNewSeriesXml(
              si,
              seriesData,
              chartData.categories,
              templateSeries,
            );
            newSeriesXmlNodes.push(newNode);
          }

          // Append new series to the container
          const existingSeriesArray = Array.isArray(chartTypeContainer[seriesKey])
            ? (chartTypeContainer[seriesKey] as XmlObject[])
            : chartTypeContainer[seriesKey]
              ? [chartTypeContainer[seriesKey] as XmlObject]
              : [];
          chartTypeContainer[seriesKey] = [
            ...existingSeriesArray,
            ...newSeriesXmlNodes,
          ];
        }

        // ── Remove excess series (when data has fewer series than XML)
        if (chartData.series.length < seriesNodes.length) {
          const existingSeriesArray = Array.isArray(chartTypeContainer[seriesKey])
            ? (chartTypeContainer[seriesKey] as XmlObject[])
            : chartTypeContainer[seriesKey]
              ? [chartTypeContainer[seriesKey] as XmlObject]
              : [];

          chartTypeContainer[seriesKey] = existingSeriesArray.slice(
            0,
            chartData.series.length,
          );
          // If only one series remains, unwrap from array for XML builder
          if (chartData.series.length === 1) {
            chartTypeContainer[seriesKey] = (
              chartTypeContainer[seriesKey] as XmlObject[]
            )[0];
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

        // Update pivotSource (c:pivotSource) — preserve or insert
        if (chartData.pivotSource) {
          const existingPivotSource =
            this.xmlLookupService.getChildByLocalName(
              chartSpace,
              "pivotSource",
            );
          if (existingPivotSource) {
            // Update name text
            const nameNode = this.xmlLookupService.getChildByLocalName(
              existingPivotSource,
              "name",
            );
            if (nameNode) {
              // Update text content — fast-xml-parser uses #text for text nodes
              nameNode["#text"] = chartData.pivotSource.name;
            }
            // Update fmtId
            if (chartData.pivotSource.formatId !== undefined) {
              const fmtIdNode = this.xmlLookupService.getChildByLocalName(
                existingPivotSource,
                "fmtId",
              );
              if (fmtIdNode) {
                fmtIdNode["@_val"] = String(chartData.pivotSource.formatId);
              }
            }
          } else {
            // Insert new c:pivotSource element into chartSpace
            const pivotSourceXml: XmlObject = {
              "c:name": { "#text": chartData.pivotSource.name },
            };
            if (chartData.pivotSource.formatId !== undefined) {
              pivotSourceXml["c:fmtId"] = {
                "@_val": String(chartData.pivotSource.formatId),
              };
            }
            (chartSpace as XmlObject)["c:pivotSource"] = pivotSourceXml;
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

  // ---------------------------------------------------------------------------
  // Chart type / series helpers for save pipeline
  // ---------------------------------------------------------------------------

  /**
   * Map a {@link PptxChartType} to the OOXML element local name for the
   * chart type container (e.g. `"bar"` &rarr; `"barChart"`).
   *
   * Returns `undefined` for types that cannot be expressed as a classic
   * `c:*Chart` element (e.g. Office 2016+ cx: chart types).
   */
  protected chartTypeToXmlTag(
    chartType: PptxChartData["chartType"],
  ): string | undefined {
    const map: Partial<Record<PptxChartData["chartType"], string>> = {
      bar: "barChart",
      bar3D: "bar3DChart",
      line: "lineChart",
      line3D: "line3DChart",
      pie: "pieChart",
      pie3D: "pie3DChart",
      doughnut: "doughnutChart",
      area: "areaChart",
      area3D: "area3DChart",
      scatter: "scatterChart",
      bubble: "bubbleChart",
      radar: "radarChart",
      stock: "stockChart",
      surface: "surfaceChart",
    };
    return map[chartType];
  }

  /**
   * Build a minimal `<c:ser>` XML object for a newly-added series.
   *
   * If a `templateSeries` is provided, it is deep-cloned and its data is
   * replaced with the new series data. Otherwise, a minimal structure is
   * built from scratch.
   */
  protected buildNewSeriesXml(
    seriesIndex: number,
    seriesData: PptxChartSeries,
    categories: string[],
    templateSeries?: XmlObject,
  ): XmlObject {
    if (templateSeries) {
      // Deep-clone the template
      const clone = JSON.parse(JSON.stringify(templateSeries)) as XmlObject;

      // Update idx / order
      const idxNode = this.xmlLookupService.getChildByLocalName(clone, "idx");
      if (idxNode) idxNode["@_val"] = String(seriesIndex);
      const orderNode = this.xmlLookupService.getChildByLocalName(clone, "order");
      if (orderNode) orderNode["@_val"] = String(seriesIndex);

      // Update series name
      const txNode = this.xmlLookupService.getChildByLocalName(clone, "tx");
      if (txNode) {
        this.updateChartCacheValues(txNode, false, [seriesData.name]);
      }

      // Update categories
      const catNode =
        this.xmlLookupService.getChildByLocalName(clone, "cat") ||
        this.xmlLookupService.getChildByLocalName(clone, "xVal");
      if (catNode) {
        this.updateChartCacheValues(catNode, false, categories);
      }

      // Update values
      const valNode =
        this.xmlLookupService.getChildByLocalName(clone, "val") ||
        this.xmlLookupService.getChildByLocalName(clone, "yVal");
      if (valNode) {
        this.updateChartCacheValues(
          valNode,
          true,
          seriesData.values.map(String),
        );
      }

      // Update colour
      if (seriesData.color) {
        const spPr = this.xmlLookupService.getChildByLocalName(clone, "spPr");
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
          } else {
            spPr["a:solidFill"] = {
              "a:srgbClr": {
                "@_val": seriesData.color.replace("#", ""),
              },
            };
          }
        }
      }

      return clone;
    }

    // Build minimal series XML from scratch
    const colorHex = (seriesData.color || "#4472C4").replace("#", "");
    const ser: XmlObject = {
      "c:idx": { "@_val": String(seriesIndex) },
      "c:order": { "@_val": String(seriesIndex) },
      "c:tx": {
        "c:strRef": {
          "c:strCache": {
            "c:ptCount": { "@_val": "1" },
            "c:pt": { "@_idx": "0", "c:v": seriesData.name },
          },
        },
      },
      "c:spPr": {
        "a:solidFill": {
          "a:srgbClr": { "@_val": colorHex },
        },
      },
      "c:cat": {
        "c:strRef": {
          "c:strCache": {
            "c:ptCount": { "@_val": String(categories.length) },
            "c:pt": buildChartPoints(categories),
          },
        },
      },
      "c:val": {
        "c:numRef": {
          "c:numCache": {
            "c:formatCode": "General",
            "c:ptCount": { "@_val": String(seriesData.values.length) },
            "c:pt": buildChartPoints(seriesData.values.map(String)),
          },
        },
      },
    };

    return ser;
  }
}
