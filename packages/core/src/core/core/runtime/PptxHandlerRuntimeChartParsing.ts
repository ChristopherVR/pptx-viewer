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
import type { PptxChartData } from '../../types';
import {
	parseSeriesTrendlines,
	parseSeriesErrBars,
	parseDataTable,
	parseLineStyle,
} from '../../utils/chart-advanced-parser';
import { parseChartAxes, parseChart3DSurfaces } from '../../utils/chart-axis-parser';
import { parseCxChartSeries } from '../../utils/chart-cx-parser';
import {
	parseSeriesDataPoints,
	parseSeriesDataLabels,
	parseSeriesExplosion,
	parseMarker,
} from '../../utils/chart-series-detail-parser';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartColorStyle';

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
		const seriesContainerKey = Object.keys(plotArea).find((key) =>
			this.compatibilityService.getXmlLocalName(key).endsWith('Chart'),
		);

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
		const seriesList = this.xmlLookupService.getChildrenArrayByLocalName(seriesContainer, 'ser');
		if (seriesList.length === 0) {
			return undefined;
		}

		const categoriesFromFirstSeries = this.extractChartPointValues(
			this.xmlLookupService.getChildByLocalName(seriesList[0], 'cat'),
			false,
		);
		const categories = categoriesFromFirstSeries.length
			? categoriesFromFirstSeries
			: this.extractChartPointValues(
					this.xmlLookupService.getChildByLocalName(seriesList[0], 'xVal'),
					false,
				);

		const series = this.buildChartSeries(seriesList, categories);

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

		// Store the chart part path for round-trip save
		const chartPartPath = chartPart.partPath;

		// Parse data table (c:dTable)
		const dataTable = parseDataTable(plotArea, this.xmlLookupService);
		// Parse drop lines (c:dropLines) and hi-low lines (c:hiLowLines)
		const lineStyleColorAdapter = {
			parseColor: (n: XmlObject | undefined, p?: string) => this.parseColor(n, p),
		};
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

		// Parse axis formatting (c:catAx, c:valAx, c:dateAx, c:serAx)
		const axes = parseChartAxes(
			plotArea,
			this.xmlLookupService,
			lineStyleColorAdapter,
			(key: string) => this.compatibilityService.getXmlLocalName(key),
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

		return {
			chartType,
			categories: finalCategories,
			series: finalSeries,
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
			...(pivotSource ? { pivotSource } : {}),
			...(chartColorStyle?.palette ? { colorPalette: chartColorStyle.palette } : {}),
			...(chartColorStyle?.method ? { colorMethod: chartColorStyle.method } : {}),
		};
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
	 * @returns The series array matching `PptxChartData["series"]`.
	 */
	private buildChartSeries(seriesList: XmlObject[], categories: string[]): PptxChartData['series'] {
		return seriesList.map((seriesNode, seriesIndex) => {
			const seriesName = this.extractChartSeriesName(seriesNode);
			const values = this.extractChartPointValues(
				this.xmlLookupService.getChildByLocalName(seriesNode, 'val') ||
					this.xmlLookupService.getChildByLocalName(seriesNode, 'yVal'),
				true,
			)
				.map((value) => Number.parseFloat(value))
				.filter((value) => Number.isFinite(value));

			const seriesShapeProperties = this.xmlLookupService.getChildByLocalName(seriesNode, 'spPr');
			const seriesColor = this.parseColor(
				this.xmlLookupService.getChildByLocalName(seriesShapeProperties, 'solidFill'),
			);

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

			return {
				name: seriesName.trim().length > 0 ? seriesName : `Series ${seriesIndex + 1}`,
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
		const result = parseCxChartSeries(plotArea, this.xmlLookupService);
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
			...(pivotSource ? { pivotSource } : {}),
			...(chartColorStyle?.palette ? { colorPalette: chartColorStyle.palette } : {}),
			...(chartColorStyle?.method ? { colorMethod: chartColorStyle.method } : {}),
		};
	}
}
