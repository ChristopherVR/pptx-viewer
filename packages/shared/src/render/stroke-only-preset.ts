/**
 * Stroke-only ("open") preset geometry.
 *
 * A handful of ECMA-376 presets are OPEN: `line`, the straight/bent/curved
 * connector shapes, `arc`, and anything else whose `a:pathLst` declares
 * `fill="none"` on every sub-path. PowerPoint paints those as a stroked path
 * and nothing else - there is no region to fill and no box to outline.
 *
 * Rendering them as an HTML box with a CSS `border` (which is what a binding
 * does by default, because a border is how every other outline is painted) is
 * not a small inaccuracy: `<a:prstGeom prst="line"/>` comes out as a RECTANGLE
 * outline instead of the line itself, and every arc-class preset is closed into
 * its bounding box. The fix is to route these through the same stroked-SVG
 * overlay the bindings already use for gradient/pattern outlines, which is what
 * {@link buildStrokeOutline} does with the geometry resolved here.
 *
 * Lives in shared because "is this preset stroke-only" is a pure question about
 * the geometry, and all five bindings have to answer it identically: they also
 * suppress the container fill, the CSS border and the shape clip-path for these
 * elements (a zero-area clip-path would otherwise clip the overlay away).
 */
import { evaluatePresetShape, hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement, PresetSubpathResult } from 'pptx-viewer-core';

/**
 * Return a preset shape's evaluated sub-paths when, and only when, the geometry
 * is stroke-only: `evaluatePresetShape` reports `fillNone`, i.e. every sub-path
 * declares `fill="none"`.
 *
 * Custom geometry (which paints via `pathData`), non-`shape` elements and
 * ordinary filled presets return `undefined` so callers keep their existing
 * rendering. The element type is restricted to `shape` on purpose: a picture
 * paints its own bitmap and must never be reinterpreted as an outline.
 */
export function getStrokeOnlyPresetPaths(element: PptxElement): PresetSubpathResult[] | undefined {
	if (element.type !== 'shape' || !hasShapeProperties(element)) {
		return undefined;
	}
	const shapeType = element.shapeType;
	if (!shapeType || shapeType === 'custom') {
		return undefined;
	}
	// Custom geometry already renders through the `pathData` branch.
	if (element.pathData) {
		return undefined;
	}
	const result = evaluatePresetShape(
		shapeType,
		Math.max(element.width, 1),
		Math.max(element.height, 1),
		element.shapeAdjustments,
	);
	if (!result || !result.fillNone) {
		return undefined;
	}
	const drawable = result.paths.filter((path) => path.d !== '');
	return drawable.length > 0 ? drawable : undefined;
}

/**
 * Whether this element is a stroke-only preset, i.e. it must be painted as a
 * stroked path with no container fill, no CSS border and no shape clip-path.
 * The predicate every binding gates its container cascade on.
 */
export function isStrokeOnlyPresetElement(element: PptxElement): boolean {
	return getStrokeOnlyPresetPaths(element) !== undefined;
}

/**
 * SVG path data for a stroke-only preset, in the element's own pixel space.
 *
 * Sub-paths that opt out of the stroke (`a:path/@stroke="0"`) are dropped; the
 * rest are concatenated, which is exactly how one `<path>` paints several open
 * strands. Returns `undefined` for anything that is not a stroke-only preset.
 */
export function strokeOnlyPresetPathData(element: PptxElement): string | undefined {
	const paths = getStrokeOnlyPresetPaths(element);
	if (!paths) {
		return undefined;
	}
	const stroked = paths.filter((path) => path.stroke !== false).map((path) => path.d);
	return stroked.length > 0 ? stroked.join(' ') : undefined;
}
