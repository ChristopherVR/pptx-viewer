/**
 * Merge Shapes (Shape Format > Merge Shapes): Union, Combine, Fragment,
 * Intersect and Subtract, as one pure planning function every binding calls.
 *
 * PowerPoint's rules, reproduced here:
 * - Two or more shapes (autoshapes, freeforms, text boxes) are required.
 * - The result is a freeform (`a:custGeom`) that takes the FIRST-selected
 *   shape's formatting and text; Fragment gives every piece that formatting.
 * - Subtract removes every other shape from the first-selected one.
 * - The result sits where the first-selected shape sat in the z-order.
 * - An operation that leaves nothing (Intersect of disjoint shapes) is a no-op.
 *
 * The binding applies the returned plan with {@link applyMergeShapesPlan} in
 * ONE history step and selects `plan.created`.
 *
 * @module render/merge-shapes/merge-shapes
 */
import type {
	CustomGeometryPath,
	CustomGeometrySegment,
	MergeShapeOperation,
	PptxElement,
	ShapePptxElement,
} from 'pptx-viewer-core';
import { createEditorId } from 'pptx-viewer-core';

import { FREEFORM_COORD_SCALE } from '../freeform-stroke-geometry';
import { elementOutlineLoops } from './element-outline';
import { booleanRegions, normalizeRegion, splitRegionComponents } from './polygon-boolean';
import type { PolygonRegion } from './polygon-types';
import { polygonRegionBounds } from './polygon-types';

export type { MergeShapeOperation } from 'pptx-viewer-core';

/** PowerPoint's menu order. */
export const MERGE_SHAPE_OPERATIONS: readonly MergeShapeOperation[] = [
	'union',
	'combine',
	'fragment',
	'intersect',
	'subtract',
];

/** Element types PowerPoint lets you merge: autoshapes, freeforms, text boxes. */
export function isMergeableElement(el: PptxElement | null | undefined): boolean {
	if (!el || (el.type !== 'shape' && el.type !== 'text')) {
		return false;
	}
	return el.width > 0 && el.height > 0 && elementOutlineLoops(el).length > 0;
}

/** Whether Merge Shapes is available for this selection (two or more mergeable shapes). */
export function canMergeShapes(selected: readonly (PptxElement | null | undefined)[]): boolean {
	let count = 0;
	for (const el of selected) {
		if (isMergeableElement(el)) {
			count++;
			if (count >= 2) {
				return true;
			}
		}
	}
	return false;
}

/** What a merge does to the slide: which elements go, which new ones come. */
export interface MergeShapesPlan {
	operation: MergeShapeOperation;
	/** Ids of the merged source elements, all of which are removed. */
	removedIds: string[];
	/** The first-selected source, whose z-position the result takes. */
	primaryId: string;
	/** The new freeform shape(s), in paint order. */
	created: ShapePptxElement[];
}

export interface MergeShapesOptions {
	/** Id factory for the new shapes (defaults to core's `createEditorId`). */
	createId?: () => string;
}

function fragmentRegions(regions: readonly PolygonRegion[]): PolygonRegion[] {
	let pieces: PolygonRegion[] = [];
	let covered: PolygonRegion = [];
	for (const region of regions) {
		const next: PolygonRegion[] = [];
		for (const piece of pieces) {
			next.push(
				booleanRegions('intersect', piece, region),
				booleanRegions('subtract', piece, region),
			);
		}
		next.push(
			covered.length > 0 ? booleanRegions('subtract', region, covered) : normalizeRegion(region),
		);
		covered = booleanRegions('union', covered, region);
		pieces = next.filter((piece) => piece.length > 0);
	}
	return pieces.flatMap((piece) => splitRegionComponents(piece));
}

