/**
 * Pure paint-decision logic for per-sub-path custom geometry and stroke-only
 * presets. Kept free of JSX so it is unit-testable without React DOM; the SVG
 * emission lives in `vector-subpath-render.tsx`.
 *
 * A custom geometry (`a:custGeom`) can carry several sub-paths, each with its
 * own `@fill` mode (norm / lighten / darken / none) and `@stroke` flag. These
 * helpers resolve, per sub-path, the fill paint and whether a stroke is drawn,
 * so the renderer can emit one `<path>` per sub-path instead of concatenating
 * them into a single element-level fill.
 */
import { evaluatePresetShape, hasShapeProperties } from 'pptx-viewer-core';
import type { CustomGeometrySubpathSvg, PptxElement, PresetSubpathResult } from 'pptx-viewer-core';

import { colorWithOpacity, hexToRgbChannels } from './color';

/** Clamp a channel to 0-255 and format as a 2-digit hex byte. */
function toHexByte(value: number): string {
	const clamped = Math.max(0, Math.min(255, Math.round(value)));
	return clamped.toString(16).padStart(2, '0');
}

/**
 * Lighten (`towardsWhite`) or darken a hex colour by a unit fraction. Returns
 * the input unchanged when it is not a 6-digit hex.
 */
function shiftHex(hex: string, factor: number, towardsWhite: boolean): string {
	const channels = hexToRgbChannels(hex);
	if (!channels) {
		return hex;
	}
	const shift = (c: number): number => (towardsWhite ? c + (255 - c) * factor : c * (1 - factor));
	return `#${toHexByte(shift(channels.r))}${toHexByte(shift(channels.g))}${toHexByte(shift(channels.b))}`;
}

/**
 * Adjust a fill colour for an OOXML `a:path/@fill` mode. `norm`/`undefined`
 * return the colour unchanged; `lighten`/`lightenLess` blend towards white and
 * `darken`/`darkenLess` towards black (the `*Less` variants half as strongly).
 * `none` is handled by the caller (no fill emitted) and returns the input here.
 */
export function adjustFillForMode(
	fillHex: string,
	mode: CustomGeometrySubpathSvg['fillMode'],
): string {
	switch (mode) {
		case 'lighten':
			return shiftHex(fillHex, 0.4, true);
		case 'lightenLess':
			return shiftHex(fillHex, 0.2, true);
		case 'darken':
			return shiftHex(fillHex, 0.4, false);
		case 'darkenLess':
			return shiftHex(fillHex, 0.2, false);
		default:
			return fillHex;
	}
}

/** Resolved paint intent for a single custom-geometry sub-path. */
export interface CustomSubpathPaint {
	/** SVG path data for this sub-path. */
	d: string;
	/** Resolved fill paint, or `'none'` when this sub-path opts out of fill. */
	fill: string;
	/** Whether this sub-path draws its stroke (`@stroke` !== 0). */
	stroked: boolean;
}

/**
 * Resolve each sub-path's fill/stroke intent from its `@fill`/`@stroke` flags.
 *
 * A sub-path fills only when the shape has a fill *and* its own mode is not
 * `none`; the fill colour is adjusted per the sub-path's mode. Stroke is drawn
 * unless the sub-path sets `@stroke="0"` (`stroke === false`).
 */
export function buildCustomSubpathPaints(
	subpaths: CustomGeometrySubpathSvg[],
	hasFill: boolean,
	fillColor: string,
	fillOpacity: number | undefined,
): CustomSubpathPaint[] {
	return subpaths.map((subpath) => {
		const fillOff = subpath.fillMode === 'none' || !hasFill;
		return {
			d: subpath.d,
			fill: fillOff
				? 'none'
				: colorWithOpacity(adjustFillForMode(fillColor, subpath.fillMode), fillOpacity),
			stroked: subpath.stroke !== false,
		};
	});
}

/**
 * Return a preset shape's evaluated sub-paths only when the geometry is a
 * stroke-only ("open") preset such as `arc`: `evaluatePresetShape` reports
 * `fillNone`. Custom geometry (which paints via `pathData`), non-`shape`
 * elements, and normal filled presets return `undefined` so callers keep their
 * existing rendering.
 */
export function getStrokeOnlyPresetPaths(element: PptxElement): PresetSubpathResult[] | undefined {
	// Restricted to `shape` elements: images/pictures paint their own bitmap and
	// must never be reinterpreted as a stroke-only outline.
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
