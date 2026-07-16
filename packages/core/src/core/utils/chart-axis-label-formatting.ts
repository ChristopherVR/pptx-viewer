import type { PptxChartAxisFormatting, PptxChartTickMark, XmlObject } from '../types';

type LocalName = (key: string) => string;
type AxisLabels = Pick<
	PptxChartAxisFormatting,
	| 'axisType'
	| 'axPos'
	| 'majorTickMark'
	| 'minorTickMark'
	| 'tickLblPos'
	| 'auto'
	| 'labelAlignment'
	| 'labelOffset'
	| 'tickLabelSkip'
	| 'tickMarkSkip'
	| 'noMultiLevelLabels'
	| 'crosses'
	| 'crossesAt'
	| 'crossBetween'
>;

const ORDER = [
	'axId',
	'scaling',
	'delete',
	'axPos',
	'majorGridlines',
	'minorGridlines',
	'title',
	'numFmt',
	'majorTickMark',
	'minorTickMark',
	'tickLblPos',
	'spPr',
	'txPr',
	'crossAx',
	'crosses',
	'crossesAt',
	'auto',
	'lblAlgn',
	'lblOffset',
	'tickLblSkip',
	'tickMarkSkip',
	'noMultiLvlLbl',
	'crossBetween',
	'baseTimeUnit',
	'majorUnit',
	'majorTimeUnit',
	'minorUnit',
	'minorTimeUnit',
	'dispUnits',
	'extLst',
] as const;
const TICK_MARKS = new Set<PptxChartTickMark>(['cross', 'in', 'none', 'out']);
const TICK_LABEL_POSITIONS = new Set<string>(['high', 'low', 'nextTo', 'none']);
const LABEL_ALIGNMENTS = new Set<string>(['ctr', 'l', 'r']);
const AXIS_POSITIONS = new Set(['b', 'l', 'r', 't']);
const CROSSING_MODES = new Set(['autoZero', 'min', 'max']);
const CROSS_BETWEEN_MODES = new Set(['between', 'midCat']);

