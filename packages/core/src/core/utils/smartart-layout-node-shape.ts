/**
 * Parse/apply a layoutNode's own `dgm:shape` (CT_Shape) preset-geometry
 * override.
 *
 * A `dgm:layoutNode` may declare `dgm:shape/@type` (a preset geometry name -
 * `roundRect`, `ellipse`, `chevron`, `trapezoid`, `conn`, ...; the same
 * vocabulary as `a:prstGeom/@prst`) plus `dgm:adjLst/dgm:adj` adjustment
 * values, overriding whatever shape the interpreter's arranger would
 * otherwise hardcode for that arrangement family. Real, PowerPoint-authored
 * layout definitions rely on this per-node: `smartart-chart-table-mix.pptx`'s
 * `layout4.xml` (a pyramid/composite diagram) carries `rect`, `trapezoid`,
 * AND `nonIsoscelesTrapezoid` on different item templates in the SAME
 * layout, and `layout1.xml`/`layout2.xml` use `roundRect`/`ellipse`
 * respectively - none of them the arranger's own hardcoded default for every
 * family.
 *
 * @module smartart-layout-node-shape
 */

import type { PptxSmartArtLayoutNodeShape, PptxSmartArtShapeAdjustment, XmlObject } from '../types';

type LocalName = (key: string) => string;

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value)
		? (value[0] as XmlObject | undefined)
		: (value as XmlObject | undefined);
}

function children(node: XmlObject | undefined, name: string, localName: LocalName): XmlObject[] {
	if (!node) {
		return [];
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

function parseHideGeom(shapeEl: XmlObject): boolean | undefined {
	const raw = String(shapeEl['@_hideGeom'] ?? '')
		.trim()
		.toLowerCase();
	return raw === '1' || raw === 'true' ? true : undefined;
}

function parseAdjustments(
	shapeEl: XmlObject,
	localName: LocalName,
): PptxSmartArtShapeAdjustment[] | undefined {
	const adjLst = child(shapeEl, 'adjLst', localName);
	const adjustments = children(adjLst, 'adj', localName)
		.map((adj): PptxSmartArtShapeAdjustment | undefined => {
			const index = Number.parseInt(String(adj['@_idx'] ?? ''), 10);
			const value = Number.parseFloat(String(adj['@_val'] ?? ''));
			return Number.isInteger(index) && Number.isFinite(value) ? { index, value } : undefined;
		})
		.filter((entry): entry is PptxSmartArtShapeAdjustment => Boolean(entry));
	return adjustments.length > 0 ? adjustments : undefined;
}

/** Parse a `dgm:layoutNode`'s `dgm:shape` child, or `undefined` when absent/empty. */
export function parseSmartArtLayoutNodeShape(
	node: XmlObject,
	localName: LocalName,
): PptxSmartArtLayoutNodeShape | undefined {
	const shapeEl = child(node, 'shape', localName);
	if (!shapeEl) {
		return undefined;
	}
	const presetGeometry = String(shapeEl['@_type'] ?? '').trim() || undefined;
	const hideGeometry = parseHideGeom(shapeEl);
	const adjustments = parseAdjustments(shapeEl, localName);
	if (!presetGeometry && !hideGeometry && !adjustments) {
		return undefined;
	}
	return {
		...(presetGeometry ? { presetGeometry } : {}),
		...(adjustments ? { adjustments } : {}),
		...(hideGeometry ? { hideGeometry } : {}),
	};
}

/**
 * Surgically merge a layoutNode's `dgm:shape` override back onto its parsed
 * XML, preserving unknown attributes (`r:blip`, `zOrderOff`, ...) and any
 * `extLst`. A no-op when `value` is `undefined` (nothing to write back).
 */
export function applySmartArtLayoutNodeShape(
	target: XmlObject,
	value: PptxSmartArtLayoutNodeShape | undefined,
	localName: LocalName,
): void {
	if (value === undefined) {
		return;
	}
	const shapeKey = Object.keys(target).find((candidate) => localName(candidate) === 'shape');
	const shapeEl = (shapeKey ? target[shapeKey] : undefined) as XmlObject | undefined;
	const el = shapeEl ?? {};
	if (value.presetGeometry !== undefined) {
		el['@_type'] = value.presetGeometry;
	} else {
		delete el['@_type'];
	}
	if (value.hideGeometry) {
		el['@_hideGeom'] = '1';
	} else {
		delete el['@_hideGeom'];
	}
	if (value.adjustments && value.adjustments.length > 0) {
		const adjLstKey =
			Object.keys(el).find((candidate) => localName(candidate) === 'adjLst') ?? 'dgm:adjLst';
		const existingAdjLst = (el[adjLstKey] as XmlObject | undefined) ?? {};
		const adjKey =
			Object.keys(existingAdjLst).find((candidate) => localName(candidate) === 'adj') ?? 'dgm:adj';
		existingAdjLst[adjKey] = value.adjustments.map((adj) => ({
			'@_idx': String(adj.index),
			'@_val': String(adj.value),
		}));
		el[adjLstKey] = existingAdjLst;
	}
	target[shapeKey ?? 'dgm:shape'] = el;
}
