/**
 * Mutation helpers that hold a `c:*Chart` container (and its `c:plotArea`) to
 * the ECMA-376 content models declared in
 * {@link module:utils/chart-container-content-model}.
 *
 * A legal element in the wrong container, or a legal element in the wrong
 * position, is equally invalid: PowerPoint rejects the whole package ("the file
 * is corrupted and unreadable") rather than degrading. These helpers are what
 * the combo re-split ({@link module:utils/chart-combo-serializer}) and the
 * chart-type-change save path use to stay inside the schema.
 *
 * @module utils/chart-container-schema
 */

import type { XmlObject } from '../types';
import {
	AXIS_LOCAL_NAMES,
	CHART_CONTAINER_CHILD_ORDER,
	REQUIRED_LEADING_CHILD,
	chartContainerAllows,
	isKnownChartContainer,
} from './chart-container-content-model';

type GetLocalName = (key: string) => string;

export {
	chartContainerAllows,
	chartContainerHasAxes,
	chartTypeToContainerLocalName,
	isKnownChartContainer,
} from './chart-container-content-model';

/**
 * `CT_BarGrouping` accepts `clustered`; the plain `ST_Grouping` used by line and
 * area charts does not. Carrying a bar container's grouping into a line
 * container therefore has to demote it.
 */
export function normalizeChartGroupingValue(containerLocal: string, value: string): string {
	const isBar = containerLocal === 'barChart' || containerLocal === 'bar3DChart';
	return !isBar && value === 'clustered' ? 'standard' : value;
}

function normalizeGroupingNode(containerLocal: string, node: XmlObject): void {
	const value = node['@_val'];
	if (value !== undefined) {
		node['@_val'] = normalizeChartGroupingValue(containerLocal, value);
	}
}

/**
 * Bring `container` in line with its own content model: drop children the
 * container does not permit, demote an illegal `c:grouping` value, and add any
 * required child that is missing. Mutates in place; a container local name this
 * module does not model is left untouched.
 */
export function normalizeChartContainerChildren(
	container: XmlObject,
	containerLocal: string,
	getLocalName: GetLocalName,
): void {
	if (!isKnownChartContainer(containerLocal)) {
		return;
	}
	for (const key of Object.keys(container)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		const local = getLocalName(key);
		if (!chartContainerAllows(containerLocal, local)) {
			delete container[key];
			continue;
		}
		if (local === 'grouping') {
			const node = container[key];
			if (node && typeof node === 'object' && !Array.isArray(node)) {
				normalizeGroupingNode(containerLocal, node as XmlObject);
			}
		}
	}
	const required = REQUIRED_LEADING_CHILD[containerLocal];
	if (required) {
		const present = Object.keys(container).some((k) => getLocalName(k) === required.local);
		if (!present) {
			container[`c:${required.local}`] = { '@_val': required.val };
		}
	}
}

/**
 * Reorder `container`'s children into the schema sequence for its type.
 *
 * Bails out (leaving the container untouched) when it holds a child this module
 * does not model, e.g. an `mc:AlternateContent` wrapper: moving an unknown
 * element to an arbitrary position would be worse than leaving a valid document
 * alone.
 */
export function orderChartContainerChildren(
	container: XmlObject,
	containerLocal: string,
	getLocalName: GetLocalName,
): void {
	const order = CHART_CONTAINER_CHILD_ORDER[containerLocal];
	if (!order) {
		return;
	}
	const keys = Object.keys(container).filter((k) => !k.startsWith('@_') && k !== '#text');
	if (keys.some((k) => !order.includes(getLocalName(k)))) {
		return;
	}
	const sorted = [...keys].sort(
		(a, b) => order.indexOf(getLocalName(a)) - order.indexOf(getLocalName(b)),
	);
	if (sorted.every((k, i) => k === keys[i])) {
		return;
	}
	const saved = sorted.map((k) => [k, container[k]] as const);
	for (const k of keys) {
		delete container[k];
	}
	for (const [k, v] of saved) {
		container[k] = v;
	}
}

/**
 * Rename a key while keeping its position in the object, so a chart-type change
 * does not shunt the chart group behind `c:plotArea`'s axis elements (the
 * `CT_PlotArea` sequence puts chart groups first).
 */
export function renameXmlKeyInPlace(obj: XmlObject, oldKey: string, newKey: string): void {
	if (oldKey === newKey || !(oldKey in obj)) {
		return;
	}
	const entries = Object.keys(obj).map((k) => [k === oldKey ? newKey : k, obj[k]] as const);
	for (const k of Object.keys(obj)) {
		delete obj[k];
	}
	for (const [k, v] of entries) {
		obj[k] = v;
	}
}

/** Collect every `c:axId` value referenced by any chart group in `plotArea`. */
function referencedAxisIds(plotArea: XmlObject, getLocalName: GetLocalName): Set<string> {
	const ids = new Set<string>();
	for (const key of Object.keys(plotArea)) {
		if (!getLocalName(key).endsWith('Chart')) {
			continue;
		}
		for (const container of toArray(plotArea[key])) {
			for (const childKey of Object.keys(container)) {
				if (getLocalName(childKey) !== 'axId') {
					continue;
				}
				for (const axId of toArray(container[childKey])) {
					const val = axId['@_val'];
					if (val !== undefined) {
						ids.add(String(val));
					}
				}
			}
		}
	}
	return ids;
}

function toArray(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value.filter((v): v is XmlObject => typeof v === 'object' && v !== null);
	}
	return typeof value === 'object' && value !== null ? [value as XmlObject] : [];
}

/**
 * Drop `c:catAx` / `c:valAx` / `c:dateAx` / `c:serAx` elements that no chart
 * group references any more. Switching a bar chart to a pie chart removes the
 * only `c:axId` pair in the plot area, and the orphaned axes left behind are
 * what PowerPoint chokes on.
 *
 * @returns The number of axis elements removed.
 */
export function reconcileChartPlotAreaAxes(
	plotArea: XmlObject,
	getLocalName: GetLocalName,
): number {
	const referenced = referencedAxisIds(plotArea, getLocalName);
	let removed = 0;
	for (const key of Object.keys(plotArea)) {
		const local = getLocalName(key);
		if (!AXIS_LOCAL_NAMES.includes(local as (typeof AXIS_LOCAL_NAMES)[number])) {
			continue;
		}
		const axes = toArray(plotArea[key]);
		const kept = axes.filter((axis) => {
			const axIdKey = Object.keys(axis).find((k) => getLocalName(k) === 'axId');
			const val = axIdKey ? toArray(axis[axIdKey])[0]?.['@_val'] : undefined;
			return val !== undefined && referenced.has(String(val));
		});
		removed += axes.length - kept.length;
		if (kept.length === 0) {
			delete plotArea[key];
		} else if (kept.length !== axes.length) {
			plotArea[key] = kept.length === 1 ? kept[0] : kept;
		}
	}
	return removed;
}
