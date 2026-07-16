import type { PptxChartAxisFormatting, XmlObject } from '../types';

type LocalName = (key: string) => string;
type GetChild = (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
const TIME_UNITS = new Set(['days', 'months', 'years']);
const DATE_AXIS_ORDER = [
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
	'lblOffset',
	'baseTimeUnit',
	'majorUnit',
	'majorTimeUnit',
	'minorUnit',
	'minorTimeUnit',
	'extLst',
] as const;

/** Parse the calendar-unit controls unique to c:dateAx. */
export function parseChartDateAxisUnits(
	axisNode: XmlObject,
	target: PptxChartAxisFormatting,
	getChild: GetChild,
): void {
	if (target.axisType !== 'dateAx') {
		return;
	}
	for (const [childName, property] of [
		['baseTimeUnit', 'baseTimeUnit'],
		['majorTimeUnit', 'majorTimeUnit'],
		['minorTimeUnit', 'minorTimeUnit'],
	] as const) {
		const value = String(getChild(axisNode, childName)?.['@_val'] ?? '');
		if (TIME_UNITS.has(value)) {
			target[property] = value as 'days' | 'months' | 'years';
		}
	}
}

function upsertOrdered(
	axisNode: XmlObject,
	name: (typeof DATE_AXIS_ORDER)[number],
	value: string | undefined,
	localName: LocalName,
): void {
	const existing = Object.keys(axisNode).find((key) => localName(key) === name);
	if (value === undefined) {
		if (existing) {
			delete axisNode[existing];
		}
		return;
	}
	if (existing) {
		(axisNode[existing] as XmlObject)['@_val'] = value;
		return;
	}
	const entries = Object.entries(axisNode);
	const rank = DATE_AXIS_ORDER.indexOf(name);
	const index = entries.findIndex(([key]) => {
		const candidate = DATE_AXIS_ORDER.indexOf(localName(key) as (typeof DATE_AXIS_ORDER)[number]);
		return candidate >= 0 && candidate > rank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`c:${name}`, { '@_val': value }]);
	for (const key of Object.keys(axisNode)) {
		delete axisNode[key];
	}
	for (const [key, child] of entries) {
		axisNode[key] = child;
	}
}

/** Apply typed date units without disturbing unrelated axis XML. */
export function applyChartDateAxisUnits(
	axisNode: XmlObject,
	axis: PptxChartAxisFormatting,
	localName: LocalName,
): void {
	if (axis.axisType !== 'dateAx') {
		return;
	}
	upsertOrdered(axisNode, 'baseTimeUnit', axis.baseTimeUnit, localName);
	upsertOrdered(axisNode, 'majorTimeUnit', axis.majorTimeUnit, localName);
	upsertOrdered(axisNode, 'minorTimeUnit', axis.minorTimeUnit, localName);
}
