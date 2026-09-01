/**
 * Move a chart between the two OOXML chart part families on save.
 *
 * A 2006 DrawingML chart (`c:chartSpace`, `ppt/charts/chartN.xml`) and an
 * Office 2016+ ChartEx chart (`cx:chartSpace`, `ppt/extendedCharts/chartN.xml`)
 * differ in part content type, relationship type and the `a:graphicData`
 * envelope on the slide, so a type change across families (bar -> funnel,
 * waterfall -> pie) cannot be patched into the existing part: PowerPoint
 * would open a chart part whose markup contradicts its declared family.
 * Instead the chart part is regenerated from the model into a fresh part of
 * the right family and the slide is re-pointed at it. The old part is left
 * in place (another slide may still reference it).
 *
 * @module runtime/chart-part-family-switch
 */

import type JSZip from 'jszip';

import type { PptxChartData, XmlObject } from '../../types';
import { chartTypeToContainerLocalName } from '../../utils/chart-container-content-model';
import { buildChartExSpaceXml, canGenerateChartEx } from '../../utils/chart-cx-generator';
import { buildChartSpaceXml } from '../../utils/chart-xml-generator';
import {
	ensureContentTypeOverride,
	nextFreeChartPartPath,
	rewriteChartGraphicFrames,
	rewriteChartRelationship,
} from './chart-part-registration';

export type ChartPartFamily = 'chart' | 'chartEx';

/** Content type of a ChartEx part (`application/vnd.ms-office.chartex+xml`). */
export const CHART_EX_CONTENT_TYPE = 'application/vnd.ms-office.chartex+xml';
/** Content type of a 2006 DrawingML chart part. */
export const CHART_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
/** Relationship type from a slide to a ChartEx part. */
export const CHART_EX_REL_TYPE = 'http://schemas.microsoft.com/office/2014/relationships/chartEx';
/** Relationship type from a slide to a 2006 chart part. */
export const CHART_REL_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';

type GetLocalName = (key: string) => string;

export interface ChartPartFamilySwitchDeps {
	zip: JSZip;
	parser: { parse(xml: string): unknown };
	builder: { build(tree: unknown): string };
	getLocalName: GetLocalName;
}

/** Which family a parsed chart part belongs to, judged by its markup. */
export function detectChartPartFamily(
	chartSpace: XmlObject,
	getLocalName: GetLocalName,
): ChartPartFamily {
	const keys = Object.keys(chartSpace);
	if (keys.some((key) => getLocalName(key) === 'chartData')) {
		return 'chartEx';
	}
	const chartKey = keys.find((key) => getLocalName(key) === 'chart');
	const chart = chartKey ? (chartSpace[chartKey] as XmlObject | undefined) : undefined;
	const plotAreaKey = chart
		? Object.keys(chart).find((k) => getLocalName(k) === 'plotArea')
		: undefined;
	const plotArea = plotAreaKey && chart ? (chart[plotAreaKey] as XmlObject | undefined) : undefined;
	const plotAreaKeys = plotArea && typeof plotArea === 'object' ? Object.keys(plotArea) : [];
	return plotAreaKeys.some((key) => {
		const local = getLocalName(key);
		return local === 'plotAreaRegion' || local === 'plotSurface';
	})
		? 'chartEx'
		: 'chart';
}

/**
 * The family the model's `chartType` must be saved into, or `undefined` when
 * the type has no generator (`combo`, `unknown`) and the part must be kept.
 */
export function targetChartPartFamily(chartData: PptxChartData): ChartPartFamily | undefined {
	if (canGenerateChartEx(chartData)) {
		return 'chartEx';
	}
	return chartTypeToContainerLocalName(chartData.chartType) ? 'chart' : undefined;
}

/**
 * Regenerate `chartData` as a brand-new part of `family`, register its
 * content type, and re-point the slide relationship plus the graphic frame
 * envelope at it. Returns the new part path, or `undefined` (with nothing
 * written) when the slide does not reference the chart it claims to.
 */
export async function switchChartPartFamily(
	deps: ChartPartFamilySwitchDeps,
	chartData: PptxChartData,
	slidePath: string,
	family: ChartPartFamily,
): Promise<string | undefined> {
	const oldPartPath = chartData.chartPartPath;
	if (!oldPartPath) {
		return undefined;
	}
	const extended = family === 'chartEx';
	const chartXml = extended ? buildChartExSpaceXml(chartData) : buildChartSpaceXml(chartData);
	const newPartPath = nextFreeChartPartPath(
		deps.zip,
		extended ? 'ppt/extendedCharts' : 'ppt/charts',
	);
	const relationship = await rewriteChartRelationship(deps, slidePath, {
		relationshipId: chartData.chartRelationshipId,
		oldPartPath,
		newPartPath,
		relationshipType: extended ? CHART_EX_REL_TYPE : CHART_REL_TYPE,
	});
	if (!relationship) {
		return undefined;
	}

	deps.zip.file(newPartPath, deps.builder.build(chartXml));
	await ensureContentTypeOverride(
		deps,
		newPartPath,
		extended ? CHART_EX_CONTENT_TYPE : CHART_CONTENT_TYPE,
	);
	await rewriteChartGraphicFrames(deps, slidePath, relationship, extended);

	chartData.chartPartPath = newPartPath;
	chartData.chartRelationshipId = relationship;
	return newPartPath;
}
