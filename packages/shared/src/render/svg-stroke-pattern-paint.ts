/**
 * SVG `<pattern>` paint server for a preset pattern OUTLINE (`a:ln/a:pattFill`).
 *
 * Split out of `svg-gradient-paint.ts` to keep that file (and this one) under
 * this repo's ~300-LOC guideline; both are part of the same "freeform shape
 * needs a real SVG paint server, not a flattened representative colour"
 * effort (see that module's header).
 *
 * @module svg-stroke-pattern-paint
 */
import type { ShapeStyle } from 'pptx-viewer-core';

import { getPatternTile, normalizeHexColor } from './fill-style';
import { svgGradientId } from './svg-gradient-paint';

/**
 * An SVG `<pattern>` paint server for a preset pattern OUTLINE.
 *
 * The tile is carried as a data-URI `<image>` rather than inline primitives so
 * every binding can render the `<pattern>` from plain attribute bindings, with
 * no raw-markup injection (which Angular's template sanitiser would fight).
 */
export interface SvgPatternDef {
	kind: 'pattern';
	id: string;
	/** Tile size in user-space px; the pattern repeats on this grid. */
	width: number;
	height: number;
	/** `data:image/svg+xml,…` of one rendered tile. */
	href: string;
}

/**
 * Build the SVG paint-server definition for a shape's pattern OUTLINE
 * (`a:ln/a:pattFill`).
 *
 * A CSS `border` cannot be hatched, so a patterned outline was painted with the
 * parser's `strokeColor` - the pattern's foreground - as a flat line: the weave
 * disappeared entirely. Stroking a path with this pattern renders the real tile.
 *
 * Returns `undefined` when the outline is not a pattern or the preset is one we
 * do not draw, so callers keep the solid fallback.
 */
export function buildSvgStrokePatternDef(
	style: ShapeStyle | undefined,
	elementId: string,
): SvgPatternDef | undefined {
	if (!style || style.strokeFillMode !== 'pattern' || !style.strokePatternPreset) {
		return undefined;
	}
	const fg = normalizeHexColor(style.strokeColor, '#000000');
	const bg = normalizeHexColor(style.strokePatternBackgroundColor, '#ffffff');
	const tile = getPatternTile(style.strokePatternPreset, fg, bg);
	if (!tile) {
		return undefined;
	}
	const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile.w}" height="${tile.h}">${tile.inner}</svg>`;
	return {
		kind: 'pattern',
		id: svgGradientId(elementId, 'strokepat'),
		width: tile.w,
		height: tile.h,
		href: `data:image/svg+xml,${encodeURIComponent(markup)}`,
	};
}