function reduceRegions(op: MergeShapeOperation, regions: readonly PolygonRegion[]): PolygonRegion {
	const [first, ...rest] = regions;
	if (op === 'subtract') {
		const others = rest.reduce<PolygonRegion>((acc, r) => booleanRegions('union', acc, r), []);
		return booleanRegions('subtract', first, others);
	}
	const binary = op === 'combine' ? 'xor' : op === 'intersect' ? 'intersect' : 'union';
	return rest.reduce<PolygonRegion>(
		(acc, r) => booleanRegions(binary, acc, r),
		normalizeRegion(first),
	);
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/** A freeform element for `region`, dressed in `primary`'s formatting. */
function regionToShape(
	region: PolygonRegion,
	primary: PptxElement,
	id: string,
): ShapePptxElement | null {
	const bounds = polygonRegionBounds(region);
	if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
		return null;
	}
	const pathWidth = Math.max(1, Math.round(bounds.width * FREEFORM_COORD_SCALE));
	const pathHeight = Math.max(1, Math.round(bounds.height * FREEFORM_COORD_SCALE));
	const segments: CustomGeometrySegment[] = [];
	const d: string[] = [];
	for (const loop of region) {
		loop.forEach((p, i) => {
			const pt = {
				x: Math.round((p.x - bounds.x) * FREEFORM_COORD_SCALE),
				y: Math.round((p.y - bounds.y) * FREEFORM_COORD_SCALE),
			};
			segments.push(i === 0 ? { type: 'moveTo', pt } : { type: 'lineTo', pt });
			d.push(`${i === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`);
		});
		segments.push({ type: 'close' });
		d.push('Z');
	}
	const path: CustomGeometryPath = { width: pathWidth, height: pathHeight, segments };
	const text = primary.type === 'shape' || primary.type === 'text' ? primary : undefined;
	return {
		id,
		type: 'shape',
		x: round2(bounds.x),
		y: round2(bounds.y),
		width: round2(bounds.width),
		height: round2(bounds.height),
		rotation: 0,
		...(primary.opacity !== undefined ? { opacity: primary.opacity } : {}),
		shapeType: 'custom',
		shapeStyle: text?.shapeStyle ? structuredClone(text.shapeStyle) : undefined,
		...(text?.text !== undefined ? { text: text.text } : {}),
		...(text?.textStyle ? { textStyle: structuredClone(text.textStyle) } : {}),
		...(text?.textSegments ? { textSegments: structuredClone(text.textSegments) } : {}),
		...(text?.paragraphIndents ? { paragraphIndents: structuredClone(text.paragraphIndents) } : {}),
		pathData: d.join(' '),
		pathWidth,
		pathHeight,
		customGeometryPaths: [path],
	};
}

/**
 * Plan `operation` over `selected` (in SELECTION order: the first entry is the
 * shape whose formatting survives). Non-mergeable entries are ignored. Returns
 * null when fewer than two shapes qualify or the result is empty.
 */
export function planMergeShapes(
	operation: MergeShapeOperation,
	selected: readonly PptxElement[],
	options: MergeShapesOptions = {},
): MergeShapesPlan | null {
	const sources = selected.filter((el) => isMergeableElement(el));
	if (sources.length < 2) {
		return null;
	}
	const createId = options.createId ?? (() => createEditorId('shape'));
	const regions = sources.map((el) => elementOutlineLoops(el));
	const results =
		operation === 'fragment' ? fragmentRegions(regions) : [reduceRegions(operation, regions)];
	const primary = sources[0];
	const created = results
		.filter((region) => region.length > 0)
		.map((region) => regionToShape(region, primary, createId()))
		.filter((el): el is ShapePptxElement => el !== null);
	if (created.length === 0) {
		return null;
	}
	return { operation, removedIds: sources.map((el) => el.id), primaryId: primary.id, created };
}

/**
 * The slide's element list after `plan`: the sources removed and the new
 * shapes inserted where the first-selected source was.
 */
export function applyMergeShapesPlan(
	elements: readonly PptxElement[],
	plan: MergeShapesPlan,
): PptxElement[] {
	const removed = new Set(plan.removedIds);
	const result: PptxElement[] = [];
	for (const el of elements) {
		if (el.id === plan.primaryId) {
			result.push(...plan.created);
		} else if (!removed.has(el.id)) {
			result.push(el);
		}
	}
	return result;
}
