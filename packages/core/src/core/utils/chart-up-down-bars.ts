import type { PptxChartUpDownBars, XmlObject } from '../types';
import type { ResolveChartColor } from './chart-color-choice';
import { chartPercentUnionValue } from './chart-percent-union-value';
import { parseShapeProps } from './chart-series-detail-parser';
import { writeChartShapeProps } from './chart-shape-props-writer';

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
	resolveColor?: ResolveChartColor,
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
		// ST_GapAmount is a union of ST_GapAmountPercent and ST_GapAmountUShort.
		// PowerPoint only implements the unsigned-short member; `val="150%"` is
		// schema-valid yet fatal (0x80070570). See chartPercentUnionValue.
		setOrdered(
			node,
			'gapWidth',
			{ '@_val': chartPercentUnionValue(options.gapWidth, { name: 'gapWidth', min: 0, max: 500 }) },
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
		bar[spPrKey] = writeChartShapeProps(
			bar[spPrKey] as XmlObject | undefined,
			style,
			localName,
			resolveColor,
		);
		setOrdered(node, name, bar, ['gapWidth', 'upBars', 'downBars', 'extLst'], localName);
	}
	setOrdered(chartContainer, 'upDownBars', node, CONTAINER_ORDER, localName);
}
