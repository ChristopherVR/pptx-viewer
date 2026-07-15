import type { PptxChartShapeProps, PptxChartUpDownBars, XmlObject } from '../types';
import { parseShapeProps } from './chart-series-detail-parser';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}
interface ColorParserLike {
	parseColor: (node: XmlObject | undefined, placeholder?: string) => string | undefined;
}
type LocalName = (key: string) => string;
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
	'axId',
	'extLst',
] as const;

/** Parse `c:upDownBars`, including both bars' DrawingML shape properties. */
export function parseChartUpDownBars(
	chartContainer: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartUpDownBars | undefined {
	if (!chartContainer) {
		return undefined;
	}
	const node = xmlLookup.getChildByLocalName(chartContainer, 'upDownBars');
	if (!node) {
		return undefined;
	}
	const result: PptxChartUpDownBars = {};
	const gapRaw = xmlLookup.getChildByLocalName(node, 'gapWidth')?.['@_val'];
	if (gapRaw !== undefined) {
		const gap = Number.parseFloat(String(gapRaw).replace(/%$/u, ''));
		if (Number.isFinite(gap) && gap >= 0 && gap <= 500) {
			result.gapWidth = gap;
		}
	}
	for (const name of ['upBars', 'downBars'] as const) {
		const bar = xmlLookup.getChildByLocalName(node, name);
		const props = parseShapeProps(
			xmlLookup.getChildByLocalName(bar, 'spPr'),
			xmlLookup,
			colorParser,
		);
		if (props) {
			result[name] = props;
		}
	}
	return result;
}

const findKey = (node: XmlObject, name: string, localName: LocalName) =>
	Object.keys(node).find((key) => localName(key) === name);
const hex = (value: string) => value.replace(/^#/u, '').toUpperCase();

function setDrawingChild(
	node: XmlObject,
	name: string,
	value: XmlObject,
	order: readonly string[],
	localName: LocalName,
): void {
	const key = findKey(node, name, localName);
	if (key) {
		node[key] = value;
		return;
	}
	const entries = Object.entries(node);
	const rank = order.indexOf(name);
	const index = entries.findIndex(([candidate]) => {
		const candidateRank = order.indexOf(localName(candidate));
		return candidateRank >= 0 && candidateRank > rank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`a:${name}`, value]);
	for (const candidate of Object.keys(node)) {
		delete node[candidate];
	}
	for (const [candidate, child] of entries) {
		node[candidate] = child;
	}
}

function applyShapeProps(
	existing: XmlObject | undefined,
	style: PptxChartShapeProps,
	localName: LocalName,
): XmlObject {
	const spPr: XmlObject = { ...(existing ?? {}) };
	if (style.fillColor) {
		const noFill = findKey(spPr, 'noFill', localName);
		if (noFill) {
			delete spPr[noFill];
		}
		setDrawingChild(
			spPr,
			'solidFill',
			{ 'a:srgbClr': { '@_val': hex(style.fillColor) } },
			[
				'xfrm',
				'prstGeom',
				'custGeom',
				'noFill',
				'solidFill',
				'gradFill',
				'pattFill',
				'ln',
				'effectLst',
				'effectDag',
				'scene3d',
				'sp3d',
				'extLst',
			],
			localName,
		);
	}
	const hasLine = style.strokeColor || style.strokeWidth !== undefined || style.strokeDashStyle;
	if (hasLine) {
		const key = findKey(spPr, 'ln', localName) ?? 'a:ln';
		const line: XmlObject = { ...((spPr[key] as XmlObject | undefined) ?? {}) };
		if (style.strokeWidth !== undefined) {
			line['@_w'] = String(Math.round(style.strokeWidth * 12700));
		}
		if (style.strokeColor) {
			const noFill = findKey(line, 'noFill', localName);
			if (noFill) {
				delete line[noFill];
			}
			setDrawingChild(
				line,
				'solidFill',
				{ 'a:srgbClr': { '@_val': hex(style.strokeColor) } },
				[
					'noFill',
					'solidFill',
					'gradFill',
					'pattFill',
					'prstDash',
					'custDash',
					'round',
					'bevel',
					'miter',
					'headEnd',
					'tailEnd',
					'extLst',
				],
				localName,
			);
		}
		if (style.strokeDashStyle) {
			setDrawingChild(
				line,
				'prstDash',
				{ '@_val': style.strokeDashStyle },
				[
					'noFill',
					'solidFill',
					'gradFill',
					'pattFill',
					'prstDash',
					'custDash',
					'round',
					'bevel',
					'miter',
					'headEnd',
					'tailEnd',
					'extLst',
				],
				localName,
			);
		}
		setDrawingChild(
			spPr,
			'ln',
			line,
			[
				'xfrm',
				'prstGeom',
				'custGeom',
				'noFill',
				'solidFill',
				'gradFill',
				'pattFill',
				'ln',
				'effectLst',
				'effectDag',
				'scene3d',
				'sp3d',
				'extLst',
			],
			localName,
		);
	}
	return spPr;
}

function setOrdered(
	node: XmlObject,
	name: string,
	value: XmlObject,
	order: readonly string[],
	localName: LocalName,
): void {
	const key = findKey(node, name, localName);
	if (key) {
		node[key] = value;
		return;
	}
	const entries = Object.entries(node);
	const rank = order.indexOf(name);
	const index = entries.findIndex(([candidate]) => {
		const candidateRank = order.indexOf(localName(candidate));
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

/** Apply, insert, or explicitly remove `c:upDownBars`. */
export function applyChartUpDownBars(
	chartContainer: XmlObject,
	options: PptxChartUpDownBars | null | undefined,
	localName: LocalName,
): void {
	if (options === undefined) {
		return;
	}
	const key = findKey(chartContainer, 'upDownBars', localName);
	if (options === null) {
		if (key) {
			delete chartContainer[key];
		}
		return;
	}
	const node: XmlObject = { ...((key ? chartContainer[key] : undefined) as XmlObject | undefined) };
	if (options.gapWidth !== undefined) {
		if (!Number.isFinite(options.gapWidth) || options.gapWidth < 0 || options.gapWidth > 500) {
			throw new RangeError('gapWidth must be between 0 and 500');
		}
		setOrdered(
			node,
			'gapWidth',
			{ '@_val': `${options.gapWidth}%` },
			['gapWidth', 'upBars', 'downBars', 'extLst'],
			localName,
		);
	}
	for (const name of ['upBars', 'downBars'] as const) {
		const style = options[name];
		if (!style) {
			continue;
		}
		const existingBar = findKey(node, name, localName);
		const bar: XmlObject = {
			...((existingBar ? node[existingBar] : undefined) as XmlObject | undefined),
		};
		const spPrKey = findKey(bar, 'spPr', localName) ?? 'c:spPr';
		bar[spPrKey] = applyShapeProps(bar[spPrKey] as XmlObject | undefined, style, localName);
		setOrdered(node, name, bar, ['gapWidth', 'upBars', 'downBars', 'extLst'], localName);
	}
	setOrdered(chartContainer, 'upDownBars', node, CONTAINER_ORDER, localName);
}
