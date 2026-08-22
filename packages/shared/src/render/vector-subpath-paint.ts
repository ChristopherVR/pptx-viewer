/**
 * Pure paint-decision logic for per-sub-path geometry, shared by custom
 * geometry (`a:custGeom`) AND multi-sub-path preset shapes (`a:prstGeom`).
 *
 * Kept free of any view-layer concern (JSX, Vue/Angular templates, DOM) so it
 * is unit-testable in isolation; each binding's SVG emission is a thin ~10-line
 * mapping over its result. Originally lived only in the React package
 * (`viewer/utils/vector-subpath-paint.ts`), which meant Vue and Vanilla (and,
 * for preset shapes, every binding including React) had no way to honour a
 * sub-path's own `@fill`/`@stroke` flags: they flattened every sub-path into
 * one merged path with a single element-level fill, so a stroke-only sub-path
 * inside a filled shape (an open eye/mouth on `smileyFace`) or a shading
 * sub-path (`lighten`/`darken`, the bevel highlight on `actionButton*`) either
 * rendered filled-and-distorted or vanished outright.
 *
 * Both geometry kinds evaluate to the exact same per-sub-path shape -
 * `{ d, fillMode, stroke }` - which is what lets ONE function
 * ({@link buildSubpathPaints}) paint either: `customGeometryPathsToSvgSubpaths`
 * (core) already returns that shape for custom geometry, and preset geometry's
 * `PresetSubpathResult` (`{ d, fill, stroke }`, from core's
 * `evaluatePresetShape`) is a one-line rename away - see
 * `./subpath-fill-overlay`, which resolves *which* elements need this
 * treatment and calls this to build the actual paints.
 */
import type { CustomGeometrySubpathSvg } from 'pptx-viewer-core';

import { colorWithOpacity, hexToRgbChannels } from './fill-style';

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
 * Adjust a fill colour for an OOXML `@fill` mode (`a:path/@fill` on a custom
 * geometry sub-path, or the equivalent flag on a preset sub-path). `norm` /
 * `undefined` return the colour unchanged; `lighten` / `lightenLess` blend
 * towards white and `darken` / `darkenLess` towards black (the `*Less`
 * variants half as strongly). `none` is handled by the caller (no fill
 * emitted) and returns the input here.
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

/** Resolved paint intent for a single geometry sub-path. */
export interface SubpathPaint {
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
 *
 * Shared between custom geometry and multi-sub-path preset shapes; the caller
 * adapts whichever core evaluator result it has into the common
 * `{ d, fillMode, stroke }` shape first (see `./subpath-fill-overlay`).
 */
export function buildSubpathPaints(
	subpaths: CustomGeometrySubpathSvg[],
	hasFill: boolean,
	fillColor: string,
	fillOpacity: number | undefined,
): SubpathPaint[] {
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
