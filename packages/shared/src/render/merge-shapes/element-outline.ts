/**
 * An element's filled outline as polygon loops in SLIDE coordinates, the input
 * the Merge Shapes boolean works on.
 *
 * The geometry is the same one the renderers paint: custom geometry through
 * `resolveLiveCustomGeometryPath` (or the structured `customGeometryPaths` a
 * freeform carries), presets through core's `evaluatePresetShape`, and a
 * plain rectangle for a text box. Curves are flattened, then the element's
 * flips and rotation are applied about its centre, the way `a:xfrm` applies
 * them, so a rotated shape merges where it is drawn rather than where its
 * unrotated box would be.
 *
 * @module render/merge-shapes/element-outline
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	customGeometryPathsToSvgSubpaths,
	evaluatePresetShape,
	getShapeType,
} from 'pptx-viewer-core';

import { resolveLiveCustomGeometryPath } from '../custom-geometry-live-path';
import { flattenSvgPath } from '../svg-path-flatten';
import type { PolygonLoop } from './polygon-types';

/** Samples per full curve when flattening; enough for a smooth merged ellipse. */
export const MERGE_CURVE_SEGMENTS = 24;

interface LocalPath {
	d: string;
	/** Scale from path units to element pixels. */
	sx: number;
	sy: number;
}

function rectPath(width: number, height: number): LocalPath {
	return { d: `M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`, sx: 1, sy: 1 };
}

function localPaths(el: PptxElement): LocalPath[] {
	const { width, height } = el;
	if (el.type !== 'shape' && el.type !== 'text') {
		return [rectPath(width, height)];
	}
	const live = resolveLiveCustomGeometryPath(el);
	if (live) {
		return [{ d: live.pathData, sx: width / live.pathWidth, sy: height / live.pathHeight }];
	}
	if (el.type === 'shape' && el.customGeometryPaths && el.customGeometryPaths.length > 0) {
		return customGeometryPathsToSvgSubpaths(el.customGeometryPaths, width, height)
			.filter((sub) => sub.fillMode !== 'none')
			.map((sub) => ({ d: sub.d, sx: 1, sy: 1 }));
	}
	const preset = el.shapeType;
	if (!preset || preset === 'custom') {
		return [rectPath(width, height)];
	}
	const evaluated =
		evaluatePresetShape(preset, width, height, el.shapeAdjustments) ??
		evaluatePresetShape(getShapeType(preset), width, height, el.shapeAdjustments);
	if (!evaluated || evaluated.fillNone) {
		return evaluated ? [] : [rectPath(width, height)];
	}
	return evaluated.paths
		.filter((sub) => sub.fill !== 'none')
		.map((sub) => ({ d: sub.d, sx: 1, sy: 1 }));
}

/**
 * The element's filled area as loops in slide pixels (even-odd), or an empty
 * list for a stroke-only geometry such as a line or an open arc.
 */
export function elementOutlineLoops(
	el: PptxElement,
	curveSegments = MERGE_CURVE_SEGMENTS,
): PolygonLoop[] {
	const { x, y, width, height } = el;
	const cx = width / 2;
	const cy = height / 2;
	const angle = ((el.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const loops: PolygonLoop[] = [];
	for (const path of localPaths(el)) {
		for (const loop of flattenSvgPath(path.d, curveSegments)) {
			if (loop.length < 3) {
				continue;
			}
			loops.push(
				loop.map((p) => {
					let lx = p.x * path.sx;
					let ly = p.y * path.sy;
					if (el.flipHorizontal) {
						lx = width - lx;
					}
					if (el.flipVertical) {
						ly = height - ly;
					}
					const dx = lx - cx;
					const dy = ly - cy;
					return { x: x + cx + dx * cos - dy * sin, y: y + cy + dx * sin + dy * cos };
				}),
			);
		}
	}
	return loops;
}
