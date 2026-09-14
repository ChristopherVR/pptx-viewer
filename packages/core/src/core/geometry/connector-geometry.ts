import { clampUnitInterval } from '../color/color-primitives';
/**
 * Framework-agnostic connector geometry calculations.
 *
 * Computes SVG path data for straight, bent, and curved connectors.
 */
import type { PptxElementWithShapeStyle } from '../types';
import { evaluateConnectorPresetPath } from './connector-preset-geometry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of computing a connector's SVG path geometry.
 *
 * Contains the SVG `d` attribute path data and the absolute start/end
 * coordinates within the element's local coordinate space.
 */
export interface ConnectorPathGeometry {
	/** SVG path data string (e.g. `"M 0 0 L 100 100"`). */
	pathData: string;
	/** X coordinate of the path starting point. */
	startX: number;
	/** Y coordinate of the path starting point. */
	startY: number;
	/** X coordinate of the path ending point. */
	endX: number;
	/** Y coordinate of the path ending point. */
	endY: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a connector adjustment value from an element, normalizing it to [0, 1].
 *
 * OOXML stores connector adjustments in units of 1/100000 (e.g. 50000 = 50%).
 * This function looks up the named key in `shapeAdjustments`, falling back to
 * the generic `adj` key, and finally to the provided `fallback` value.
 *
 * @param element - The connector element whose adjustments are read.
 * @param key - The specific adjustment key (e.g. `"adj1"`, `"adj2"`).
 * @param fallback - Default value in the [0, 1] range if no adjustment is found.
 * @returns A clamped value in the [0, 1] range.
 */
export function getConnectorAdjustment(
	element: PptxElementWithShapeStyle,
	key: string,
	fallback: number,
): number {
	const direct = element.shapeAdjustments?.[key];
	if (typeof direct === 'number' && Number.isFinite(direct)) {
		return clampUnitInterval(direct / 100000);
	}

	const fallbackKey = element.shapeAdjustments?.adj;
	if (typeof fallbackKey === 'number' && Number.isFinite(fallbackKey)) {
		return clampUnitInterval(fallbackKey / 100000);
	}

	return clampUnitInterval(fallback);
}

// ---------------------------------------------------------------------------
// Main path calculation
// ---------------------------------------------------------------------------

/**
 * Compute the SVG path geometry for a connector element.
 *
 * Bent and curved connector variants are evaluated from their normative
 * OOXML preset path definitions. Unknown connector types fall back to a
 * straight line.
 *
 * Adjustment values (adj1, adj2, adj3) control the midpoint positions
 * of the intermediate segments as fractions of width or height.
 *
 * @param element - The connector element with `shapeType`, `width`, `height`, and `shapeAdjustments`.
 * @returns The computed {@link ConnectorPathGeometry} with SVG path data.
 */
export function getConnectorPathGeometry(
	element: PptxElementWithShapeStyle,
): ConnectorPathGeometry {
	// Preserve zero extents: vertical and horizontal connectors legitimately use
	// zero-width or zero-height boxes, and clamping them tilts the rendered line.
	const width = Math.max(element.width, 0);
	const height = Math.max(element.height, 0);
	const shapeType = element.shapeType || '';
	const point = (x: number, y: number) => `${x} ${y}`;

	// G-H3: connectors carry the same `flipH` / `flipV` semantics as
	// other DrawingML shapes, but unlike a plain rect the flip changes
	// which CORNER the start sits at. For straight / curved connectors
	// the visual result is identical to a CSS flip of the same SVG
	// path, but for elbow (`bentConnector*`) the routing geometry
	// fundamentally depends on the start corner — an L-shape that bends
	// right-then-down becomes left-then-down when flipH is applied.
	//
	// We model this by adjusting `startX` / `startY` / `endX` / `endY`:
	//   - default:  start (0,0)         → end (W,H)
	//   - flipH:    start (W,0)         → end (0,H)
	//   - flipV:    start (0,H)         → end (W,0)
	//   - flipH+V:  start (W,H)         → end (0,0)
	const rawSpPr = element.rawXml?.['p:spPr'] as Record<string, unknown> | undefined;
	const rawXfrm = rawSpPr?.['a:xfrm'] as Record<string, unknown> | undefined;
	const xmlBoolean = (value: unknown) =>
		value === true || value === 1 || value === '1' || value === 'true';
	const flipH = element.flipHorizontal ?? xmlBoolean(rawXfrm?.['@_flipH']);
	const flipV = element.flipVertical ?? xmlBoolean(rawXfrm?.['@_flipV']);
	const startX = flipH ? width : 0;
	const startY = flipV ? height : 0;
	const endX = flipH ? 0 : width;
	const endY = flipV ? 0 : height;

	const presetPath = evaluateConnectorPresetPath(
		shapeType,
		width,
		height,
		element.shapeAdjustments,
		flipH,
		flipV,
	);
	if (presetPath) {
		return {
			startX,
			startY,
			endX,
			endY,
			pathData: presetPath,
		};
	}

	// ── straightConnector1 / default — straight line ──────────────────
	return {
		startX,
		startY,
		endX,
		endY,
		pathData: `M ${point(startX, startY)} L ${point(endX, endY)}`,
	};
}
