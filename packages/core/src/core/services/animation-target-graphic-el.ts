/**
 * Parse/serialize helpers for `p:spTgt/p:graphicEl` (CT_TLGraphicalObjectBuildElement,
 * ECMA-376 S19.5.34) and `p:spTgt/p:oleChartEl` (CT_TLOleChartTargetElement,
 * ECMA-376 S19.5.44): the chart/diagram-series-and-category and legacy
 * OLE-chart sub-element targeting choices nested inside a `p:spTgt` shape
 * target.
 *
 * Split out of `animation-target-build-helpers` to keep that file within the
 * project's per-file LOC budget.
 *
 * @module services/animation-target-graphic-el
 */
import type {
	PptxAnimationGraphicElementTarget,
	PptxAnimationOleChartElementTarget,
	XmlObject,
} from '../types';

/** Parse `p:spTgt/p:graphicEl` (chart/diagram series/category/element target). */
export function parseGraphicElement(
	shape: XmlObject,
): PptxAnimationGraphicElementTarget | undefined {
	const graphicEl = shape['p:graphicEl'] as XmlObject | undefined;
	if (!graphicEl) {
		return undefined;
	}
	const dgm = graphicEl['p:dgm'] as XmlObject | undefined;
	const chart = graphicEl['p:chart'] as XmlObject | undefined;
	const node = dgm ?? chart;
	if (!node) {
		return undefined;
	}
	const seriesIdx = node['@_seriesIdx'] !== undefined ? Number(node['@_seriesIdx']) : undefined;
	const categoryIdx =
		node['@_categoryIdx'] !== undefined ? Number(node['@_categoryIdx']) : undefined;
	return {
		kind: dgm ? 'dgm' : 'chart',
		...(seriesIdx !== undefined && !Number.isNaN(seriesIdx) ? { seriesIdx } : {}),
		...(categoryIdx !== undefined && !Number.isNaN(categoryIdx) ? { categoryIdx } : {}),
		...(node['@_bldStep'] !== undefined ? { bldStep: String(node['@_bldStep']) } : {}),
	};
}

/** Parse `p:spTgt/p:oleChartEl` (legacy OLE Graph chart sub-element target). */
export function parseOleChartElement(
	shape: XmlObject,
): PptxAnimationOleChartElementTarget | undefined {
	const oleChartEl = shape['p:oleChartEl'] as XmlObject | undefined;
	if (!oleChartEl || oleChartEl['@_type'] === undefined) {
		return undefined;
	}
	const level = oleChartEl['@_lvl'] !== undefined ? Number(oleChartEl['@_lvl']) : undefined;
	return {
		subelementType: String(oleChartEl['@_type']),
		...(level !== undefined && !Number.isNaN(level) ? { level } : {}),
	};
}

/** Serialize a {@link PptxAnimationGraphicElementTarget} onto a `p:spTgt` shape XML object. */
export function serializeGraphicElement(
	shape: XmlObject,
	graphicElement: PptxAnimationGraphicElementTarget | undefined,
): void {
	if (!graphicElement) {
		delete shape['p:graphicEl'];
		return;
	}
	const { kind, seriesIdx, categoryIdx, bldStep } = graphicElement;
	const nodeKey = kind === 'dgm' ? 'p:dgm' : 'p:chart';
	const existingGraphicEl = (shape['p:graphicEl'] as XmlObject | undefined) ?? {};
	const node: XmlObject = {
		...((existingGraphicEl[nodeKey] as XmlObject | undefined) ?? {}),
		...(seriesIdx !== undefined ? { '@_seriesIdx': String(seriesIdx) } : {}),
		...(categoryIdx !== undefined ? { '@_categoryIdx': String(categoryIdx) } : {}),
		...(bldStep !== undefined ? { '@_bldStep': bldStep } : {}),
	};
	shape['p:graphicEl'] = {
		...existingGraphicEl,
		[nodeKey]: node,
	} as XmlObject;
}

/** Serialize a {@link PptxAnimationOleChartElementTarget} onto a `p:spTgt` shape XML object. */
export function serializeOleChartElement(
	shape: XmlObject,
	oleChartElement: PptxAnimationOleChartElementTarget | undefined,
): void {
	if (!oleChartElement) {
		delete shape['p:oleChartEl'];
		return;
	}
	shape['p:oleChartEl'] = {
		...((shape['p:oleChartEl'] as XmlObject | undefined) ?? {}),
		'@_type': oleChartElement.subelementType,
		...(oleChartElement.level !== undefined ? { '@_lvl': String(oleChartElement.level) } : {}),
	};
}
