/**
 * The SVG `viewBox` that fits a SmartArt drawing's cached shapes. Split out of
 * `smartart-drawing.ts`.
 *
 * @module render/smartart-drawing-viewbox
 */
import type { PptxSmartArtDrawingShape } from 'pptx-viewer-core';

/** SVG `viewBox` bounding-box derived from all drawing shapes. */
export interface DrawingViewBox {
	minX: number;
	minY: number;
	width: number;
	height: number;
}

/** Compute the SVG viewBox that fits all drawing shapes, rebasing to (0, 0). */
export function computeDrawingViewBox(shapes: readonly PptxSmartArtDrawingShape[]): DrawingViewBox {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const s of shapes) {
		const shapeMinX = Math.min(s.x, s.textFrameX ?? s.x);
		const shapeMinY = Math.min(s.y, s.textFrameY ?? s.y);
		const shapeMaxX = Math.max(
			s.x + s.width,
			(s.textFrameX ?? s.x) + (s.textFrameWidth ?? s.width),
		);
		const shapeMaxY = Math.max(
			s.y + s.height,
			(s.textFrameY ?? s.y) + (s.textFrameHeight ?? s.height),
		);
		if (shapeMinX < minX) {
			minX = shapeMinX;
		}
		if (shapeMinY < minY) {
			minY = shapeMinY;
		}
		if (shapeMaxX > maxX) {
			maxX = shapeMaxX;
		}
		if (shapeMaxY > maxY) {
			maxY = shapeMaxY;
		}
	}
	if (!Number.isFinite(minX)) {
		return { minX: 0, minY: 0, width: 1, height: 1 };
	}
	return {
		minX,
		minY,
		width: maxX - minX || 1,
		height: maxY - minY || 1,
	};
}
