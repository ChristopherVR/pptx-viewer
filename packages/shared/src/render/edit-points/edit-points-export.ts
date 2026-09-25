/**
 * Editable points back to an element: the patch that turns a shape into (or
 * keeps it as) an `a:custGeom` freeform.
 *
 * The patch re-anchors the box to the outline's tight bounds (as PowerPoint
 * does after every Edit Points gesture), keeps the outline where it is on the
 * slide even when the shape is rotated or flipped, and writes the geometry in
 * both forms every consumer reads: the structured `customGeometryPaths` the
 * save pipeline serialises, and the aggregate SVG `pathData` the renderers
 * paint. Path coordinates are EMU (9525 per pixel), the space PowerPoint
 * itself authors freeforms in, so the saved `a:path/@w`/`@h` equal the
 * shape's `a:ext`.
 *
 * Everything that described the OLD geometry is cleared: preset adjustments,
 * raw guide / handle / connection-site XML and the text rectangle. Left in
 * place, the save pipeline would re-derive the outline from that stale raw
 * XML instead of the edited points.
 *
 * @module render/edit-points/edit-points-export
 */
import type { CustomGeometryPath, CustomGeometrySegment, ShapePptxElement } from 'pptx-viewer-core';

import { cubicBounds } from './edit-points-bezier';
import { reanchorEditFrame } from './edit-points-frame';
import type { EditFrame, EditGeometry, EditPoint } from './edit-points-types';

/** Path coordinate units per local pixel (EMU per CSS pixel). */
export const EDIT_POINTS_PATH_SCALE = 9525;

/** Width / height floor (px) so a perfectly straight line keeps a real box. */
const MIN_EXTENT_PX = 1;

/** The element fields an Edit Points commit writes. */
export type EditPointsElementPatch = Pick<
	ShapePptxElement,
	| 'x'
	| 'y'
	| 'width'
	| 'height'
	| 'shapeType'
	| 'shapeAdjustments'
	| 'pathData'
	| 'pathWidth'
	| 'pathHeight'
	| 'customGeometryPaths'
	| 'customGeometryRawData'
	| 'customGeometryAdjustHandlesXY'
	| 'customGeometryAdjustHandlesPolar'
	| 'customGeometryConnectionSites'
	| 'customGeometryTextRect'
>;

/** Tight local bounds of every sub-path (curves by their true extent). */
export function editGeometryBounds(
	geometry: EditGeometry,
): { minX: number; minY: number; maxX: number; maxY: number } | undefined {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const grow = (p: EditPoint): void => {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	};
	for (const sub of geometry.subpaths) {
		sub.nodes.forEach(grow);
		sub.segments.forEach((seg, i) => {
			if (seg.kind !== 'curve') {
				return;
			}
			const b = cubicBounds({
				p0: sub.nodes[i],
				p1: seg.c1,
				p2: seg.c2,
				p3: sub.nodes[(i + 1) % sub.nodes.length],
			});
			grow({ x: b.minX, y: b.minY });
			grow({ x: b.maxX, y: b.maxY });
		});
	}
	if (!Number.isFinite(minX)) {
		return undefined;
	}
	return { minX, minY, maxX, maxY };
}

function fmt(value: number): string {
	return String(Math.round(value * 1000) / 1000);
}

/**
 * Serialise `geometry` as structured paths plus SVG, offset by `(ox, oy)` and
 * scaled by `scale`.
 */
export function editGeometryToPaths(
	geometry: EditGeometry,
	ox: number,
	oy: number,
	width: number,
	height: number,
	scale = EDIT_POINTS_PATH_SCALE,
): { paths: CustomGeometryPath[]; svg: string } {
	const pt = (p: EditPoint): EditPoint => ({
		x: Math.round((p.x - ox) * scale),
		y: Math.round((p.y - oy) * scale),
	});
	const svg: string[] = [];
	const pathW = Math.round(width * scale);
	const pathH = Math.round(height * scale);
	const paths = geometry.subpaths.map((sub): CustomGeometryPath => {
		const segments: CustomGeometrySegment[] = [];
		const start = pt(sub.nodes[0]);
		segments.push({ type: 'moveTo', pt: start });
		svg.push(`M ${fmt(start.x)} ${fmt(start.y)}`);
		sub.segments.forEach((seg, i) => {
			// A closed path's final straight edge back to the start IS `a:close`;
			// writing an explicit `a:lnTo` to the start as well would be redundant.
			if (sub.closed && seg.kind === 'line' && i === sub.segments.length - 1) {
				return;
			}
			const end = pt(sub.nodes[(i + 1) % sub.nodes.length]);
			if (seg.kind === 'line') {
				segments.push({ type: 'lineTo', pt: end });
				svg.push(`L ${fmt(end.x)} ${fmt(end.y)}`);
			} else {
				const c1 = pt(seg.c1);
				const c2 = pt(seg.c2);
				segments.push({ type: 'cubicBezTo', pts: [c1, c2, end] });
				svg.push(
					`C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(end.x)} ${fmt(end.y)}`,
				);
			}
		});
		if (sub.closed) {
			segments.push({ type: 'close' });
			svg.push('Z');
		}
		return {
			width: pathW,
			height: pathH,
			segments,
			...(sub.fillMode ? { fillMode: sub.fillMode } : {}),
			...(sub.stroke !== undefined ? { stroke: sub.stroke } : {}),
		};
	});
	return { paths, svg: svg.join(' ') };
}

/**
 * The element patch for `geometry` edited in `frame`, or `undefined` when the
 * geometry is empty (nothing left to draw).
 */
export function editGeometryToElementPatch(
	geometry: EditGeometry,
	frame: EditFrame,
): EditPointsElementPatch | undefined {
	const raw = editGeometryBounds(geometry);
	if (!raw || geometry.subpaths.length === 0) {
		return undefined;
	}
	const bounds = { ...raw };
	// A perfectly straight horizontal / vertical outline has zero extent on one
	// axis; pad it symmetrically so the box (and `a:ext`) stays positive.
	if (bounds.maxX - bounds.minX < MIN_EXTENT_PX) {
		const mid = (bounds.minX + bounds.maxX) / 2;
		bounds.minX = mid - MIN_EXTENT_PX / 2;
		bounds.maxX = mid + MIN_EXTENT_PX / 2;
	}
	if (bounds.maxY - bounds.minY < MIN_EXTENT_PX) {
		const mid = (bounds.minY + bounds.maxY) / 2;
		bounds.minY = mid - MIN_EXTENT_PX / 2;
		bounds.maxY = mid + MIN_EXTENT_PX / 2;
	}
	const box = reanchorEditFrame(frame, bounds);
	const { paths, svg } = editGeometryToPaths(
		geometry,
		bounds.minX,
		bounds.minY,
		box.width,
		box.height,
	);
	return {
		x: box.x,
		y: box.y,
		width: box.width,
		height: box.height,
		shapeType: 'custom',
		shapeAdjustments: undefined,
		pathData: svg,
		pathWidth: paths[0].width,
		pathHeight: paths[0].height,
		customGeometryPaths: paths,
		customGeometryRawData: undefined,
		customGeometryAdjustHandlesXY: undefined,
		customGeometryAdjustHandlesPolar: undefined,
		customGeometryConnectionSites: undefined,
		customGeometryTextRect: undefined,
	};
}
