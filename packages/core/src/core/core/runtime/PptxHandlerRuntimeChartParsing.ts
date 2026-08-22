/**
 * @fileoverview Main chart parsing orchestrator for OOXML chart graphic frames.
 *
 * This mixin provides the top-level `getChartDataForGraphicFrame` method that
 * coordinates chart detection, series extraction, metadata parsing, and
 * external data resolution into a unified `PptxChartData` result.
 *
 * Helper methods have been split into focused sub-modules:
 * - {@link ./PptxHandlerRuntimeChartParsingHelpers} — `parsePlotVisOnly`, `parsePivotSource`
 * - {@link ./PptxHandlerRuntimeChartExternalData} — `parseChartExternalData`, `parseEmbeddedWorkbook`, `readChartRels`
 * - {@link ./PptxHandlerRuntimeChartColorStyle} — `parseChartColorStyle`, color palette resolution
 *
 * Mixin chain position:
 *   `PptxHandlerRuntimeChartColorStyle` → **this** → `PptxHandlerRuntimePresentationStructure`
 */

import { XmlObject } from '../../types';
import type { PptxChartData, PptxChartScatterStyle, PptxChartType } from '../../types';
import {
	parseSeriesTrendlines,
	parseSeriesErrBars,
	parseLineStyle,
} from '../../utils/chart-advanced-parser';
import { parseChartAxes, parseChart3DSurfaces } from '../../utils/chart-axis-parser';
import { extractSeriesNumbersWithBlanks } from '../../utils/chart-blank-values';
import { parseBubbleChartOptions } from '../../utils/chart-bubble-options';
import {
	chartContainerLocalNameToType,
	isLineDrawnChartType,
} from '../../utils/chart-container-type-map';
import { parseCxChartSeries } from '../../utils/chart-cx-parser';
import { parseChartDataLabelOptions } from '../../utils/chart-data-label-parser';
import { parseDataTable } from '../../utils/chart-data-table-parser';
import { parseChartDateCategories } from '../../utils/chart-date-categories';
import { parseChartLayouts } from '../../utils/chart-layout';
import { parseChartPivotFormats } from '../../utils/chart-pivot-formats';
import { parseChartPrintSettings } from '../../utils/chart-print-settings';
import { parseChartProtection } from '../../utils/chart-protection';
import { resolveChartContainerValueAxisId } from '../../utils/chart-series-axis';
import {
	parseSeriesDataPoints,
	parseSeriesDataLabels,
	parseSeriesExplosion,
	parseMarker,
} from '../../utils/chart-series-detail-parser';
import { parseChartUpDownBars } from '../../utils/chart-up-down-bars';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartColorStyle';

