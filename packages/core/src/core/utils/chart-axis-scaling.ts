import type { PptxChartAxisFormatting, XmlObject } from '../types';

type GetChild = (parent: XmlObject | undefined, name: string) => XmlObject | undefined;

/** Parse the `c:scaling` children that affect value-axis range and direction. */
export function parseChartAxisScaling(
	scalingNode: XmlObject | undefined,
	target: PptxChartAxisFormatting,
	getChild: GetChild,
): void {
	if (!scalingNode) {
		return;
	}
	const parseNumber = (name: string): number | undefined => {
		const value = Number.parseFloat(String(getChild(scalingNode, name)?.['@_val']));
		return Number.isFinite(value) ? value : undefined;
	};
	const min = parseNumber('min');
	const max = parseNumber('max');
	const logBase = parseNumber('logBase');
	if (min !== undefined) {
		target.min = min;
	}
	if (max !== undefined) {
		target.max = max;
	}
	if (logBase !== undefined && logBase > 0) {
		target.logScale = true;
		target.logBase = logBase;
	}
	const orientation = String(getChild(scalingNode, 'orientation')?.['@_val'] ?? '');
	if (orientation === 'minMax' || orientation === 'maxMin') {
		target.orientation = orientation;
	}
}

/** Upsert a namespaced chart child carrying a `val` attribute. */
export function upsertChartAxisChild(
	parent: XmlObject,
	localName: string,
	value: string | undefined,
	getLocalName: (key: string) => string,
): void {
	const existingKey = Object.keys(parent).find((key) => getLocalName(key) === localName);
	if (value === undefined) {
		if (existingKey) {
			delete parent[existingKey];
		}
		return;
	}
	if (existingKey) {
		(parent[existingKey] as XmlObject)['@_val'] = value;
	} else {
		parent[`c:${localName}`] = { '@_val': value };
	}
}

/** Apply edited range, logarithm, and direction fields to `c:scaling`. */
export function applyChartAxisScaling(
	scalingNode: XmlObject,
	axis: PptxChartAxisFormatting,
	getLocalName: (key: string) => string,
): void {
	const logBase = axis.logBase !== undefined && axis.logBase > 0 ? String(axis.logBase) : undefined;
	if (logBase !== undefined || axis.logScale === false) {
		upsertChartAxisChild(scalingNode, 'logBase', logBase, getLocalName);
	}
	upsertChartAxisChild(
		scalingNode,
		'min',
		axis.min !== undefined ? String(axis.min) : undefined,
		getLocalName,
	);
	upsertChartAxisChild(
		scalingNode,
		'max',
		axis.max !== undefined ? String(axis.max) : undefined,
		getLocalName,
	);
	if (axis.orientation !== undefined) {
		upsertChartAxisChild(scalingNode, 'orientation', axis.orientation, getLocalName);
	}
}
