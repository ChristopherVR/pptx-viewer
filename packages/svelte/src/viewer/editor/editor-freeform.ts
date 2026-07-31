import type { CustomGeometrySegment, ShapePptxElement } from 'pptx-viewer-core';
import type { InkPoint } from 'pptx-viewer-shared';

/**
 * Turn a completed freehand stroke into a closed custom-geometry (`a:custGeom`)
 * shape, the Draw tab's Freeform tool.
 *
 * Freeform is NOT ink. Ink is a stroke annotation: it has a pen tool, opacity
 * and pressure, and PowerPoint treats it as markup. A freeform is a real
 * drawing shape with its own geometry, so it can be filled, given an outline
 * style, and edited like any other shape afterwards. That is why this cannot
 * go through `strokeToInkElement`, which stores freeform as pen ink.
 *
 * Geometry is emitted in the 1/100th-of-a-pixel coordinate space the parser and
 * the renderer already agree on (`CustomGeometryPath.width`/`height` are the
 * path's own coordinate extent, not the element's box), and the path is closed
 * once there are enough points for a closure to mean anything.
 *
 * Kept local to the Svelte binding for now rather than pushed into
 * `pptx-viewer-shared`: the shared ink module is being edited concurrently, and
 * this is a small pure function with its own test. It is a prime extraction
 * candidate the moment a second binding grows a Freeform tool.
 */

/** Path coordinates are stored at 100x element pixels, matching the geometry engine. */
const COORD_SCALE = 100;

/** Fewer points than this is a tap, not a drawing. */
const MIN_POINTS = 2;

export function strokeToFreeformShape(
	points: readonly InkPoint[],
	color: string,
	width: number,
): ShapePptxElement | null {
	if (points.length < MIN_POINTS) {
		return null;
	}

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const point of points) {
		minX = Math.min(minX, point.x);
		minY = Math.min(minY, point.y);
		maxX = Math.max(maxX, point.x);
		maxY = Math.max(maxY, point.y);
	}

	// Pad by the stroke width so a thick outline is not clipped at the box edge.
	minX -= width;
	minY -= width;
	maxX += width;
	maxY += width;

	const boxWidth = Math.max(maxX - minX, 1);
	const boxHeight = Math.max(maxY - minY, 1);

	const segments: CustomGeometrySegment[] = points.map((point, index) => {
		const pt = {
			x: Math.round((point.x - minX) * COORD_SCALE),
			y: Math.round((point.y - minY) * COORD_SCALE),
		};
		return index === 0 ? { type: 'moveTo', pt } : { type: 'lineTo', pt };
	});
	if (segments.length > MIN_POINTS) {
		segments.push({ type: 'close' });
	}

	return {
		id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		type: 'shape',
		x: minX,
		y: minY,
		width: boxWidth,
		height: boxHeight,
		shapeType: 'custom',
		shapeStyle: { fillColor: 'transparent', strokeColor: color, strokeWidth: width },
		customGeometryPaths: [
			{
				width: Math.round(boxWidth * COORD_SCALE),
				height: Math.round(boxHeight * COORD_SCALE),
				segments,
			},
		],
	};
}