/** `ST_ScatterStyle` tokens, used to reject anything else in `c:scatterStyle/@val`. */
const SCATTER_STYLES = new Set<PptxChartScatterStyle>([
	'none',
	'line',
	'lineMarker',
	'marker',
	'smooth',
	'smoothMarker',
]);

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse chart data from a graphic frame element on a slide.
	 *
	 * Resolves the chart relationship, reads the chart part XML, detects
	 * the chart type, extracts series/categories, and gathers all metadata
	 * (axes, data table, external data, color style, etc.) into a single
	 * {@link PptxChartData} object.
	 *
	 * @param slidePath - The ZIP path of the slide containing the graphic frame.
	 * @param graphicFrame - The raw XML object for the `p:graphicFrame` element.
	 * @returns The parsed chart data, or `undefined` if the frame is not a chart.
	 */
	public async getChartDataForGraphicFrame(
		slidePath: string,
		graphicFrame: XmlObject | undefined,
	): Promise<PptxChartData | undefined> {
		const graphicData = this.xmlLookupService.getChildByLocalName(
			this.xmlLookupService.getChildByLocalName(graphicFrame, 'graphic'),
			'graphicData',
		);
		const chartReference = this.xmlLookupService.getChildByLocalName(graphicData, 'chart');
		const chartRelationshipId = String(chartReference?.['@_r:id'] || '').trim();
		if (chartRelationshipId.length === 0) {
			return undefined;
		}

		const chartPart = await this.readXmlPartByRelationshipId(slidePath, chartRelationshipId);
		if (!chartPart) {
			return undefined;
		}

		const chartSpace = this.xmlLookupService.getChildByLocalName(chartPart.xml, 'chartSpace');
		const chartRoot = this.xmlLookupService.getChildByLocalName(chartSpace, 'chart');
		const plotArea = this.xmlLookupService.getChildByLocalName(chartRoot, 'plotArea');
		if (!plotArea) {
			return undefined;
		}

		const chartType = this.detectChartType(plotArea);
		const lineStyleColorAdapter = {
			parseColor: (n: XmlObject | undefined, p?: string) => this.parseColor(n, p),
		};
		const axes = parseChartAxes(
			plotArea,
			this.xmlLookupService,
			lineStyleColorAdapter,
			(key: string) => this.compatibilityService.getXmlLocalName(key),
		);

		// A combo chart's plotArea holds several sibling chart-type containers
		// (e.g. c:barChart + c:lineChart), each with a subset of the series.
		// Gather ALL of them, not just the first, so every series loads and can
		// round-trip under the correct container.
		const chartContainerKeys = Object.keys(plotArea).filter((key) =>
			this.compatibilityService.getXmlLocalName(key).endsWith('Chart'),
		);
		const seriesContainerKey = chartContainerKeys[0];

		// cx: namespace (Office 2016+) charts use plotAreaRegion instead of *Chart
		if (!seriesContainerKey) {
			return this.parseCxChart(
				plotArea,
				chartType,
				chartSpace,
				chartRoot,
				chartPart.partPath,
				chartRelationshipId,
			);
		}

		const seriesContainer = plotArea[seriesContainerKey] as XmlObject | undefined;

		const { categories, categoryLevels, series } = this.parseAllChartContainers(
			plotArea,
			chartContainerKeys,
			chartType,
			axes,
		);
		const firstSeriesNode = chartContainerKeys
			.flatMap((key) =>
				this.xmlLookupService.getChildrenArrayByLocalName(
					plotArea[key] as XmlObject | undefined,
					'ser',
				),
			)
			.at(0);
		const rawDateCategories = axes.some((axis) => axis.axisType === 'dateAx')
			? parseChartDateCategories(firstSeriesNode, this.xmlLookupService)
			: undefined;
		if (series.length === 0) {
			return undefined;
		}

		const titleNode = this.xmlLookupService.getChildByLocalName(chartRoot, 'title');
		const titleTextValues: string[] = [];
		this.collectLocalTextValues(titleNode, 't', titleTextValues);

		// Extract chart styling
		const chartStyle = this.extractChartStyle(chartSpace, chartRoot);

		// Extract grouping mode (bar/line/area)
		let grouping: PptxChartData['grouping'];
		const groupingNode = this.xmlLookupService.getChildByLocalName(seriesContainer, 'grouping');
		if (groupingNode?.['@_val']) {
			const groupingVal = String(groupingNode['@_val']).trim();
			if (groupingVal === 'stacked') {
				grouping = 'stacked';
			} else if (groupingVal === 'percentStacked') {
				grouping = 'percentStacked';
			} else {
				grouping = 'clustered';
			}
		}

		// Parse plot-level rendering options carried on the chart-type container:
		// varyColors (per-point colouring), firstSliceAng/holeSize (pie/doughnut
		// geometry), gapWidth/overlap (bar spacing). These are read-only for
		// rendering; save round-trips them via the preserved chart XML.
		const varyColors = this.parseChartBoolVal(seriesContainer, 'varyColors');
		const firstSliceAngle = this.parseChartNumberVal(seriesContainer, 'firstSliceAng');
		const doughnutHoleSize = this.parseChartNumberVal(seriesContainer, 'holeSize');
		const barGapWidth = this.parseChartNumberVal(seriesContainer, 'gapWidth');
		const barOverlap = this.parseChartNumberVal(seriesContainer, 'overlap');

		// Scatter presentation mode (c:scatterStyle). PowerPoint writes it on every
		// scatter chart it authors and defaults it to `lineMarker`, so a missing
		// element only happens on hand-written XML.
		const scatterStyleNode = this.xmlLookupService.getChildByLocalName(
			seriesContainer,
			'scatterStyle',
		);
		const scatterStyleRaw = String(scatterStyleNode?.['@_val'] ?? '').trim();
		const scatterStyle = SCATTER_STYLES.has(scatterStyleRaw as PptxChartScatterStyle)
			? (scatterStyleRaw as PptxChartScatterStyle)
			: undefined;

		// Bar direction (c:barDir): "bar" is a horizontal bar chart, "col" (or an
		// absent element) a vertical column chart.
		let barDirection: PptxChartData['barDirection'];
		const barDirNode = this.xmlLookupService.getChildByLocalName(seriesContainer, 'barDir');
		if (barDirNode?.['@_val'] !== undefined) {
			barDirection = String(barDirNode['@_val']).trim() === 'bar' ? 'bar' : 'col';
		}

		// Store the chart part path for round-trip save
		const chartPartPath = chartPart.partPath;

		// Parse data table (c:dTable), including its border/fill (c:spPr) and
		// cell-text defaults (c:txPr) so the renderer can honour authored styling.
		const dataTable = parseDataTable(plotArea, this.xmlLookupService, lineStyleColorAdapter);
		// Parse drop lines (c:dropLines) and hi-low lines (c:hiLowLines)
		const dropLines = parseLineStyle(
			seriesContainer,
			'dropLines',
			this.xmlLookupService,
			lineStyleColorAdapter,
		);
		const hiLowLines = parseLineStyle(
			seriesContainer,
			'hiLowLines',
			this.xmlLookupService,
			lineStyleColorAdapter,
		);
		const upDownBars = parseChartUpDownBars(
			seriesContainer,
			this.xmlLookupService,
			lineStyleColorAdapter,
		);

		// Parse 3D surfaces (c:floor, c:sideWall, c:backWall)
		const surfaces = chartRoot
			? parseChart3DSurfaces(chartRoot, this.xmlLookupService, lineStyleColorAdapter)
			: {};

		// Parse plotVisOnly (c:plotVisOnly) — defaults to true when absent
		const plotVisibleOnly = this.parsePlotVisOnly(chartRoot);

		// Parse external data source (c:externalData)
		const externalData = await this.parseChartExternalData(chartSpace, chartPart.partPath);

		// Parse embedded xlsx workbook if available
		const embeddedWorkbookData = await this.parseEmbeddedWorkbook(externalData);
		const dateCategories = rawDateCategories
			? { ...rawDateCategories, date1904: embeddedWorkbookData?.date1904 ?? false }
			: undefined;

		// Use embedded workbook data as fallback when chart XML data is insufficient
		let finalCategories = categories;
		let finalSeries = series;
		if (embeddedWorkbookData) {
			// Fall back to embedded workbook categories when chart XML has none
			if (finalCategories.length === 0 && embeddedWorkbookData.categories.length > 0) {
				finalCategories = embeddedWorkbookData.categories;
			}
			// Fall back to embedded workbook series when all chart XML series have empty values
			const allSeriesEmpty = finalSeries.every((s) => s.values.length === 0);
			if (allSeriesEmpty && embeddedWorkbookData.series.length > 0) {
				finalSeries = finalSeries.map((s, i) => {
					const wbSeries = embeddedWorkbookData.series[i];
					if (wbSeries && wbSeries.values.length > 0) {
						return { ...s, values: wbSeries.values };
					}
					return s;
				});
			}
		}

		// Parse pivot source (c:pivotSource)
		const pivotSource = this.parsePivotSource(chartSpace);

		// Parse Office 2013+ chart color style (chartColorStyle*.xml)
		const chartColorStyle = await this.parseChartColorStyle(chartPartPath);

		// Parse ofPie options when this is an ofPieChart container.
		const ofPieOptions =
			chartType === 'ofPie' ? this.parseOfPieOptions(seriesContainer) : undefined;
		const bubbleOptions =
			chartType === 'bubble'
				? parseBubbleChartOptions(seriesContainer, (key) =>
						this.compatibilityService.getXmlLocalName(key),
					)
				: undefined;

		// Parse view3D, top-level chrome flags, and raw preservation blobs.
		const view3D = this.parseView3D(chartRoot);
		const chartChrome = this.parseChartChrome(chartRoot);
		const layouts = parseChartLayouts(chartRoot, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
		const userShapesXml = this.parseUserShapesXml(chartSpace);
		const userShapes = await this.parseChartUserShapes(chartSpace, chartPart.partPath);
		const pivotFormats = parseChartPivotFormats(chartRoot, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
		const clrMapOvr = this.parseClrMapOvr(chartSpace);
		const printSettings = parseChartPrintSettings(chartSpace, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
		const protection = parseChartProtection(chartSpace, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);

		return {
			chartType,
			categories: finalCategories,
			...(categoryLevels ? { categoryLevels } : {}),
			...(dateCategories ? { dateCategories } : {}),
			series: finalSeries,
			title: titleTextValues[0],
			style: chartStyle,
			grouping,
			...(varyColors !== undefined ? { varyColors } : {}),
			...(firstSliceAngle !== undefined ? { firstSliceAngle } : {}),
			...(doughnutHoleSize !== undefined ? { doughnutHoleSize } : {}),
			...(barGapWidth !== undefined ? { barGapWidth } : {}),
			...(barOverlap !== undefined ? { barOverlap } : {}),
			...(barDirection !== undefined ? { barDirection } : {}),
			...(scatterStyle !== undefined ? { scatterStyle } : {}),
			chartPartPath,
			chartRelationshipId,
			...(dataTable ? { dataTable } : {}),
			...(dropLines ? { dropLines } : {}),
			...(hiLowLines ? { hiLowLines } : {}),
			...(upDownBars ? { upDownBars } : {}),
			...(axes.length > 0 ? { axes } : {}),
			...(surfaces.floor ? { floor: surfaces.floor } : {}),
			...(surfaces.sideWall ? { sideWall: surfaces.sideWall } : {}),
			...(surfaces.backWall ? { backWall: surfaces.backWall } : {}),
			...(externalData ? { externalData } : {}),
			...(embeddedWorkbookData ? { embeddedWorkbookData } : {}),
			...(plotVisibleOnly !== undefined ? { plotVisibleOnly } : {}),
			...(pivotSource ? { pivotSource } : {}),
			...(chartColorStyle?.palette ? { colorPalette: chartColorStyle.palette } : {}),
			...(chartColorStyle?.method ? { colorMethod: chartColorStyle.method } : {}),
			...(chartColorStyle
				? {
						colorStylePartPath: chartColorStyle.partPath,
						colorStyleOriginalPalette: [...chartColorStyle.palette],
						colorStyleOriginalMethod: chartColorStyle.method,
					}
				: {}),
			...(ofPieOptions ? { ofPieOptions } : {}),
			...(bubbleOptions ? { bubbleOptions } : {}),
			...(view3D ? { view3D } : {}),
			...(chartChrome ? { chartChrome } : {}),
			...(layouts ? { layouts } : {}),
			...(userShapesXml ? { userShapesXml } : {}),
			...(userShapes ? { userShapes } : {}),
			...(pivotFormats ? { pivotFormats } : {}),
			...(clrMapOvr ? { clrMapOvr } : {}),
			...(printSettings ? { printSettings } : {}),
			...(protection ? { protection } : {}),
		};
	}

	/**
	 * Parse every chart-type container in the plot area into a single flat
	 * series list plus a shared category list.
	 *
	 * For a single-type chart this parses the one container exactly as before.
	 * For a combo chart (multiple `c:*Chart` siblings) each container's series
	 * are parsed and tagged with the container's chart type via
	 * {@link PptxChartSeries.seriesChartType}, so the combo serializer can
	 * re-emit each series under the correct container on save. Series keep the
	 * document order of their containers.
	 *
	 * @param plotArea - The `c:plotArea` XML object.
	 * @param containerKeys - All chart-type container keys, in document order.
	 * @param chartLevelType - The detected chart-level type. When this is
	 *   `combo`, each series is tagged with its own container type; otherwise no
	 *   per-series type is set (the chart-level type applies to every series).
	 * @returns The merged categories and series.
	 */
	private parseAllChartContainers(
		plotArea: XmlObject,
		containerKeys: string[],
		chartLevelType: PptxChartType,
		axes: PptxChartData['axes'],
	): { categories: string[]; categoryLevels?: string[][]; series: PptxChartData['series'] } {
		const isCombo = chartLevelType === 'combo';
		let categories: string[] = [];
		let categoryLevels: string[][] | undefined;
		const series: PptxChartData['series'] = [];

		for (const containerKey of containerKeys) {
			const container = plotArea[containerKey] as XmlObject | undefined;
			const seriesList = this.xmlLookupService.getChildrenArrayByLocalName(container, 'ser');
			if (seriesList.length === 0) {
				continue;
			}

			// Use the first series with categories found across all containers.
			// `extractChartCategoryValues` expands the sparse cache by `@idx` and
			// `c:ptCount`, keeping blanks as empty strings, so the category array
			// stays the same length as the (already index-expanded) value array.
			if (categories.length === 0) {
				const catNode = this.xmlLookupService.getChildByLocalName(seriesList[0], 'cat');
				// A multi-level category axis (`c:multiLvlStrRef`, e.g. PowerPoint's
				// Quarter > Month grouping) has no `strRef`/`numRef` child, so it must
				// be checked before the flat-cache lookups below or it yields zero
				// categories.
				const multiLevel = this.extractChartCategoryLevels(catNode);
				const fromCat = multiLevel
					? multiLevel.categories
					: this.extractChartCategoryValues(catNode, false);
				const fromNumericCat =
					multiLevel || fromCat.length ? [] : this.extractChartCategoryValues(catNode, true);
				categories = fromCat.length
					? fromCat
					: fromNumericCat.length
						? fromNumericCat
						: this.extractChartCategoryValues(
								this.xmlLookupService.getChildByLocalName(seriesList[0], 'xVal'),
								false,
							);
				if (multiLevel?.categoryLevels) {
					categoryLevels = multiLevel.categoryLevels;
				}
			}

			// The container's real chart type, always resolved: needed to decide
			// where a series' colour lives (`a:solidFill` vs `a:ln/a:solidFill`)
			// regardless of whether this chart is a combo. `seriesChartType` below
			// stays combo-only: it exists for round-trip tagging (re-splitting a
			// combo chart's containers on save), and tagging every series of a
			// plain chart with it would be observable elsewhere.
			const resolvedContainerType = chartContainerLocalNameToType(
				this.compatibilityService.getXmlLocalName(containerKey),
			);
			const containerType = isCombo ? resolvedContainerType : undefined;
			const axisId = resolveChartContainerValueAxisId(container, axes ?? [], this.xmlLookupService);

			series.push(
				...this.buildChartSeries(
					seriesList,
					categories,
					containerType,
					axisId,
					resolvedContainerType,
				),
			);
		}

		return { categories, ...(categoryLevels ? { categoryLevels } : {}), series };
	}

	/**
	 * Read a numeric `@val` from a named child of a chart-type container.
	 * Returns `undefined` when the child or its `@val` is absent/non-finite.
	 */
	private parseChartNumberVal(
		container: XmlObject | undefined,
		localName: string,
	): number | undefined {
		const node = this.xmlLookupService.getChildByLocalName(container, localName);
		const raw = node?.['@_val'];
		if (raw === undefined || raw === null || raw === '') {
			return undefined;
		}
		const num = Number.parseFloat(String(raw));
		return Number.isFinite(num) ? num : undefined;
	}

	/**
	 * Read a boolean `@val` from a named child of a chart-type container.
	 * A present element with no `@val` follows the OOXML `CT_Boolean` default
	 * of `true`; `undefined` when the child is absent.
	 */
	private parseChartBoolVal(
		container: XmlObject | undefined,
		localName: string,
	): boolean | undefined {
		const node = this.xmlLookupService.getChildByLocalName(container, localName);
		if (!node) {
			return undefined;
		}
		const raw = node['@_val'];
		if (raw === undefined || raw === null || raw === '') {
			return true;
		}
		return !(raw === '0' || raw === 'false');
	}

	/**
	 * Build the series array from raw OOXML `c:ser` nodes.
	 *
	 * For each series, extracts the name, numeric values, fill color,
	 * trendlines, error bars, data points, markers, data labels, and
	 * pie explosion offset.
	 *
	 * @param seriesList - Array of `c:ser` XML objects from the chart container.
	 * @param categories - Pre-parsed category labels (used for fallback values).
	 * @param seriesChartType - When set (combo charts), tags every series in this
	 *   container with its source chart type for round-trip.
	 * @param axisId - The container's resolved value-axis id, if any.
	 * @param containerChartType - The container's actual chart type, always
	 *   resolved (unlike `seriesChartType`, which is combo-only). Used to decide
	 *   whether this container's series read their colour from a direct fill or
	 *   from the outline (`a:ln/a:solidFill`), so a plain (non-combo)
	 *   line/scatter/radar/stock chart's authored colour is not dropped.
	 * @returns The series array matching `PptxChartData["series"]`.
	 */
	private buildChartSeries(
		seriesList: XmlObject[],
		categories: string[],
		seriesChartType?: PptxChartType,
		axisId?: number,
		containerChartType?: PptxChartType,
	): PptxChartData['series'] {
		return seriesList.map((seriesNode, seriesIndex) => {
			const seriesName = this.extractChartSeriesName(seriesNode);
			const valNode =
				this.xmlLookupService.getChildByLocalName(seriesNode, 'val') ||
				this.xmlLookupService.getChildByLocalName(seriesNode, 'yVal');
			// Expand the numeric cache to full length, keeping blank (absent/empty
			// c:pt) markers so c:dispBlanksAs can be honoured at render. When the
			// series has no blanks, fall back to the dense extraction so existing
			// behaviour is byte-identical.
			const expanded = extractSeriesNumbersWithBlanks(valNode, this.xmlLookupService);
			const hasBlanks = expanded.some((value) => value === null);
			const values = hasBlanks
				? expanded.map((value) => value ?? 0)
				: this.extractChartPointValues(valNode, true)
						.map((value) => Number.parseFloat(value))
						.filter((value) => Number.isFinite(value));
			const blanks = hasBlanks ? expanded.map((value) => value === null) : undefined;

			// Number-format code for this series' data labels. An explicit
			// `c:dLbls/c:numFmt` wins; otherwise `@sourceLinked` semantics apply and
			// the format comes from the value cache, which is where PowerPoint
			// actually keeps it for the ordinary "linked to source" case.
			const seriesNumberFormat =
				String(
					this.xmlLookupService.getChildByLocalName(
						this.xmlLookupService.getChildByLocalName(seriesNode, 'dLbls'),
						'numFmt',
					)?.['@_formatCode'] ?? '',
				).trim() ||
				String(
					this.xmlLookupService.getScalarChildByLocalName(
						this.xmlLookupService.getChildByLocalName(
							this.xmlLookupService.getChildByLocalName(valNode, 'numRef') ?? valNode,
							'numCache',
						),
						'formatCode',
					) ?? '',
				).trim();

			const seriesShapeProperties = this.xmlLookupService.getChildByLocalName(seriesNode, 'spPr');
			// A series' explicit colour lives at `c:ser/c:spPr/a:solidFill` for area
			// fills (bar/area/pie/bubble), but line-drawn series (line/scatter/radar/
			// stock) author it on the outline instead: `c:ser/c:spPr/a:ln/a:solidFill`.
			// Reading only the direct fill dropped those, so authored line colours
			// fell back to the render-side palette. This must key off the
			// container's ACTUAL chart type (`containerChartType`, always resolved),
			// not `seriesChartType` (which is only set for combo charts): a plain
			// line/scatter/radar/stock chart has no `seriesChartType` tag at all, so
			// keying off it here dropped every such chart's authored colour.
			const readsLineColor = isLineDrawnChartType(containerChartType);
			const seriesColor =
				this.parseColor(
					this.xmlLookupService.getChildByLocalName(seriesShapeProperties, 'solidFill'),
				) ??
				(readsLineColor
					? this.parseColor(
							this.xmlLookupService.getChildByLocalName(
								this.xmlLookupService.getChildByLocalName(seriesShapeProperties, 'ln'),
								'solidFill',
							),
						)
					: undefined);

			const fallbackValues =
				values.length > 0 ? values : categories.map((_, index) => index + 1 + seriesIndex);

			// Parse trendlines (c:trendline)
			const colorAdapter = {
				parseColor: (n: XmlObject | undefined, p?: string) => this.parseColor(n, p),
			};
			const trendlines = parseSeriesTrendlines(seriesNode, this.xmlLookupService, colorAdapter);
			// Parse error bars (c:errBars)
			const errBars = parseSeriesErrBars(
				seriesNode,
				this.xmlLookupService,
				this.extractChartPointValues.bind(this),
				colorAdapter,
			);

			// Parse data points (c:dPt)
			const dataPoints = parseSeriesDataPoints(seriesNode, this.xmlLookupService, colorAdapter);

			// Parse series marker (c:marker)
			const seriesMarker = parseMarker(
				this.xmlLookupService.getChildByLocalName(seriesNode, 'marker'),
				this.xmlLookupService,
				colorAdapter,
			);

			// Parse individual data labels (c:dLbl)
			const dataLabels = parseSeriesDataLabels(seriesNode, this.xmlLookupService);

			// Parse series-level explosion (c:explosion for pie)
			const explosion = parseSeriesExplosion(seriesNode, this.xmlLookupService);

			// Per-series x values (c:xVal) and bubble sizes (c:bubbleSize). Both are
			// declared PER SERIES by CT_ScatterSer / CT_BubbleSer, so neither can be
			// taken off the first series or guessed from the series count.
			const xValues = extractSeriesNumbersWithBlanks(
				this.xmlLookupService.getChildByLocalName(seriesNode, 'xVal'),
				this.xmlLookupService,
			).map((value) => value ?? Number.NaN);
			const bubbleSizes = extractSeriesNumbersWithBlanks(
				this.xmlLookupService.getChildByLocalName(seriesNode, 'bubbleSize'),
				this.xmlLookupService,
			).map((value) => value ?? 0);

			// Series-level c:dLbls content flags. PowerPoint writes the user's
			// choices here and leaves the chart-type-level group all-zero, so this
			// is the group that decides whether a pie shows percentages.
			const seriesDataLabelGroup = this.xmlLookupService.getChildByLocalName(seriesNode, 'dLbls');
			const dataLabelOptions = seriesDataLabelGroup
				? parseChartDataLabelOptions(seriesDataLabelGroup, this.xmlLookupService)
				: undefined;

			// `c:ser/c:spPr/a:ln/a:noFill`: how PowerPoint expresses a marker-only
			// scatter or a line series drawn without its line.
			const seriesLine = this.xmlLookupService.getChildByLocalName(seriesShapeProperties, 'ln');
			const lineNoFill = seriesLine
				? Object.keys(seriesLine).some(
						(key) => this.compatibilityService.getXmlLocalName(key) === 'noFill',
					)
				: false;

			// Parse bezier smoothing flag (c:smooth for line/scatter series).
			const smoothNode = this.xmlLookupService.getChildByLocalName(seriesNode, 'smooth');
			const smooth = smoothNode
				? !(smoothNode['@_val'] === '0' || smoothNode['@_val'] === 'false')
				: undefined;

			// Parse series-level c:invertIfNegative (bar/column): negative points draw
			// with an inverted fill. A per-point c:dPt override takes precedence.
			const invertNode = this.xmlLookupService.getChildByLocalName(seriesNode, 'invertIfNegative');
			const invertIfNegative = invertNode
				? !(invertNode['@_val'] === '0' || invertNode['@_val'] === 'false')
				: undefined;

			return {
				name: seriesName.trim().length > 0 ? seriesName : `Series ${seriesIndex + 1}`,
				values: fallbackValues,
				...(blanks ? { blanks } : {}),
				...(xValues.length > 0 ? { xValues } : {}),
				...(bubbleSizes.length > 0 ? { bubbleSizes } : {}),
				...(dataLabelOptions && Object.keys(dataLabelOptions).length > 0
					? { dataLabelOptions }
					: {}),
				...(lineNoFill ? { lineNoFill } : {}),
				...(seriesNumberFormat ? { numberFormat: seriesNumberFormat } : {}),
				color: seriesColor,
				...(trendlines.length > 0 ? { trendlines } : {}),
				...(errBars.length > 0 ? { errBars } : {}),
				...(dataPoints.length > 0 ? { dataPoints } : {}),
				...(seriesMarker ? { marker: seriesMarker } : {}),
				...(dataLabels.length > 0 ? { dataLabels } : {}),
				...(explosion !== undefined ? { explosion } : {}),
				...(invertIfNegative !== undefined ? { invertIfNegative } : {}),
				...(smooth !== undefined ? { smooth } : {}),
				...(axisId !== undefined ? { axisId } : {}),
				...(seriesChartType ? { seriesChartType } : {}),
			};
		});
	}

	/**
	 * Parse a cx: namespace (Office 2016+) chart using the utility parser.
	 *
	 * @param plotArea - The `c:plotArea` XML object.
	 * @param chartType - The detected chart type.
	 * @param chartSpace - The `c:chartSpace` XML root.
	 * @param chartRoot - The `c:chart` XML element.
	 * @param chartPartPath - The ZIP path of the chart part.
	 * @param chartRelationshipId - The relationship ID linking the slide to this chart.
	 * @returns Parsed chart data, or `undefined` if cx parsing yields no series.
	 */
	private async parseCxChart(
		plotArea: XmlObject,
		chartType: PptxChartData['chartType'],
		chartSpace: XmlObject | undefined,
		chartRoot: XmlObject | undefined,
		chartPartPath: string,
		chartRelationshipId: string,
	): Promise<PptxChartData | undefined> {
		const result = parseCxChartSeries(plotArea, this.xmlLookupService, chartSpace);
		if (!result) {
			return undefined;
		}

		const titleNode = this.xmlLookupService.getChildByLocalName(chartRoot, 'title');
		const titleTextValues: string[] = [];
		this.collectLocalTextValues(titleNode, 't', titleTextValues);
		const chartStyle = this.extractChartStyle(chartSpace, chartRoot);

		// Merge hasDataLabels from cx: data labels parsing
		if (result.hasDataLabels && chartStyle) {
			chartStyle.hasDataLabels = true;
		}

		// Parse plotVisOnly (c:plotVisOnly) — defaults to true when absent
		const plotVisibleOnly = this.parsePlotVisOnly(chartRoot);

		// Parse external data source (c:externalData)
		const externalData = await this.parseChartExternalData(chartSpace, chartPartPath);

		// Parse embedded xlsx workbook if available
		const embeddedWorkbookData = await this.parseEmbeddedWorkbook(externalData);

		// Parse pivot source (c:pivotSource)
		const pivotSource = this.parsePivotSource(chartSpace);

		// Parse Office 2013+ chart color style (chartColorStyle*.xml)
		const chartColorStyle = await this.parseChartColorStyle(chartPartPath);

		// Parse view3D, top-level chrome flags, and raw preservation blobs.
		const view3D = this.parseView3D(chartRoot);
		const chartChrome = this.parseChartChrome(chartRoot);
		const layouts = parseChartLayouts(chartRoot, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
		const userShapesXml = this.parseUserShapesXml(chartSpace);
		const userShapes = await this.parseChartUserShapes(chartSpace, chartPartPath);
		const pivotFormats = parseChartPivotFormats(chartRoot, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
		const clrMapOvr = this.parseClrMapOvr(chartSpace);
		const printSettings = parseChartPrintSettings(chartSpace, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);
		const protection = parseChartProtection(chartSpace, (key) =>
			this.compatibilityService.getXmlLocalName(key),
		);

		return {
			chartType,
			categories: result.categories,
			...(result.categoryLevels ? { categoryLevels: result.categoryLevels } : {}),
			series: result.series,
			title: titleTextValues[0],
			style: chartStyle,
			chartPartPath,
			chartRelationshipId,
			...(externalData ? { externalData } : {}),
			...(embeddedWorkbookData ? { embeddedWorkbookData } : {}),
			...(plotVisibleOnly !== undefined ? { plotVisibleOnly } : {}),
			...(pivotSource ? { pivotSource } : {}),
			...(chartColorStyle?.palette ? { colorPalette: chartColorStyle.palette } : {}),
			...(chartColorStyle?.method ? { colorMethod: chartColorStyle.method } : {}),
			...(chartColorStyle
				? {
						colorStylePartPath: chartColorStyle.partPath,
						colorStyleOriginalPalette: [...chartColorStyle.palette],
						colorStyleOriginalMethod: chartColorStyle.method,
					}
				: {}),
			...(view3D ? { view3D } : {}),
			...(chartChrome ? { chartChrome } : {}),
			...(layouts ? { layouts } : {}),
			...(userShapesXml ? { userShapesXml } : {}),
			...(userShapes ? { userShapes } : {}),
			...(pivotFormats ? { pivotFormats } : {}),
			...(clrMapOvr ? { clrMapOvr } : {}),
			...(printSettings ? { printSettings } : {}),
			...(protection ? { protection } : {}),
		};
	}
}
