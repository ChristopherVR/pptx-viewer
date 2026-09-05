import { XmlObject } from '../../types';
import type {
	PptxChartChrome,
	PptxChartData,
	PptxChartOfPieOptions,
	PptxChartSeries,
	PptxChartView3D,
	PptxTableData,
} from '../../types';
import { applyChartAxisDisplayUnitsToXml } from '../../utils/chart-axis-dispunits-serializer';
import { applyChartAxisGridlinesToXml } from '../../utils/chart-axis-gridlines-serializer';
import { applyChartAxisLabelFormatting } from '../../utils/chart-axis-label-formatting';
import { applyChartAxisScaling, upsertChartAxisChild } from '../../utils/chart-axis-scaling';
import {
	applyChartAxisTitleToXml,
	applyChartAxisTitleStyleToXml,
} from '../../utils/chart-axis-title-serializer';
import { applyChartBandFmts } from '../../utils/chart-band-fmts';
import { applyBubbleChartOptions } from '../../utils/chart-bubble-options';
import { applyChartColorStyleXml } from '../../utils/chart-color-style-writer';
import {
	applyComboSeriesTypesToXml,
	consolidateComboContainersInXml,
} from '../../utils/chart-combo-serializer';
import {
	chartContainerAllows,
	chartTypeToContainerLocalName,
	isKnownChartContainer,
	normalizeChartContainerChildren,
	normalizeChartGroupingValue,
	orderChartContainerChildren,
	reconcileChartPlotAreaAxes,
	renameXmlKeyInPlace,
} from '../../utils/chart-container-schema';
import { isLineDrawnChartType } from '../../utils/chart-container-type-map';
import { buildChartExSpaceXml, canGenerateChartEx } from '../../utils/chart-cx-generator';
import { applyChartDataLabelsToXml } from '../../utils/chart-data-labels-serializer';
import { applyChartDataTable } from '../../utils/chart-data-table';
import { applySeriesDataPointsToXml } from '../../utils/chart-datapoint-serializer';
import { applyChartDateAxisUnits } from '../../utils/chart-date-axis';
import { applySeriesErrBarsToXml } from '../../utils/chart-errbars-serializer';
import { applyChartLayouts } from '../../utils/chart-layout';
import { applyChartLegendToXml } from '../../utils/chart-legend-serializer';
import { applySeriesMarkerToXml } from '../../utils/chart-marker-serializer';
import { applyChartPivotFormats } from '../../utils/chart-pivot-formats';
import { applyChartPivotSource } from '../../utils/chart-pivot-source';
import { applyChartPrintSettings } from '../../utils/chart-print-settings';
import { applyChartProtection } from '../../utils/chart-protection';
import { writeSeriesColorToSpPr } from '../../utils/chart-series-color-serializer';
import { applySeriesDataLabelsToXml } from '../../utils/chart-series-datalabel-serializer';
import {
	applyBar3DShapeToXml,
	applyGapDepthToXml,
	applyRadarStyleToXml,
	applySeriesBar3DShapeToXml,
	applySurfaceWireframeToXml,
} from '../../utils/chart-subtype-serializer';
import { applyChartTitleToXml } from '../../utils/chart-title-serializer';
import { applyChartTitleStyleToXml } from '../../utils/chart-title-style-serializer';
import { applySeriesTrendlinesToXml } from '../../utils/chart-trendline-serializer';
import { applyChartUpDownBars } from '../../utils/chart-up-down-bars';
import type { PptxChartWorkbookWrite } from '../../utils/chart-xlsx-writer';
import { collectChartWorkbookWrite } from '../../utils/chart-xlsx-writer';
import { xmlChild, xmlPath } from '../../utils/xml-access';
import { applyChartExUpdate, chartExLayoutChanged } from './chart-cx-update';
import { saveChartExternalWorkbookUpdates } from './chart-external-workbook-save';
import {
	detectChartPartFamily,
	switchChartPartFamily,
	targetChartPartFamily,
} from './chart-part-family-switch';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartUserShapes';
import {
	buildChartPoints,
	replaceFirstTextValueInTree,
	serializeCellExtraAttributes,
	serializeCellMergeAttributes,
	serializeTablePropertyFlags,
} from './save-table-merge-helpers';
import { rebuildTableXmlFromData } from './table-structural-ops';

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
	protected serializeTableDataToXml(shape: XmlObject, tableData: PptxTableData): void {
		try {
			const graphicData = xmlPath(shape, 'a:graphic', 'a:graphicData');
			const tbl = xmlChild(graphicData, 'a:tbl');
			if (!tbl) {
				return;
			}

			// ── Serialize table-level properties (tblPr) ──────────────
			serializeTablePropertyFlags(tbl, tableData);

			// ── Detect structural changes (row/column count mismatch) ──
			const xmlRows = this.ensureArray(tbl['a:tr']);
			const xmlColCount = this.ensureArray(xmlChild(tbl, 'a:tblGrid')?.['a:gridCol']).length;
			const dataRowCount = tableData.rows.length;
			const dataColCount = tableData.columnWidths.length;

			const structureChanged = dataRowCount !== xmlRows.length || dataColCount !== xmlColCount;

			if (structureChanged) {
				// Rebuild the entire table grid and rows from PptxTableData
				rebuildTableXmlFromData(
					tbl as XmlObject,
					tableData,
					PptxHandlerRuntime.EMU_PER_PX,
					this.ensureArray.bind(this),
				);

				// After rebuilding, apply text and style to all cells
				const rebuiltRows = this.ensureArray((tbl as XmlObject)['a:tr']);
				for (let rIdx = 0; rIdx < tableData.rows.length; rIdx++) {
					const dataRow = tableData.rows[rIdx];
					const xmlRow = rebuiltRows[rIdx] as XmlObject | undefined;
					if (!xmlRow) {
						continue;
					}

					const xmlCells = this.ensureArray(xmlRow['a:tc']);
					for (let cIdx = 0; cIdx < dataRow.cells.length; cIdx++) {
						const cell = dataRow.cells[cIdx];
						const xmlCell = xmlCells[cIdx] as XmlObject | undefined;
						if (!xmlCell) {
							continue;
						}

						if (cell.text !== undefined) {
							this.writeTableCellText(xmlCell, cell.text);
						}
						if (cell.style) {
							this.writeTableCellStyle(xmlCell, cell.style);
						}
						serializeCellExtraAttributes(xmlCell, cell.extraAttributes);
					}
				}
				return;
			}

			// ── No structural change: update cells in place ──
			for (let rIdx = 0; rIdx < Math.min(tableData.rows.length, xmlRows.length); rIdx++) {
				const dataRow = tableData.rows[rIdx];
				const xmlRow = xmlRows[rIdx] as XmlObject;

				// Update row height
				if (dataRow.height !== undefined && dataRow.height > 0) {
					xmlRow['@_h'] = String(Math.round(dataRow.height * PptxHandlerRuntime.EMU_PER_PX));
				}

				const xmlCells = this.ensureArray(xmlRow['a:tc']);
				for (let cIdx = 0; cIdx < Math.min(dataRow.cells.length, xmlCells.length); cIdx++) {
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

					// Round-trip opaque tcPr attributes (horzOverflow,
					// anchorCtr, headers, hideSlicers, slicerCacheId) that
					// don't yet have typed equivalents on the cell-style
					// shape but must be preserved across save cycles.
					serializeCellExtraAttributes(xmlCell, cell.extraAttributes);
				}
			}
		} catch (e) {
			console.warn('Failed to serialize table data:', e);
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
	protected serializeChartDataToXml(chartData: PptxChartData, _slidePath: string): void {
		if (!chartData.chartPartPath) {
			return;
		}
		if (!this.pendingChartUpdates) {
			this.pendingChartUpdates = [];
		}
		this.pendingChartUpdates.push({ chartData, slidePath: _slidePath });
	}

	/**
	 * Process all pending chart data updates (called from the async save method).
	 */
	protected async processPendingChartUpdates(): Promise<void> {
		if (!this.pendingChartUpdates || this.pendingChartUpdates.length === 0) {
			return;
		}

		for (const { chartData, slidePath } of this.pendingChartUpdates) {
			if (chartData.colorPalette && chartData.colorStylePartPath) {
				const paletteChanged =
					JSON.stringify(chartData.colorPalette) !==
					JSON.stringify(chartData.colorStyleOriginalPalette);
				const method = chartData.colorMethod ?? 'cycle';
				if (paletteChanged || method !== chartData.colorStyleOriginalMethod) {
					const colorFile = this.zip.file(chartData.colorStylePartPath);
					if (colorFile) {
						const colorTree = this.parser.parse(await colorFile.async('string')) as XmlObject;
						applyChartColorStyleXml(colorTree, chartData.colorPalette, method);
						this.zip.file(chartData.colorStylePartPath, this.builder.build(colorTree));
					}
				}
			}
			const chartPartPath = chartData.chartPartPath;
			if (!chartPartPath) {
				continue;
			}

			const chartFile = this.zip.file(chartPartPath);
			if (!chartFile) {
				continue;
			}

			try {
				const chartXmlStr = await chartFile.async('string');
				const chartXmlData = this.parser.parse(chartXmlStr) as XmlObject;
				// Collected alongside the cache rewrite below and, once the chart
				// XML is written back, handed to the embedded-workbook writer so
				// "Edit Data in Excel" reflects the same edit; see
				// `saveChartExternalWorkbookUpdates`.
				const workbookWrites: PptxChartWorkbookWrite[] = [];

				const chartSpace = this.xmlLookupService.getChildByLocalName(chartXmlData, 'chartSpace');
				if (!chartSpace) {
					continue;
				}

				// A 2006 `c:chartSpace` and a 2016+ `cx:chartSpace` are different
				// part families; see `chart-part-family-switch` / `chart-cx-update`.
				if (await this.saveChartAcrossFamilies(chartXmlData, chartSpace, chartData, slidePath)) {
					continue;
				}

				const chartRoot = this.xmlLookupService.getChildByLocalName(chartSpace, 'chart');
				if (!chartRoot) {
					continue;
				}

				const plotArea = this.xmlLookupService.getChildByLocalName(chartRoot, 'plotArea');
				if (!plotArea) {
					continue;
				}

				// Combo charts load as several sibling chart-type containers whose
				// series flatten into one index-aligned model list. Consolidate them
				// back into a single container so the generic per-series update runs
				// over the full list; the combo split below re-emits per type.
				const consolidation = consolidateComboContainersInXml(plotArea, (key) =>
					this.compatibilityService.getXmlLocalName(key),
				);

				// Find the chart type container (e.g. c:barChart, c:lineChart)
				let chartTypeKey = Object.keys(plotArea).find((key) =>
					this.compatibilityService.getXmlLocalName(key).endsWith('Chart'),
				);
				if (!chartTypeKey) {
					continue;
				}

				const chartTypeContainer = plotArea[chartTypeKey] as XmlObject | undefined;
				if (!chartTypeContainer) {
					continue;
				}

				// ── Handle chart type change ──────────────────────────────
				// Renaming the container is not enough: `CT_PieChart` allows none of
				// `c:barDir` / `c:gapWidth` / `c:overlap` / `c:axId`, and the axes the
				// old type referenced are left orphaned under `c:plotArea`. Rebuild the
				// container against the new content model, keeping what is legal.
				const expectedXmlTag = this.chartTypeToXmlTag(chartData.chartType);
				const currentLocalName = this.compatibilityService.getXmlLocalName(chartTypeKey);
				let containerLocalName = currentLocalName;
				if (expectedXmlTag && currentLocalName !== expectedXmlTag) {
					const newKey = `c:${expectedXmlTag}`;
					// Rename in place: `CT_PlotArea` sequences chart groups BEFORE axes,
					// so re-adding the key would push the chart behind `c:catAx`.
					renameXmlKeyInPlace(plotArea, chartTypeKey, newKey);
					chartTypeKey = newKey;
					containerLocalName = expectedXmlTag;
					normalizeChartContainerChildren(chartTypeContainer, expectedXmlTag, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
					reconcileChartPlotAreaAxes(plotArea, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				// Update grouping mode (only where the container's CT_* permits it)
				const groupingKey = Object.keys(chartTypeContainer).find(
					(key) => this.compatibilityService.getXmlLocalName(key) === 'grouping',
				);
				const groupingAllowed =
					!isKnownChartContainer(containerLocalName) ||
					chartContainerAllows(containerLocalName, 'grouping');
				if (chartData.grouping && groupingAllowed) {
					// `clustered` is a member of ST_BarGrouping only; line/area demote it.
					const grouping = normalizeChartGroupingValue(containerLocalName, chartData.grouping);
					if (groupingKey) {
						(chartTypeContainer[groupingKey] as XmlObject)['@_val'] = grouping;
					} else {
						// Insert grouping element if the chart type supports it
						chartTypeContainer['c:grouping'] = { '@_val': grouping };
					}
				} else if (groupingKey) {
					// Remove grouping if it was cleared (e.g. switching to pie)
					delete chartTypeContainer[groupingKey];
				}

				// ── Update series data ────────────────────────────────────
				const seriesNodes = this.xmlLookupService.getChildrenArrayByLocalName(
					chartTypeContainer,
					'ser',
				);

				// Find the key used for series elements in the XML
				const seriesKey =
					Object.keys(chartTypeContainer).find(
						(key) => this.compatibilityService.getXmlLocalName(key) === 'ser',
					) ?? 'c:ser';

				// Update existing series that are present in both XML and data
				const commonCount = Math.min(seriesNodes.length, chartData.series.length);
				for (let si = 0; si < commonCount; si++) {
					const seriesNode = seriesNodes[si];
					const seriesData = chartData.series[si];

					// Update series index
					const idxNode = this.xmlLookupService.getChildByLocalName(seriesNode, 'idx');
					if (idxNode) {
						idxNode['@_val'] = String(si);
					}
					const orderNode = this.xmlLookupService.getChildByLocalName(seriesNode, 'order');
					if (orderNode) {
						orderNode['@_val'] = String(si);
					}

					// Update series name
					const txNode = this.xmlLookupService.getChildByLocalName(seriesNode, 'tx');
					if (txNode) {
						this.updateChartCacheValues(txNode, false, [seriesData.name]);
						this.pushChartWorkbookWrite(workbookWrites, txNode, false, [seriesData.name]);
					}

					// Update category labels on every series (not just the first)
					const catNode =
						this.xmlLookupService.getChildByLocalName(seriesNode, 'cat') ||
						this.xmlLookupService.getChildByLocalName(seriesNode, 'xVal');
					if (catNode) {
						const dateValues = chartData.dateCategories?.values.map(String);
						const catValues = dateValues ?? chartData.categories;
						const catIsNumeric = Boolean(dateValues);
						this.updateChartCacheValues(catNode, catIsNumeric, catValues);
						this.pushChartWorkbookWrite(workbookWrites, catNode, catIsNumeric, catValues);
					}

					// Update values
					const valNode =
						this.xmlLookupService.getChildByLocalName(seriesNode, 'val') ||
						this.xmlLookupService.getChildByLocalName(seriesNode, 'yVal');
					if (valNode) {
						const values = seriesData.values.map(String);
						this.updateChartCacheValues(valNode, true, values);
						this.pushChartWorkbookWrite(workbookWrites, valNode, true, values);
					}

					// Update series colour. Create `c:spPr` when the loaded series has
					// none so an inspector-edited colour always round-trips, not just
					// when an original fill was present.
					//
					// `PptxChartSeries.color` is a RESOLVED hex: the parse ran the
					// authored `<a:schemeClr val="accent1"><a:lumMod val="60000"/>`
					// through the theme and kept only the answer. Writing that
					// answer back unconditionally severed every themed series from
					// its theme on every save, for charts nobody had touched -
					// measured on `issue-132-hr-deck.pptx` as `a:schemeClr 12 -> 5`
					// with `accent5` lost outright. `writeSeriesColorToSpPr` compares
					// against the authored node (still right here, re-parsed from the
					// archive) via `serializeColorChoice` so an untouched colour is
					// left exactly as authored.
					//
					// Line-drawn families (line/line3D/scatter/radar/stock) have no
					// fillable area: OOXML authors their colour on the outline
					// (`a:ln/a:solidFill`), not a direct `a:solidFill`. Writing the
					// direct slot unconditionally both missed the property PowerPoint
					// actually reads for those families AND could insert a new
					// `a:solidFill` sibling AFTER an existing `a:ln`, which
					// `CT_ShapeProperties` never allows (the fill group must precede
					// `a:ln`).
					if (seriesData.color) {
						const isLineFamily = isLineDrawnChartType(
							seriesData.seriesChartType ?? chartData.chartType,
						);
						const spPrKey =
							Object.keys(seriesNode).find(
								(k) => this.compatibilityService.getXmlLocalName(k) === 'spPr',
							) ?? 'c:spPr';
						let spPr = (seriesNode as XmlObject)[spPrKey] as XmlObject | undefined;
						if (!spPr) {
							spPr = {};
							(seriesNode as XmlObject)[spPrKey] = spPr;
						}
						writeSeriesColorToSpPr(
							spPr,
							seriesData.color,
							isLineFamily,
							(key) => this.compatibilityService.getXmlLocalName(key),
							(node) => this.parseColor(node),
						);
					}

					// Trendlines (per-series). Undefined = no edit / passthrough.
					if (seriesData.trendlines !== undefined) {
						applySeriesTrendlinesToXml(
							seriesNode,
							seriesData.trendlines,
							(key) => this.compatibilityService.getXmlLocalName(key),
							(node) => this.parseColor(node),
						);
					}

					// Error bars (per-series). Undefined = no edit / passthrough.
					if (seriesData.errBars !== undefined) {
						applySeriesErrBarsToXml(
							seriesNode,
							seriesData.errBars,
							(key) => this.compatibilityService.getXmlLocalName(key),
							(node) => this.parseColor(node),
						);
					}

					// Marker (per-series, line/scatter/bubble/radar). Undefined = passthrough.
					if (seriesData.marker !== undefined) {
						applySeriesMarkerToXml(
							seriesNode,
							seriesData.marker,
							(key) => this.compatibilityService.getXmlLocalName(key),
							(node) => this.parseColor(node),
						);
					}

					// Per-data-point overrides (c:dPt). Undefined = passthrough.
					if (seriesData.dataPoints !== undefined) {
						applySeriesDataPointsToXml(
							seriesNode,
							seriesData.dataPoints,
							(key) => this.compatibilityService.getXmlLocalName(key),
							(node) => this.parseColor(node),
						);
					}

					// Per-data-point label overrides (c:dLbl inside c:ser's c:dLbls).
					// Undefined = passthrough.
					if (seriesData.dataLabels !== undefined) {
						applySeriesDataLabelsToXml(seriesNode, seriesData.dataLabels, (key) =>
							this.compatibilityService.getXmlLocalName(key),
						);
					}

					// Per-series 3-D bar/column shape override (c:ser/c:shape), legal
					// only inside a bar3D container. Undefined = passthrough.
					if (seriesData.shape !== undefined && chartData.chartType === 'bar3D') {
						applySeriesBar3DShapeToXml(seriesNode, seriesData.shape, (key) =>
							this.compatibilityService.getXmlLocalName(key),
						);
					}
				}

				// ── Add new series (when data has more series than XML) ───
				if (chartData.series.length > seriesNodes.length) {
					// Use the last existing series as a template, or build minimal
					const templateSeries =
						seriesNodes.length > 0 ? seriesNodes[seriesNodes.length - 1] : undefined;

					const newSeriesXmlNodes: XmlObject[] = [];
					for (let si = seriesNodes.length; si < chartData.series.length; si++) {
						const seriesData = chartData.series[si];
						const newNode = this.buildNewSeriesXml(
							si,
							seriesData,
							chartData.categories,
							templateSeries,
							chartData.dateCategories,
							isLineDrawnChartType(seriesData.seriesChartType ?? chartData.chartType),
						);
						newSeriesXmlNodes.push(newNode);
					}

					// Append new series to the container
					const existingSeriesArray = Array.isArray(chartTypeContainer[seriesKey])
						? (chartTypeContainer[seriesKey] as XmlObject[])
						: chartTypeContainer[seriesKey]
							? [chartTypeContainer[seriesKey] as XmlObject]
							: [];
					chartTypeContainer[seriesKey] = [...existingSeriesArray, ...newSeriesXmlNodes];
				}

				// ── Remove excess series (when data has fewer series than XML)
				if (chartData.series.length < seriesNodes.length) {
					const existingSeriesArray = Array.isArray(chartTypeContainer[seriesKey])
						? (chartTypeContainer[seriesKey] as XmlObject[])
						: chartTypeContainer[seriesKey]
							? [chartTypeContainer[seriesKey] as XmlObject]
							: [];

					chartTypeContainer[seriesKey] = existingSeriesArray.slice(0, chartData.series.length);
					// If only one series remains, unwrap from array for XML builder
					if (chartData.series.length === 1) {
						chartTypeContainer[seriesKey] = (chartTypeContainer[seriesKey] as XmlObject[])[0];
					}
				}

				// ── Per-series combo types ────────────────────────────
				// When series carry differing `seriesChartType` values, split the
				// single chart-type container into per-type sibling containers under
				// c:plotArea (PowerPoint's combo-chart shape).
				if (chartData.series.some((s) => s.seriesChartType !== undefined)) {
					applyComboSeriesTypesToXml(
						plotArea,
						chartTypeKey,
						chartData.series,
						chartData.chartType,
						(key) => this.compatibilityService.getXmlLocalName(key),
						chartData.axes,
						consolidation?.containerChildren,
					);
				}

				// Update external data autoUpdate attribute (c:externalData / c:autoUpdate)
				if (chartData.externalData?.autoUpdate !== undefined) {
					const externalDataNode = this.xmlLookupService.getChildByLocalName(
						chartSpace,
						'externalData',
					);
					if (externalDataNode) {
						// Update child element form: <c:autoUpdate val="0|1"/>
						const autoUpdateNode = this.xmlLookupService.getChildByLocalName(
							externalDataNode,
							'autoUpdate',
						);
						if (autoUpdateNode) {
							autoUpdateNode['@_val'] = chartData.externalData.autoUpdate ? '1' : '0';
						}
						// Also update direct attribute form if present
						if (externalDataNode['@_autoUpdate'] !== undefined) {
							externalDataNode['@_autoUpdate'] = chartData.externalData.autoUpdate ? '1' : '0';
						}
					}
				}

				if (chartData.pivotSource !== undefined) {
					applyChartPivotSource(chartSpace, chartData.pivotSource, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				// Update plotVisOnly (c:plotVisOnly)
				if (chartData.plotVisibleOnly !== undefined) {
					const plotVisOnlyNode = this.xmlLookupService.getChildByLocalName(
						chartRoot,
						'plotVisOnly',
					);
					const val = chartData.plotVisibleOnly ? '1' : '0';
					if (plotVisOnlyNode) {
						plotVisOnlyNode['@_val'] = val;
					} else {
						// Insert new c:plotVisOnly element into chartRoot
						(chartRoot as XmlObject)['c:plotVisOnly'] = { '@_val': val };
					}
				}

				// ── ofPieChart options round-trip (CT_OfPieChart) ─────────
				if (chartData.ofPieOptions) {
					this.applyOfPieOptions(chartTypeContainer, chartData.ofPieOptions);
				}
				if (chartData.bubbleOptions && chartData.chartType === 'bubble') {
					applyBubbleChartOptions(chartTypeContainer, chartData.bubbleOptions, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}
				if (
					chartData.upDownBars !== undefined &&
					(chartData.chartType === 'line' ||
						chartData.chartType === 'stock' ||
						chartData.chartType === 'combo')
				) {
					applyChartUpDownBars(
						chartTypeContainer,
						chartData.upDownBars,
						(key) => this.compatibilityService.getXmlLocalName(key),
						(node) => this.parseColor(node),
					);
				}

				if (chartData.bandFmts !== undefined && chartData.chartType === 'surface') {
					applyChartBandFmts(
						chartTypeContainer,
						chartData.bandFmts,
						(key) => this.compatibilityService.getXmlLocalName(key),
						(node) => this.parseColor(node),
					);
				}

				// ── bar3D shape / radar style / surface wireframe round-trip ──
				if (chartData.barShape !== undefined && chartData.chartType === 'bar3D') {
					applyBar3DShapeToXml(chartTypeContainer, containerLocalName, chartData.barShape, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}
				if (
					chartData.gapDepth !== undefined &&
					(chartData.chartType === 'bar3D' ||
						chartData.chartType === 'area3D' ||
						chartData.chartType === 'line3D')
				) {
					applyGapDepthToXml(chartTypeContainer, containerLocalName, chartData.gapDepth, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}
				if (chartData.radarStyle !== undefined && chartData.chartType === 'radar') {
					applyRadarStyleToXml(
						chartTypeContainer,
						containerLocalName,
						chartData.radarStyle,
						(key) => this.compatibilityService.getXmlLocalName(key),
					);
				}
				if (chartData.wireframe !== undefined && chartData.chartType === 'surface') {
					applySurfaceWireframeToXml(
						chartTypeContainer,
						containerLocalName,
						chartData.wireframe,
						(key) => this.compatibilityService.getXmlLocalName(key),
					);
				}

				// ── view3D round-trip (CT_View3D) ─────────────────────────
				if (chartData.view3D) {
					this.applyView3D(chartRoot, chartData.view3D);
				}

				// ── Chart chrome flags round-trip ─────────────────────────
				if (chartData.chartChrome) {
					this.applyChartChrome(chartRoot, chartData.chartChrome);
				}

				// ── Title (c:title / c:autoTitleDeleted) ──────────────────
				// After the chrome flags: a loaded chart carries the parsed
				// `autoTitleDeleted`, which must not clobber the value a newly
				// added or removed title decides.
				applyChartTitleToXml(
					chartRoot,
					{ title: chartData.title, hasTitle: chartData.style?.hasTitle },
					(key) => this.compatibilityService.getXmlLocalName(key),
				);
				if (chartData.style) {
					applyChartTitleStyleToXml(
						chartRoot,
						{
							fontFamily: chartData.style.titleFontFamily,
							fontSize: chartData.style.titleFontSize,
							fontBold: chartData.style.titleFontBold,
							fontColor: chartData.style.titleFontColor,
							spPr: chartData.style.titleSpPr,
						},
						(key) => this.compatibilityService.getXmlLocalName(key),
						{ prefix: 'c' },
						(node) => this.parseColor(node),
					);
				}

				if (chartData.pivotFormats !== undefined) {
					applyChartPivotFormats(chartRoot, chartData.pivotFormats, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				// ── Legend round-trip (c:legend / c:legendPos) ────────────
				if (chartData.style) {
					applyChartLegendToXml(
						chartRoot,
						chartData.style,
						(key) => this.compatibilityService.getXmlLocalName(key),
						(node) => this.parseColor(node),
					);
				}

				if (chartData.layouts) {
					applyChartLayouts(chartRoot, chartData.layouts, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				if (chartData.printSettings !== undefined) {
					applyChartPrintSettings(chartSpace, chartData.printSettings, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				if (chartData.protection !== undefined) {
					applyChartProtection(chartSpace, chartData.protection, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				// ── Data labels round-trip (chart-level c:dLbls) ──────────
				if (chartData.style) {
					applyChartDataLabelsToXml(plotArea, chartData.style, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					);
				}

				applyChartDataTable(
					plotArea,
					chartData.dataTable,
					(key) => this.compatibilityService.getXmlLocalName(key),
					(node) => this.parseColor(node),
				);

				// Update axis fields (Phase 5 Stream A item 4).
				// Currently writes back: scaling.min/max, scaling.logBase,
				// numFmt, majorUnit, minorUnit, tickLblPos. Other parsed-but-not-
				// written chart fields (surfaces/dropLines/hiLowLines/
				// marker/per-point dataLabels/explosion/smooth/
				// colorPalette/colorMethod, axis txPr/axPos) are
				// preserved via the original XML passthrough but lose any edits
				// (see OPENXML_PARITY.md M-tier).
				if (chartData.axes) {
					const axisTypeNames = ['valAx', 'catAx', 'dateAx', 'serAx'] as const;
					for (const axisTypeName of axisTypeNames) {
						const axisNodes = this.xmlLookupService.getChildrenArrayByLocalName(
							plotArea,
							axisTypeName,
						);
						for (const axisNode of axisNodes) {
							const axIdNode = this.xmlLookupService.getChildByLocalName(axisNode, 'axId');
							const xmlAxisId = axIdNode ? parseInt(String(axIdNode['@_val']), 10) : undefined;
							const matchingAxis = chartData.axes.find(
								(a) => a.axisId !== undefined && a.axisId === xmlAxisId,
							);
							if (!matchingAxis) {
								continue;
							}

							const scalingNode = this.xmlLookupService.getChildByLocalName(axisNode, 'scaling');
							if (scalingNode) {
								applyChartAxisScaling(scalingNode, matchingAxis, (key) =>
									this.compatibilityService.getXmlLocalName(key),
								);
							}

							// numFmt (formatCode + sourceLinked)
							if (matchingAxis.numFmt) {
								const numFmtKey = Object.keys(axisNode).find(
									(k) => this.compatibilityService.getXmlLocalName(k) === 'numFmt',
								);
								const numFmtAttrs: XmlObject = {
									'@_formatCode': matchingAxis.numFmt.formatCode,
									'@_sourceLinked': matchingAxis.numFmt.sourceLinked ? '1' : '0',
								};
								if (numFmtKey) {
									axisNode[numFmtKey] = numFmtAttrs;
								} else {
									axisNode['c:numFmt'] = numFmtAttrs;
								}
							}

							// majorUnit
							this.upsertChartAxisChild(
								axisNode,
								'majorUnit',
								matchingAxis.majorUnit !== undefined ? String(matchingAxis.majorUnit) : undefined,
							);

							// minorUnit
							this.upsertChartAxisChild(
								axisNode,
								'minorUnit',
								matchingAxis.minorUnit !== undefined ? String(matchingAxis.minorUnit) : undefined,
							);

							applyChartAxisLabelFormatting(axisNode, matchingAxis, (key) =>
								this.compatibilityService.getXmlLocalName(key),
							);
							applyChartDateAxisUnits(axisNode, matchingAxis, (key) =>
								this.compatibilityService.getXmlLocalName(key),
							);

							// Axis title (undefined = no edit, '' = remove)
							applyChartAxisTitleToXml(axisNode, matchingAxis.titleText, (key) =>
								this.compatibilityService.getXmlLocalName(key),
							);

							// Axis title font styling (family/size/bold/colour) onto c:txPr
							applyChartAxisTitleStyleToXml(
								axisNode,
								{
									fontFamily: matchingAxis.fontFamily,
									fontSize: matchingAxis.fontSize,
									fontBold: matchingAxis.fontBold,
									fontColor: matchingAxis.fontColor,
								},
								(key) => this.compatibilityService.getXmlLocalName(key),
								(node) => this.parseColor(node),
							);

							// Major/minor gridlines (undefined = no edit)
							applyChartAxisGridlinesToXml(
								axisNode,
								matchingAxis,
								(key) => this.compatibilityService.getXmlLocalName(key),
								(node) => this.parseColor(node),
							);

							// Display units (value/date axes only; reconciled from the model)
							if (axisTypeName === 'valAx' || axisTypeName === 'dateAx') {
								applyChartAxisDisplayUnitsToXml(
									axisNode,
									matchingAxis,
									(key) => this.compatibilityService.getXmlLocalName(key),
									(node) => this.parseColor(node),
								);
							}
						}
					}
				}

				// Every chart-group container is a CT_* SEQUENCE, and the mutations
				// above (new series appended, grouping inserted, ofPie options added)
				// can land a child out of position. Re-emit each container in schema
				// order as the last step.
				for (const key of Object.keys(plotArea)) {
					const local = this.compatibilityService.getXmlLocalName(key);
					if (!local.endsWith('Chart')) {
						continue;
					}
					const container = plotArea[key] as XmlObject | undefined;
					if (container) {
						orderChartContainerChildren(container, local, (k) =>
							this.compatibilityService.getXmlLocalName(k),
						);
					}
				}

				// Drawing-overlay shapes (c:userShapes): reconciled against disk
				// only when `chartData.userShapes` carries an actual edit signal;
				// see `PptxHandlerRuntimeChartUserShapes` for the dirty contract.
				await this.syncChartUserShapesToXml(chartSpace, chartData, chartPartPath);

				// Write updated chart XML back
				this.zip.file(chartPartPath, this.builder.build(chartXmlData));

				// Mirror the same edit into the embedded workbook (`ppt/embeddings/*.xlsx`)
				// so "Edit Data in Excel" and any Excel recalculation see the new
				// values too, instead of silently reverting them. Degrades to a
				// compatibility warning, never throws; see
				// `saveChartExternalWorkbookUpdates`.
				await saveChartExternalWorkbookUpdates(
					{
						zip: this.zip,
						resolveImagePath: (basePath, target) => this.resolveImagePath(basePath, target),
						reportWarning: (warning) => this.compatibilityService.reportWarning(warning),
					},
					chartPartPath,
					slidePath,
					chartData.externalData,
					workbookWrites,
				);
			} catch (e) {
				console.warn(`[pptx-save] Failed to serialize chart data for ${chartPartPath}:`, e);
			}
		}

		this.pendingChartUpdates = undefined;
	}

	/**
	 * Route a chart save that the 2006 `c:*Chart` update loop cannot handle:
	 * a part-family change (regenerated into a fresh part of the right
	 * family), a ChartEx type change (regenerated in place), or an edited
	 * ChartEx chart (updated in place). Returns `true` when the part was
	 * written here and the caller must skip the legacy update.
	 */
	protected async saveChartAcrossFamilies(
		chartXmlData: XmlObject,
		chartSpace: XmlObject,
		chartData: PptxChartData,
		slidePath: string,
	): Promise<boolean> {
		const getLocalName = (key: string) => this.compatibilityService.getXmlLocalName(key);
		const deps = { zip: this.zip, parser: this.parser, builder: this.builder, getLocalName };
		const existingFamily = detectChartPartFamily(chartSpace, getLocalName);
		const targetFamily = targetChartPartFamily(chartData);
		if (targetFamily && targetFamily !== existingFamily) {
			return (await switchChartPartFamily(deps, chartData, slidePath, targetFamily)) !== undefined;
		}
		if (existingFamily !== 'chartEx' || !chartData.chartPartPath) {
			return false;
		}
		if (
			canGenerateChartEx(chartData) &&
			chartExLayoutChanged(chartSpace, chartData, getLocalName)
		) {
			// The regenerated tree carries the preserved `c:userShapes` reference
			// (`chartData.userShapesXml`); syncing against it as well lets an
			// overlay edit made in the SAME save as the type change land too.
			const regenerated = buildChartExSpaceXml(chartData);
			const regeneratedSpace = regenerated['cx:chartSpace'] as XmlObject | undefined;
			if (regeneratedSpace) {
				await this.syncChartUserShapesToXml(regeneratedSpace, chartData, chartData.chartPartPath);
			}
			this.zip.file(chartData.chartPartPath, this.builder.build(regenerated));
			return true;
		}
		if (applyChartExUpdate(chartSpace, chartData, getLocalName)) {
			// ChartEx's drawing-overlay part is the same `cdr:`-namespaced part
			// classic charts use, referenced the same way (`c:userShapes/@_r:id`
			// on the chart space); this in-place update path mutates the existing
			// `chartSpace` object, so the same sync used by classic charts works.
			await this.syncChartUserShapesToXml(chartSpace, chartData, chartData.chartPartPath);
			this.zip.file(chartData.chartPartPath, this.builder.build(chartXmlData));
		}
		return true;
	}

	/**
	 * Upsert a `c:<localName>` child with `@_val` on an axis or scaling node.
	 * When `value` is undefined, removes any existing child of that local name.
	 */
	protected upsertChartAxisChild(
		parent: XmlObject,
		localName: string,
		value: string | undefined,
	): void {
		upsertChartAxisChild(parent, localName, value, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
	}

	/**
	 * Collect a workbook write-back entry for one chart cache container (a
	 * series' `c:tx`, `c:cat`/`c:xVal`, or `c:val`/`c:yVal`), pushing it onto
	 * `workbookWrites` when the container names a `c:f` formula reference.
	 * Call alongside {@link updateChartCacheValues} with the SAME arguments
	 * so the embedded workbook and the chart cache always agree. A no-op
	 * when the container has no formula reference (e.g. a brand-new series
	 * built without one), so it is always safe to call.
	 */
	protected pushChartWorkbookWrite(
		workbookWrites: PptxChartWorkbookWrite[],
		container: XmlObject | undefined,
		isNumeric: boolean,
		values: string[],
	): void {
		const write = collectChartWorkbookWrite(this.xmlLookupService, container, isNumeric, values);
		if (write) {
			workbookWrites.push(write);
		}
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
		const refName = isNumeric ? 'numRef' : 'strRef';
		const litName = isNumeric ? 'numLit' : 'strLit';
		const cacheName = isNumeric ? 'numCache' : 'strCache';

		const refNode =
			this.xmlLookupService.getChildByLocalName(container, refName) ||
			this.xmlLookupService.getChildByLocalName(container, litName);
		if (!refNode) {
			// `CT_SerTx` is a choice of `c:strRef` or a bare `c:v` (the shape the
			// SDK generator emits for series names): update the literal in place.
			const literalKey = Object.keys(container).find(
				(key) => this.compatibilityService.getXmlLocalName(key) === 'v',
			);
			if (literalKey && values.length === 1) {
				container[literalKey] = values[0];
			}
			return;
		}

		const cacheNode = this.xmlLookupService.getChildByLocalName(refNode, cacheName) || refNode;
		if (!cacheNode) {
			return;
		}

		// Update point count
		const ptCountNode = this.xmlLookupService.getChildByLocalName(cacheNode, 'ptCount');
		if (ptCountNode) {
			ptCountNode['@_val'] = String(values.length);
		}

		// Find the key used for pt elements
		const ptKey = Object.keys(cacheNode).find(
			(key) => this.compatibilityService.getXmlLocalName(key) === 'pt',
		);
		if (!ptKey) {
			return;
		}

		// Rebuild point array
		cacheNode[ptKey] = buildChartPoints(values);
	}

	/** Replace the first text value found deep in the node tree. */
	protected replaceFirstTextValue(node: unknown, localName: string, newValue: string): boolean {
		return replaceFirstTextValueInTree(node, localName, newValue, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
	}

	// ---------------------------------------------------------------------------
	// Chart type / series helpers for save pipeline
	// ---------------------------------------------------------------------------

	/**
	 * Upsert a `c:<localName>` child carrying only an `@_val` attribute on
	 * `parent`. When `value` is `undefined` the existing child is removed.
	 */
	private upsertValChild(parent: XmlObject, localName: string, value: string | undefined): void {
		const existing = this.xmlLookupService.getChildByLocalName(parent, localName);
		const existingKey = Object.keys(parent).find(
			(k) => this.compatibilityService.getXmlLocalName(k) === localName,
		);
		if (value === undefined) {
			if (existingKey) {
				delete parent[existingKey];
			}
			return;
		}
		if (existing && existingKey) {
			parent[existingKey] = { ...(existing as XmlObject), '@_val': value };
		} else {
			parent[`c:${localName}`] = { '@_val': value };
		}
	}

	/**
	 * Apply ofPie options (CT_OfPieChart) onto an existing
	 * `c:ofPieChart` container. Updates ofPieType, splitType, splitPos,
	 * secondPieSize, gapWidth, and serLines presence.
	 */
	protected applyOfPieOptions(ofPieContainer: XmlObject, options: PptxChartOfPieOptions): void {
		this.upsertValChild(ofPieContainer, 'ofPieType', options.ofPieType);
		this.upsertValChild(ofPieContainer, 'splitType', options.splitType);
		this.upsertValChild(
			ofPieContainer,
			'splitPos',
			options.splitPos !== undefined ? String(options.splitPos) : undefined,
		);
		this.upsertValChild(
			ofPieContainer,
			'secondPieSize',
			options.secondPieSize !== undefined ? String(options.secondPieSize) : undefined,
		);
		this.upsertValChild(
			ofPieContainer,
			'gapWidth',
			options.gapWidth !== undefined ? String(options.gapWidth) : undefined,
		);
		// serLines: presence-only (insert empty element when true; remove when false).
		const serLinesKey = Object.keys(ofPieContainer).find(
			(k) => this.compatibilityService.getXmlLocalName(k) === 'serLines',
		);
		if (options.serLines) {
			if (!serLinesKey) {
				ofPieContainer['c:serLines'] = {};
			}
		} else if (options.serLines === false && serLinesKey) {
			delete ofPieContainer[serLinesKey];
		}

		// custSplit: rebuild secondPiePt list when provided.
		if (options.custSplit && options.custSplit.length > 0) {
			ofPieContainer['c:custSplit'] = {
				'c:secondPiePt': options.custSplit.map((idx) => ({ '@_val': String(idx) })),
			};
		}
	}

	/**
	 * Apply `c:view3D` (CT_View3D) onto the chart root. Replaces any
	 * existing `c:view3D` element, preserving only the fields supplied
	 * on `view3D`.
	 */
	protected applyView3D(chartRoot: XmlObject, view3D: PptxChartView3D): void {
		const node: XmlObject = {};
		if (view3D.rotX !== undefined) {
			node['c:rotX'] = { '@_val': String(view3D.rotX) };
		}
		// Per CT_View3D the order is rotX, hPercent, rotY, depthPercent,
		// rAngAx, perspective. fast-xml-parser preserves insertion order.
		if (view3D.hPercent !== undefined) {
			node['c:hPercent'] = { '@_val': String(view3D.hPercent) };
		}
		if (view3D.rotY !== undefined) {
			node['c:rotY'] = { '@_val': String(view3D.rotY) };
		}
		if (view3D.depthPercent !== undefined) {
			node['c:depthPercent'] = { '@_val': String(view3D.depthPercent) };
		}
		if (view3D.rAngAx !== undefined) {
			node['c:rAngAx'] = { '@_val': view3D.rAngAx ? '1' : '0' };
		}
		if (view3D.perspective !== undefined) {
			node['c:perspective'] = { '@_val': String(view3D.perspective) };
		}

		const existingKey = Object.keys(chartRoot).find(
			(k) => this.compatibilityService.getXmlLocalName(k) === 'view3D',
		);
		if (Object.keys(node).length === 0) {
			if (existingKey) {
				delete chartRoot[existingKey];
			}
			return;
		}
		if (existingKey) {
			chartRoot[existingKey] = node;
		} else {
			chartRoot['c:view3D'] = node;
		}
	}

	/**
	 * Apply chart chrome flags onto the chart root. Each flag is only
	 * written when explicitly set on `chrome`; absent fields preserve
	 * any existing element verbatim.
	 */
	protected applyChartChrome(chartRoot: XmlObject, chrome: PptxChartChrome): void {
		if (chrome.autoTitleDeleted !== undefined) {
			this.upsertValChild(chartRoot, 'autoTitleDeleted', chrome.autoTitleDeleted ? '1' : '0');
		}
		if (chrome.dispBlanksAs !== undefined) {
			this.upsertValChild(chartRoot, 'dispBlanksAs', chrome.dispBlanksAs);
		}
		if (chrome.showDLblsOverMax !== undefined) {
			this.upsertValChild(chartRoot, 'showDLblsOverMax', chrome.showDLblsOverMax ? '1' : '0');
		}
	}

	/**
	 * Map a {@link PptxChartType} to the OOXML element local name for the
	 * chart type container (e.g. `"bar"` &rarr; `"barChart"`).
	 *
	 * Returns `undefined` for types that cannot be expressed as a classic
	 * `c:*Chart` element (e.g. Office 2016+ cx: chart types).
	 */
	protected chartTypeToXmlTag(chartType: PptxChartData['chartType']): string | undefined {
		return chartTypeToContainerLocalName(chartType);
	}

	/**
	 * Build a minimal `<c:ser>` XML object for a newly-added series.
	 *
	 * If a `templateSeries` is provided, it is deep-cloned and its data is
	 * replaced with the new series data. Otherwise, a minimal structure is
	 * built from scratch.
	 *
	 * @param isLineFamily - Whether the target chart family reads/writes its
	 *   series colour from `a:ln/a:solidFill` (line/line3D/scatter/radar/stock)
	 *   rather than a direct `a:solidFill`. See `isLineDrawnChartType`.
	 */
	protected buildNewSeriesXml(
		seriesIndex: number,
		seriesData: PptxChartSeries,
		categories: string[],
		templateSeries?: XmlObject,
		dateCategories?: PptxChartData['dateCategories'],
		isLineFamily = false,
	): XmlObject {
		if (templateSeries) {
			// Deep-clone the template
			const clone = JSON.parse(JSON.stringify(templateSeries)) as XmlObject;

			// Update idx / order
			const idxNode = this.xmlLookupService.getChildByLocalName(clone, 'idx');
			if (idxNode) {
				idxNode['@_val'] = String(seriesIndex);
			}
			const orderNode = this.xmlLookupService.getChildByLocalName(clone, 'order');
			if (orderNode) {
				orderNode['@_val'] = String(seriesIndex);
			}

			// Update series name
			const txNode = this.xmlLookupService.getChildByLocalName(clone, 'tx');
			if (txNode) {
				this.updateChartCacheValues(txNode, false, [seriesData.name]);
			}

			// Update categories
			const catNode =
				this.xmlLookupService.getChildByLocalName(clone, 'cat') ||
				this.xmlLookupService.getChildByLocalName(clone, 'xVal');
			if (catNode) {
				const dateValues = dateCategories?.values.map(String);
				this.updateChartCacheValues(catNode, Boolean(dateValues), dateValues ?? categories);
			}

			// Update values
			const valNode =
				this.xmlLookupService.getChildByLocalName(clone, 'val') ||
				this.xmlLookupService.getChildByLocalName(clone, 'yVal');
			if (valNode) {
				this.updateChartCacheValues(valNode, true, seriesData.values.map(String));
			}

			// Update colour. Line-drawn families (line/line3D/scatter/radar/stock)
			// author it on `a:ln/a:solidFill`, not a direct fill; see
			// `writeSeriesColorToSpPr`.
			if (seriesData.color) {
				const spPr = this.xmlLookupService.getChildByLocalName(clone, 'spPr');
				if (spPr) {
					writeSeriesColorToSpPr(
						spPr,
						seriesData.color,
						isLineFamily,
						(key) => this.compatibilityService.getXmlLocalName(key),
						(node) => this.parseColor(node),
					);
				}
			}

			return clone;
		}

		// Build minimal series XML from scratch
		const colorHex = (seriesData.color || '#4472C4').replace('#', '');
		const ser: XmlObject = {
			'c:idx': { '@_val': String(seriesIndex) },
			'c:order': { '@_val': String(seriesIndex) },
			'c:tx': {
				'c:strRef': {
					'c:strCache': {
						'c:ptCount': { '@_val': '1' },
						'c:pt': { '@_idx': '0', 'c:v': seriesData.name },
					},
				},
			},
			'c:spPr': isLineFamily
				? { 'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': colorHex } } } }
				: { 'a:solidFill': { 'a:srgbClr': { '@_val': colorHex } } },
			'c:cat': dateCategories
				? {
						'c:numRef': {
							'c:numCache': {
								'c:formatCode': dateCategories.formatCode ?? 'General',
								'c:ptCount': { '@_val': String(dateCategories.values.length) },
								'c:pt': buildChartPoints(dateCategories.values.map(String)),
							},
						},
					}
				: {
						'c:strRef': {
							'c:strCache': {
								'c:ptCount': { '@_val': String(categories.length) },
								'c:pt': buildChartPoints(categories),
							},
						},
					},
			'c:val': {
				'c:numRef': {
					'c:numCache': {
						'c:formatCode': 'General',
						'c:ptCount': { '@_val': String(seriesData.values.length) },
						'c:pt': buildChartPoints(seriesData.values.map(String)),
					},
				},
			},
		};

		return ser;
	}
}