function findKey(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function child(node: XmlObject, name: string, localName: LocalName): XmlObject | undefined {
	const key = findKey(node, name, localName);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function parseBoolean(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const value = String(node['@_val'] ?? '1');
	if (value === '1' || value === 'true') {
		return true;
	}
	if (value === '0' || value === 'false') {
		return false;
	}
	return undefined;
}

function parsePositiveInteger(node: XmlObject | undefined): number | undefined {
	const value = Number.parseInt(String(node?.['@_val'] ?? ''), 10);
	return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Parse shared tick controls and the category/date axis label controls. */
export function parseChartAxisLabelFormatting(
	node: XmlObject,
	axisType: PptxChartAxisFormatting['axisType'],
	localName: LocalName,
): Partial<AxisLabels> {
	const result: Partial<AxisLabels> = {};
	for (const [name, property] of [
		['majorTickMark', 'majorTickMark'],
		['minorTickMark', 'minorTickMark'],
	] as const) {
		const value = String(child(node, name, localName)?.['@_val'] ?? '');
		if (TICK_MARKS.has(value as PptxChartTickMark)) {
			result[property] = value as PptxChartTickMark;
		}
	}
	const tickLabelPosition = String(child(node, 'tickLblPos', localName)?.['@_val'] ?? '');
	if (TICK_LABEL_POSITIONS.has(tickLabelPosition)) {
		result.tickLblPos = tickLabelPosition as AxisLabels['tickLblPos'];
	}
	const crosses = String(child(node, 'crosses', localName)?.['@_val'] ?? '');
	if (CROSSING_MODES.has(crosses)) {
		result.crosses = crosses as AxisLabels['crosses'];
	}
	const crossesAt = Number.parseFloat(String(child(node, 'crossesAt', localName)?.['@_val'] ?? ''));
	if (Number.isFinite(crossesAt)) {
		result.crossesAt = crossesAt;
	}
	if (axisType === 'valAx') {
		const crossBetween = String(child(node, 'crossBetween', localName)?.['@_val'] ?? '');
		if (CROSS_BETWEEN_MODES.has(crossBetween)) {
			result.crossBetween = crossBetween as AxisLabels['crossBetween'];
		}
	}
	if (axisType === 'catAx' || axisType === 'dateAx') {
		result.auto = parseBoolean(child(node, 'auto', localName));
		const rawOffset = child(node, 'lblOffset', localName)?.['@_val'];
		if (rawOffset !== undefined) {
			const offset = Number.parseFloat(String(rawOffset).replace(/%$/u, ''));
			if (Number.isFinite(offset) && offset >= 0 && offset <= 1000) {
				result.labelOffset = offset;
			}
		}
		result.tickLabelSkip = parsePositiveInteger(child(node, 'tickLblSkip', localName));
		result.tickMarkSkip = parsePositiveInteger(child(node, 'tickMarkSkip', localName));
	}
	if (axisType === 'catAx') {
		const alignment = String(child(node, 'lblAlgn', localName)?.['@_val'] ?? '');
		if (LABEL_ALIGNMENTS.has(alignment)) {
			result.labelAlignment = alignment as AxisLabels['labelAlignment'];
		}
		result.noMultiLevelLabels = parseBoolean(child(node, 'noMultiLvlLbl', localName));
	}
	return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
}

function upsertOrdered(
	node: XmlObject,
	name: (typeof ORDER)[number],
	value: XmlObject,
	localName: LocalName,
): void {
	const key = findKey(node, name, localName);
	if (key) {
		node[key] = { ...(node[key] as XmlObject), ...value };
		return;
	}
	const entries = Object.entries(node);
	const rank = ORDER.indexOf(name);
	const index = entries.findIndex(([candidate]) => {
		const candidateRank = ORDER.indexOf(localName(candidate) as (typeof ORDER)[number]);
		return candidateRank >= 0 && candidateRank > rank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`c:${name}`, value]);
	for (const candidate of Object.keys(node)) {
		delete node[candidate];
	}
	for (const [candidate, childValue] of entries) {
		node[candidate] = childValue;
	}
}

/** Apply typed label controls without disturbing unrelated or extension XML. */
export function applyChartAxisLabelFormatting(
	node: XmlObject,
	formatting: AxisLabels,
	localName: LocalName,
): void {
	if (formatting.axPos !== undefined) {
		if (!AXIS_POSITIONS.has(formatting.axPos)) {
			throw new RangeError('axPos must be b, l, r, or t');
		}
		upsertOrdered(node, 'axPos', { '@_val': formatting.axPos }, localName);
	}
	for (const [name, value] of [
		['majorTickMark', formatting.majorTickMark],
		['minorTickMark', formatting.minorTickMark],
		['tickLblPos', formatting.tickLblPos],
	] as const) {
		if (value !== undefined) {
			upsertOrdered(node, name, { '@_val': value }, localName);
		}
	}
	if (formatting.crossesAt !== undefined) {
		if (!Number.isFinite(formatting.crossesAt)) {
			throw new RangeError('crossesAt must be finite');
		}
		const crossesKey = findKey(node, 'crosses', localName);
		if (crossesKey) {
			delete node[crossesKey];
		}
		upsertOrdered(node, 'crossesAt', { '@_val': String(formatting.crossesAt) }, localName);
	} else if (formatting.crosses !== undefined) {
		const crossesAtKey = findKey(node, 'crossesAt', localName);
		if (crossesAtKey) {
			delete node[crossesAtKey];
		}
		upsertOrdered(node, 'crosses', { '@_val': formatting.crosses }, localName);
	}
	if (formatting.axisType === 'valAx' && formatting.crossBetween !== undefined) {
		upsertOrdered(node, 'crossBetween', { '@_val': formatting.crossBetween }, localName);
	}
	if (formatting.axisType === 'catAx' || formatting.axisType === 'dateAx') {
		if (formatting.auto !== undefined) {
			upsertOrdered(node, 'auto', { '@_val': formatting.auto ? '1' : '0' }, localName);
		}
		if (formatting.labelOffset !== undefined) {
			if (
				!Number.isFinite(formatting.labelOffset) ||
				formatting.labelOffset < 0 ||
				formatting.labelOffset > 1000
			) {
				throw new RangeError('labelOffset must be between 0 and 1000');
			}
			upsertOrdered(node, 'lblOffset', { '@_val': `${formatting.labelOffset}%` }, localName);
		}
		for (const [name, value] of [
			['tickLblSkip', formatting.tickLabelSkip],
			['tickMarkSkip', formatting.tickMarkSkip],
		] as const) {
			if (value !== undefined) {
				if (!Number.isInteger(value) || value <= 0) {
					throw new RangeError(`${name} must be a positive integer`);
				}
				upsertOrdered(node, name, { '@_val': String(value) }, localName);
			}
		}
	}
	if (formatting.axisType === 'catAx') {
		if (formatting.labelAlignment !== undefined) {
			upsertOrdered(node, 'lblAlgn', { '@_val': formatting.labelAlignment }, localName);
		}
		if (formatting.noMultiLevelLabels !== undefined) {
			upsertOrdered(
				node,
				'noMultiLvlLbl',
				{ '@_val': formatting.noMultiLevelLabels ? '1' : '0' },
				localName,
			);
		}
	}
}
