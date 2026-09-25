/**
 * Geometry for PowerPoint's Insert > Shapes > Lines drawing tools that build
 * an `a:custGeom` freeform from clicks:
 *
 *  - **Freeform: Shape** (`freeformShape`): each click places a corner; a drag
 *    between clicks adds a freehand run (simplified, then drawn as short
 *    straight segments, as PowerPoint stores it);
 *  - **Curve** (`curve`): each click places a point the outline passes
 *    through smoothly (a Catmull-Rom spline, emitted as cubic Beziers).
 *
 * Both close when the user clicks back on the start point, and otherwise stay
 * open. The element box, EMU path space and serialisation are the same as an
 * Edit Points commit (`editGeometryToElementPatch`), so a drawn freeform is
 * byte-for-byte the kind of shape Edit Points produces.
 *
 * @module render/edit-points/freeform-tool-geometry
 */
import type { ShapePptxElement } from 'pptx-viewer-core';
import { createEditorId, douglasPeucker } from 'pptx-viewer-core';

import { editGeometryToElementPatch } from './edit-points-export';
import { EditGeometryPen } from './edit-points-pen';
import type { EditFrame, EditGeometry, EditPoint } from './edit-points-types';

/** The two click-to-place drawing tools. */
export type FreeformToolKind = 'freeformShape' | 'curve';

/** Every drawing tool id (the customisation catalogue reads this). */
export const FREEFORM_TOOL_IDS: readonly FreeformToolKind[] = ['freeformShape', 'curve'];

/** i18n keys for the tools' labels. */
export const FREEFORM_TOOL_LABEL_KEYS: Record<FreeformToolKind, string> = {
	freeformShape: 'pptx.shapePresets.freeformShape',
	curve: 'pptx.shapePresets.curve',
};

/** One placed point: a clicked corner, or a sample from a freehand drag. */
export interface FreeformToolVertex extends EditPoint {
	freehand?: boolean;
}

/** Freehand samples closer than this to the simplified line are dropped (slide px). */
export const FREEFORM_FREEHAND_TOLERANCE_PX = 1;

/** Default look of a drawn freeform: PowerPoint's Office theme accent 1. */
export const FREEFORM_TOOL_STYLE = {
	fillColor: '#4472c4',
	strokeColor: '#2f528f',
	strokeWidth: 1,
	openStrokeColor: '#4472c4',
	openStrokeWidth: 1.5,
} as const;

/** The identity frame: local coordinates ARE slide coordinates. */
const SLIDE_FRAME: EditFrame = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	rotation: 0,
	flipH: false,
	flipV: false,
};

/** Consecutive points closer than this (slide px) are one point. */
const DEDUPE_PX = 1;

function dedupe(points: readonly FreeformToolVertex[]): FreeformToolVertex[] {
	const out: FreeformToolVertex[] = [];
	for (const p of points) {
		const last = out[out.length - 1];
		if (last && Math.hypot(p.x - last.x, p.y - last.y) < DEDUPE_PX) {
			// A click that lands on a freehand sample keeps the corner.
			if (!p.freehand) {
				last.freehand = false;
			}
			continue;
		}
		out.push({ ...p });
	}
	return out;
}

/** Simplify each freehand run, keeping every clicked corner. */
export function simplifyFreeformVertices(points: readonly FreeformToolVertex[]): EditPoint[] {
	const input = dedupe(points);
	const out: EditPoint[] = [];
	let run: EditPoint[] = [];
	const flush = (): void => {
		if (run.length > 0) {
			const kept = run.length > 2 ? douglasPeucker(run, FREEFORM_FREEHAND_TOLERANCE_PX) : run;
			// The run's first point is already in `out` (the corner it started at).
			out.push(...kept.slice(out.length > 0 ? 1 : 0).map((p) => ({ x: p.x, y: p.y })));
			run = [];
		}
	};
	for (const p of input) {
		if (p.freehand) {
			if (run.length === 0 && out.length > 0) {
				run.push(out[out.length - 1]);
			}
			run.push({ x: p.x, y: p.y });
		} else {
			flush();
			out.push({ x: p.x, y: p.y });
		}
	}
	flush();
	return out;
}

/** Catmull-Rom control points for the span `p1 -> p2`. */
function catmullRom(p0: EditPoint, p1: EditPoint, p2: EditPoint, p3: EditPoint) {
	return {
		c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
		c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
	};
}

/**
 * The editable geometry for a finished drawing (slide-pixel coordinates), or
 * `undefined` when fewer than two distinct points were placed.
 */
export function buildFreeformToolGeometry(
	tool: FreeformToolKind,
	vertices: readonly FreeformToolVertex[],
	closed: boolean,
): EditGeometry | undefined {
	const points = tool === 'curve' ? dedupe(vertices) : simplifyFreeformVertices(vertices);
	if (points.length < 2) {
		return undefined;
	}
	const isClosed = closed && points.length >= 3;
	const pen = new EditGeometryPen();
	pen.moveTo(points[0]);
	if (tool === 'freeformShape') {
		for (let i = 1; i < points.length; i++) {
			pen.lineTo(points[i]);
		}
	} else {
		const n = points.length;
		const at = (i: number): EditPoint =>
			isClosed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
		const spans = isClosed ? n : n - 1;
		for (let i = 0; i < spans; i++) {
			const { c1, c2 } = catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2));
			pen.curveTo(c1, c2, at(i + 1));
		}
	}
	if (isClosed) {
		pen.close();
	}
	return pen.finish();
}

/**
 * The `shape` element a finished drawing inserts, or `undefined` for a
 * drawing with fewer than two distinct points. A closed outline is filled; an
 * open one is a line (PowerPoint does the same).
 */
export function buildFreeformToolElement(
	tool: FreeformToolKind,
	vertices: readonly FreeformToolVertex[],
	closed: boolean,
	id: string = createEditorId('shape'),
): ShapePptxElement | undefined {
	const geometry = buildFreeformToolGeometry(tool, vertices, closed);
	const patch = geometry ? editGeometryToElementPatch(geometry, SLIDE_FRAME) : undefined;
	if (!geometry || !patch) {
		return undefined;
	}
	const isClosed = geometry.subpaths.every((sub) => sub.closed);
	return {
		...patch,
		id,
		type: 'shape',
		name: tool === 'curve' ? 'Curve' : 'Freeform',
		shapeStyle: isClosed
			? {
					fillColor: FREEFORM_TOOL_STYLE.fillColor,
					strokeColor: FREEFORM_TOOL_STYLE.strokeColor,
					strokeWidth: FREEFORM_TOOL_STYLE.strokeWidth,
				}
			: {
					fillColor: 'transparent',
					strokeColor: FREEFORM_TOOL_STYLE.openStrokeColor,
					strokeWidth: FREEFORM_TOOL_STYLE.openStrokeWidth,
				},
	};
}
