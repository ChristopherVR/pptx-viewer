/**
 * Element to editable points: the "convert to freeform" step PowerPoint runs
 * the moment Edit Points is chosen.
 *
 * Three sources, in priority order:
 *
 *  1. structured `a:custGeom` paths (`customGeometryPaths`), re-evaluated
 *     against the current `shapeAdjustments` when raw guide XML survived parse;
 *  2. a freeform's aggregate SVG `pathData` when no structured paths exist;
 *  3. the preset geometry, evaluated by core's ECMA-376 engine
 *     (`evaluatePresetShape`) at the element's current size and adjustments.
 *
 * Every source is mapped from its own coordinate space onto the element's
 * local pixel box, so the model is always in `0..width x 0..height`.
 *
 * @module render/edit-points/edit-points-import
 */
import type { CustomGeometryPath, PptxElement } from 'pptx-viewer-core';
import { evaluateCustomGeometryPaths, evaluatePresetShape, getShapeType } from 'pptx-viewer-core';

import { ellipseArcToCubics, quadToCubicControls } from './edit-points-bezier';
import { EditGeometryPen } from './edit-points-pen';
import { feedSvgPath } from './edit-points-svg';
import type { EditGeometry, EditPoint } from './edit-points-types';

/** Element types whose outline Edit Points can reshape. */
const EDITABLE_TYPES = new Set<PptxElement['type']>(['shape']);

/** The custom-geometry slots read off a shape. */
interface CustomGeometrySlots {
	shapeType?: string;
	pathData?: string;
	pathWidth?: number;
	pathHeight?: number;
	customGeometryPaths?: CustomGeometryPath[];
	customGeometryRawData?: Parameters<typeof evaluateCustomGeometryPaths>[0];
	shapeAdjustments?: Record<string, number>;
}

function slotsOf(element: PptxElement): CustomGeometrySlots | undefined {
	return element.type === 'shape' ? element : undefined;
}

function feedStructuredPaths(
	pen: EditGeometryPen,
	paths: readonly CustomGeometryPath[],
	width: number,
	height: number,
): void {
	for (const path of paths) {
		const sx = path.width > 0 ? width / path.width : 1;
		const sy = path.height > 0 ? height / path.height : 1;
		const map = (p: EditPoint): EditPoint => ({ x: p.x * sx, y: p.y * sy });
		pen.setPaint(path.fillMode, path.stroke);
		// Each `a:path` starts with the pen at its own origin.
		let cur: EditPoint = { x: 0, y: 0 };
		let start: EditPoint = { x: 0, y: 0 };
		let started = false;
		for (const seg of path.segments) {
			switch (seg.type) {
				case 'moveTo':
					pen.moveTo(map(seg.pt));
					cur = seg.pt;
					start = seg.pt;
					started = true;
					break;
				case 'lineTo':
					if (!started) {
						pen.moveTo(map(cur));
						started = true;
					}
					pen.lineTo(map(seg.pt));
					cur = seg.pt;
					break;
				case 'cubicBezTo':
					if (!started) {
						pen.moveTo(map(cur));
						started = true;
					}
					pen.curveTo(map(seg.pts[0]), map(seg.pts[1]), map(seg.pts[2]));
					cur = seg.pts[2];
					break;
				case 'quadBezTo': {
					if (!started) {
						pen.moveTo(map(cur));
						started = true;
					}
					const { c1, c2 } = quadToCubicControls(cur, seg.pts[0], seg.pts[1]);
					pen.curveTo(map(c1), map(c2), map(seg.pts[1]));
					cur = seg.pts[1];
					break;
				}
				case 'arcTo': {
					if (!started) {
						pen.moveTo(map(cur));
						started = true;
					}
					// The same parametric reading the geometry engine paints with
					// (`ooxmlArcToSvg`): the pen sits on the ellipse at stAng.
					const st = (seg.stAng / 60000) * (Math.PI / 180);
					const sw = (seg.swAng / 60000) * (Math.PI / 180);
					const cx = cur.x - seg.wR * Math.cos(st);
					const cy = cur.y - seg.hR * Math.sin(st);
					for (const piece of ellipseArcToCubics(cx, cy, seg.wR, seg.hR, st, sw)) {
						pen.curveTo(map(piece.c1), map(piece.c2), map(piece.end));
						cur = piece.end;
					}
					break;
				}
				case 'close':
					pen.close();
					cur = start;
					break;
			}
		}
	}
	pen.setPaint(undefined, undefined);
}

/**
 * Whether `element` is a shape Edit Points can work on at all (lock state is a
 * separate question; see `canEditElementPoints`).
 */
export function isEditPointsCandidate(element: PptxElement | null | undefined): boolean {
	if (!element || !EDITABLE_TYPES.has(element.type)) {
		return false;
	}
	return (editGeometryFromElement(element)?.subpaths.length ?? 0) > 0;
}

/** The element's outline as editable points, or `undefined` when it has none. */
export function editGeometryFromElement(element: PptxElement): EditGeometry | undefined {
	const slots = slotsOf(element);
	if (!slots) {
		return undefined;
	}
	const width = Math.max(element.width, 0);
	const height = Math.max(element.height, 0);
	const pen = new EditGeometryPen();

	const structured =
		(slots.customGeometryRawData && slots.pathWidth && slots.pathHeight
			? evaluateCustomGeometryPaths(
					slots.customGeometryRawData,
					slots.pathWidth,
					slots.pathHeight,
					slots.shapeAdjustments,
				)
			: undefined) ?? slots.customGeometryPaths;
	if (structured && structured.length > 0) {
		feedStructuredPaths(pen, structured, width, height);
		return pen.finish();
	}
	if (slots.pathData && slots.pathWidth && slots.pathHeight) {
		const sx = width / slots.pathWidth;
		const sy = height / slots.pathHeight;
		feedSvgPath(pen, slots.pathData, (p) => ({ x: p.x * sx, y: p.y * sy }));
		return pen.finish();
	}
	const shapeType = slots.shapeType ? getShapeType(slots.shapeType) : 'rect';
	const preset =
		evaluatePresetShape(slots.shapeType ?? 'rect', width, height, slots.shapeAdjustments) ??
		evaluatePresetShape(shapeType, width, height, slots.shapeAdjustments);
	if (!preset) {
		return undefined;
	}
	for (const sub of preset.paths) {
		pen.setPaint(sub.fill as CustomGeometryPath['fillMode'], sub.stroke);
		feedSvgPath(pen, sub.d);
	}
	return pen.finish();
}
