/**
 * Serializer for the two ChartML "helper line" elements that share the exact
 * same shape: `c:dropLines` and `c:hiLowLines` (both CT_ChartLines, a bare
 * optional `c:spPr`). Both are children of a `c:lineChart`/`c:stockChart`
 * chart-type container, parsed by the sibling {@link parseLineStyle} in
 * `chart-advanced-parser.ts` into a flat {@link PptxChartLineStyle}, but until
 * now that edit was never written back on save (see the `edit: unassessed`
 * grading in `openxml-coverage-chart-supplement.ts`): the model field parsed
 * a colour/width/dash and a subsequent save silently dropped any change to
 * it, falling back to the preserved source XML.
 *
 * @module utils/chart-line-style-serializer
 */
import type { PptxChartLineStyle, XmlObject } from '../types';
import type { ResolveChartColor } from './chart-color-choice';
import { writeChartShapeProps } from './chart-shape-props-writer';

type LocalName = (key: string) => string;

/** CT_*Chart children that may follow `c:dropLines`/`c:hiLowLines`, in schema order. */
const CONTAINER_ORDER = [
	'grouping',
	'varyColors',
	'ser',
	'dLbls',
	'dropLines',
	'hiLowLines',
	'upDownBars',
	'marker',
	'smooth',
	'gapWidth',
	'gapDepth',
	'shape',
	'axId',
	'extLst',
] as const;

function findKey(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function setOrdered(node: XmlObject, name: string, value: XmlObject, localName: LocalName): void {
	const key = findKey(node, name, localName);
	if (key) {
		node[key] = value;
		return;
	}
	const entries = Object.entries(node);
	const rank = CONTAINER_ORDER.indexOf(name as (typeof CONTAINER_ORDER)[number]);
	const index = entries.findIndex(([candidate]) => {
		const candidateRank = CONTAINER_ORDER.indexOf(
			localName(candidate) as (typeof CONTAINER_ORDER)[number],
		);
		return candidateRank >= 0 && candidateRank > rank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`c:${name}`, value]);
	for (const candidate of Object.keys(node)) {
		delete node[candidate];
	}
	for (const [candidate, child] of entries) {
		node[candidate] = child;
	}
}

/**
 * Apply, insert, or explicitly remove a `c:dropLines`/`c:hiLowLines` element
 * on a chart-type container. `null` removes the element entirely; `undefined`
 * is a no-op (passthrough); an empty `{}` inserts/keeps the bare element
 * (PowerPoint treats the element's mere presence, independent of `c:spPr`, as
 * "show this helper line").
 */
export function applyChartLineStyle(
	chartContainer: XmlObject,
	elementName: 'dropLines' | 'hiLowLines',
	style: PptxChartLineStyle | null | undefined,
	localName: LocalName,
	resolveColor?: ResolveChartColor,
): void {
	if (style === undefined) {
		return;
	}
	const key = findKey(chartContainer, elementName, localName);
	if (style === null) {
		if (key) {
			delete chartContainer[key];
		}
		return;
	}
	const existing = (key ? chartContainer[key] : undefined) as XmlObject | undefined;
	const node: XmlObject = { ...existing };
	const hasLineProps = style.color || style.width !== undefined || style.dashStyle;
	if (hasLineProps) {
		const spPrKey = findKey(node, 'spPr', localName) ?? 'c:spPr';
		node[spPrKey] = writeChartShapeProps(
			node[spPrKey] as XmlObject | undefined,
			{ strokeColor: style.color, strokeWidth: style.width, strokeDashStyle: style.dashStyle },
			localName,
			resolveColor,
		);
	}
	setOrdered(chartContainer, elementName, node, localName);
}
