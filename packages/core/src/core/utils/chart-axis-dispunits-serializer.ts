/**
 * Pure serialization helper for a value axis's display units (`c:dispUnits`
 * under `c:valAx` / `c:dateAx`) on save.
 *
 * Display units are fully modeled (`builtInUnit` enum or a custom divisor), so
 * this reconciles the node from the model: it writes/updates `c:dispUnits`
 * when a unit is set (preserving an existing `c:dispUnitsLbl`), and removes it
 * when the model has none. Only acts on axes that already carry a unit or are
 * being given one, so charts without display units are untouched.
 *
 * @module utils/chart-axis-dispunits-serializer
 */

import type { XmlObject } from '../types';

type GetLocalName = (key: string) => string;

/** The display-unit subset of `PptxChartAxisFormatting`. */
export interface ChartAxisDisplayUnits {
	displayUnits?: string;
	displayUnitsValue?: number;
}

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

/** Insert `c:dispUnits` before `c:extLst` (its only successor), else append. */
function insertOrdered(axisNode: XmlObject, value: XmlObject, getLocalName: GetLocalName): void {
	const keys = Object.keys(axisNode);
	const beforeIdx = keys.findIndex((k) => getLocalName(k) === 'extLst');
	const entries = keys.map((k) => [k, axisNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:dispUnits', value] as const);
	for (const k of keys) {
		delete axisNode[k];
	}
	for (const [k, v] of entries) {
		axisNode[k] = v;
	}
}

/**
 * Apply display units onto a value/date axis node.
 *
 * - No `displayUnits` removes any existing `c:dispUnits`.
 * - A built-in unit name writes `c:builtInUnit`; `'custom'` writes
 *   `c:custUnit` with `displayUnitsValue` (default 1). An existing
 *   `c:dispUnitsLbl` is preserved.
 *
 * Mutates `axisNode` in place.
 */
export function applyChartAxisDisplayUnitsToXml(
	axisNode: XmlObject,
	axis: ChartAxisDisplayUnits,
	getLocalName: GetLocalName,
): void {
	const existingKey = findKey(axisNode, 'dispUnits', getLocalName);

	if (!axis.displayUnits) {
		if (existingKey) {
			delete axisNode[existingKey];
		}
		return;
	}

	const existing = existingKey ? (axisNode[existingKey] as XmlObject) : undefined;
	const node: XmlObject = {};
	if (axis.displayUnits === 'custom') {
		node['c:custUnit'] = { '@_val': String(axis.displayUnitsValue ?? 1) };
	} else {
		node['c:builtInUnit'] = { '@_val': axis.displayUnits };
	}
	if (existing) {
		const lblKey = findKey(existing, 'dispUnitsLbl', getLocalName);
		if (lblKey) {
			node['c:dispUnitsLbl'] = existing[lblKey];
		}
	}

	if (existingKey) {
		axisNode[existingKey] = node;
	} else {
		insertOrdered(axisNode, node, getLocalName);
	}
}
