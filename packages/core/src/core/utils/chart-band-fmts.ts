/**
 * Parse and serialize a surface chart's per-band colour overrides
 * (`c:surfaceChart/c:bandFmts/c:bandFmt`, CT_BandFmts / CT_BandFmt).
 *
 * Each `c:bandFmt` pairs an `c:idx` (the band's position among the value
 * axis's major-unit height bands) with an `c:spPr` fill/stroke. Renderers use
 * this to paint a surface chart with discrete colour bands instead of the
 * default continuous ramp.
 *
 * @module utils/chart-band-fmts
 */
import type { PptxChartBandFmt, XmlObject } from '../types';
import type { ResolveChartColor } from './chart-color-choice';
import { parseShapeProps } from './chart-series-detail-parser';
import { writeChartShapeProps } from './chart-shape-props-writer';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}
interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}
type LocalName = (key: string) => string;

function safeUnsignedInt(val: unknown): number | undefined {
	const n = Number(val);
	return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : undefined;
}

/** Parse `c:bandFmts/c:bandFmt*` from a `c:surfaceChart` / `c:surface3DChart` container. */
export function parseChartBandFmts(
	seriesContainer: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartBandFmt[] | undefined {
	const bandFmtsNode = xmlLookup.getChildByLocalName(seriesContainer, 'bandFmts');
	if (!bandFmtsNode) {
		return undefined;
	}
	const nodes = xmlLookup.getChildrenArrayByLocalName(bandFmtsNode, 'bandFmt');
	const result = nodes
		.map((node): PptxChartBandFmt | undefined => {
			const idx = safeUnsignedInt(xmlLookup.getChildByLocalName(node, 'idx')?.['@_val']);
			if (idx === undefined) {
				return undefined;
			}
			const spPr = parseShapeProps(
				xmlLookup.getChildByLocalName(node, 'spPr'),
				xmlLookup,
				colorParser,
			);
			return spPr ? { index: idx, spPr } : { index: idx };
		})
		.filter((entry): entry is PptxChartBandFmt => entry !== undefined);
	return result.length > 0 ? result : undefined;
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

/**
 * Reconcile typed `bandFmts` back into a `c:surfaceChart` / `c:surface3DChart`
 * container. `undefined` leaves an authored `c:bandFmts` untouched; an empty
 * array removes it; otherwise each entry is matched to its authored
 * `c:bandFmt` by `idx` (or appended) and only its `spPr` is updated.
 */
export function applyChartBandFmts(
	seriesContainer: XmlObject,
	bandFmts: PptxChartBandFmt[] | undefined,
	localName: LocalName,
	resolveColor?: ResolveChartColor,
): void {
	if (bandFmts === undefined) {
		return;
	}
	const containerKey = findKey(seriesContainer, 'bandFmts', localName);
	if (bandFmts.length === 0) {
		if (containerKey) {
			delete seriesContainer[containerKey];
		}
		return;
	}

	const bandFmtsNode = containerKey ? (seriesContainer[containerKey] as XmlObject) : undefined;
	const bandFmtKey = bandFmtsNode ? findKey(bandFmtsNode, 'bandFmt', localName) : undefined;
	const existingRaw = bandFmtKey ? bandFmtsNode?.[bandFmtKey] : undefined;
	const existingNodes = existingRaw
		? ((Array.isArray(existingRaw) ? existingRaw : [existingRaw]) as XmlObject[])
		: [];
	const bandIndexOf = (node: XmlObject): number | undefined => {
		const idxKey = findKey(node, 'idx', localName);
		return idxKey ? safeUnsignedInt((node[idxKey] as XmlObject | undefined)?.['@_val']) : undefined;
	};
	const byIndex = new Map(existingNodes.map((node) => [bandIndexOf(node), node]));

	const updated = [...existingNodes];
	for (const band of bandFmts) {
		let node = byIndex.get(band.index);
		if (!node) {
			node = { 'c:idx': { '@_val': String(band.index) } };
			updated.push(node);
		}
		if (band.spPr) {
			const spPrKey = findKey(node, 'spPr', localName);
			const spPr = writeChartShapeProps(
				spPrKey ? (node[spPrKey] as XmlObject) : undefined,
				band.spPr,
				localName,
				resolveColor,
			);
			setOrdered(node, 'spPr', spPr, ['idx', 'spPr', 'extLst'], localName);
		}
	}

	setOrdered(
		seriesContainer,
		'bandFmts',
		{ 'c:bandFmt': updated },
		['wireframe', 'ser', 'bandFmts', 'axId', 'extLst'],
		localName,
	);
}
