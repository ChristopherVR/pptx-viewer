import type { ShapePptxElement } from 'pptx-viewer-core';
import type { InkPoint } from 'pptx-viewer-shared';
import { buildFreeformShapeElement } from 'pptx-viewer-shared';

/**
 * Turn a completed freehand stroke into a custom-geometry (`a:custGeom`)
 * shape, the Draw tab's Freeform tool.
 *
 * Freeform is NOT ink. Ink is a stroke annotation: it has a pen tool, opacity
 * and pressure, and PowerPoint treats it as markup. A freeform is a real
 * drawing shape with its own geometry, so it can be filled, given an outline
 * style, and edited like any other shape afterwards. That is why this cannot
 * go through `strokeToInkElement`, which stores freeform as pen ink.
 *
 * The geometry (100x coordinate space, stroke-width padding, and closing the
 * path ONLY when the stroke ends back on its start point, as PowerPoint's
 * Freeform/Scribble does) lives in shared `freeform-stroke-geometry.ts`, the
 * one copy React's `finishDrawStroke` uses too; this is the Svelte-facing
 * signature over it.
 */
export function strokeToFreeformShape(
	points: readonly InkPoint[],
	color: string,
	width: number,
): ShapePptxElement | null {
	return buildFreeformShapeElement(points, { color, width });
}
