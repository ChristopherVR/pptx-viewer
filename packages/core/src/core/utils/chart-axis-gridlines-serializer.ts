/**
 * Pure serialization helper for toggling chart axis gridlines
 * (`c:majorGridlines` / `c:minorGridlines` under an axis node) on save.
 *
 * Adds an empty gridlines element in schema order when turned on (preserving
 * an existing one with its styling), removes it when turned off, and leaves it
 * untouched when the flag is `undefined`. Dependency-light (a `getLocalName`
 * resolver only) so it can be unit-tested directly.
 *
 * @module utils/chart-axis-gridlines-serializer
 */

import type { XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** CT_*Ax children that follow `c:majorGridlines` in schema order. */
const AFTER_MAJOR = new Set([
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
	'crossBetween',
	'majorUnit',
	'minorUnit',
	'dispUnits',
	'extLst',
]);
/** CT_*Ax children that follow `c:minorGridlines` (same, minus majorGridlines/minorGridlines). */
const AFTER_MINOR = new Set([...AFTER_MAJOR].filter((x) => x !== 'minorGridlines'));

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function insertBefore(
	axisNode: XmlObject,
	newKey: string,
	value: XmlObject,
	afterSet: Set<string>,
	getLocalName: GetLocalName,
): void {
	const keys = Object.keys(axisNode);
	const beforeIdx = keys.findIndex((k) => afterSet.has(getLocalName(k)));
	const entries = keys.map((k) => [k, axisNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, [newKey, value] as const);
	for (const k of keys) {
		delete axisNode[k];
	}
	for (const [k, v] of entries) {
		axisNode[k] = v;
	}
}

function applyOne(
	axisNode: XmlObject,
	local: string,
	key: string,
	flag: boolean | undefined,
	afterSet: Set<string>,
	getLocalName: GetLocalName,
): void {
	if (flag === undefined) {
		return;
	}
	const existingKey = findKey(axisNode, local, getLocalName);
	if (!flag) {
		if (existingKey) {
			delete axisNode[existingKey];
		}
		return;
	}
	// Turning on: keep an existing element (and its styling); insert an empty
	// one only when absent.
	if (!existingKey) {
		insertBefore(axisNode, key, {}, afterSet, getLocalName);
	}
}

/**
 * Toggle major/minor gridlines on an axis node from the model flags. Mutates
 * `axisNode` in place. `undefined` flags are left untouched (passthrough).
 */
export function applyChartAxisGridlinesToXml(
	axisNode: XmlObject,
	opts: { majorGridlines?: boolean; minorGridlines?: boolean },
	getLocalName: GetLocalName,
): void {
	applyOne(
		axisNode,
		'majorGridlines',
		'c:majorGridlines',
		opts.majorGridlines,
		AFTER_MAJOR,
		getLocalName,
	);
	applyOne(
		axisNode,
		'minorGridlines',
		'c:minorGridlines',
		opts.minorGridlines,
		AFTER_MINOR,
		getLocalName,
	);
}
