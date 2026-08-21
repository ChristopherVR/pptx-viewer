import { clampUnitInterval } from '../color/color-primitives';
/**
 * Framework-agnostic connector geometry calculations.
 *
 * Computes SVG path data for straight, bent, and curved connectors.
 */
import type { PptxElementWithShapeStyle } from '../types';
import { elbowCurveSegments, elbowWaypoints } from './connector-elbow-geometry';
import type { ElbowSegments } from './connector-elbow-geometry';

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

/**
 * Segment count implied by a `bentConnector3/4/5` lower-cased shape type, or
 * `undefined` for `bentConnector2` (handled by its own fixed-shape branch)
 * and non-bent types.
 */
function bentSegmentCount(normalizedType: string): ElbowSegments | undefined {
	if (normalizedType.includes('bentconnector5')) {
		return 5;
	}
	if (normalizedType.includes('bentconnector4')) {
		return 4;
	}
	if (normalizedType.includes('bentconnector3')) {
		return 3;
	}
	return undefined;
}

/**
 * Segment count implied by a `curvedConnector3/4/5` lower-cased shape type,
 * or `undefined` for `curvedConnector2` (handled by its own fixed-shape
 * branch) and non-curved types.
 */
function curvedSegmentCount(normalizedType: string): ElbowSegments | undefined {
	if (normalizedType.includes('curvedconnector5')) {
		return 5;
	}
	if (normalizedType.includes('curvedconnector4')) {
		return 4;
	}
	if (normalizedType.includes('curvedconnector3')) {
		return 3;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Main path calculation
// ---------------------------------------------------------------------------

/**
 * Compute the SVG path geometry for a connector element.
 *
 * Supports the following OOXML connector types:
 * - **bentConnector2** (L-shape, 1 segment)
 * - **bentConnector3** (Z-shape, 2 segments with 1 adjustment)
 * - **bentConnector4** (3 segments with 2 adjustments)
 * - **bentConnector5** (4 segments with 3 adjustments)
 * - **curvedConnector2** (quadratic Bezier L-curve)
 * - **curvedConnector3** (2-segment cubic Bezier)
 * - **curvedConnector4** (3-segment cubic Bezier)
 * - **curvedConnector5** (4-segment cubic Bezier)
 * - **straightConnector1** / default (straight line)
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
	// Ensure minimum dimensions of 1px to avoid degenerate geometry
	const width = Math.max(element.width, 1);
	const height = Math.max(element.height, 1);
	const normalizedType = (element.shapeType || '').toLowerCase();
	/** Format a coordinate pair, rounding to integers for clean SVG output. */
	const point = (x: number, y: number) => `${Math.round(x)} ${Math.round(y)}`;

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
	const flipH = Boolean(element.flipHorizontal);
	const flipV = Boolean(element.flipVertical);
	const startX = flipH ? width : 0;
	const startY = flipV ? height : 0;
	const endX = flipH ? 0 : width;
	const endY = flipV ? 0 : height;

	// ── bentConnector3/4/5 — orientation-aware orthogonal elbow ────────
	// The bend axis is chosen from whichever of width/height dominates (see
	// `connector-elbow-geometry.ts`): a wide box (shapes side by side) bends
	// around a vertical mid-line, a tall box (stacked shapes) bends around a
	// horizontal mid-line, instead of always treating width as primary.
	const bentSegments = bentSegmentCount(normalizedType);
	if (bentSegments) {
		const adj1 = getConnectorAdjustment(element, 'adj1', 0.5);
		const adj2 = getConnectorAdjustment(element, 'adj2', 0.5);
		const adj3 = getConnectorAdjustment(element, 'adj3', 0.5);
		const waypoints = elbowWaypoints(
			startX,
			startY,
			endX,
			endY,
			width,
			height,
			bentSegments,
			adj1,
			adj2,
			adj3,
		);
		return {
			startX,
			startY,
			endX,
			endY,
			pathData: waypoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${point(x, y)}`).join(' '),
		};
	}

	// ── bentConnector2 — L-shape ──────────────────────────────────────
	if (normalizedType.includes('bentconnector2')) {
		return {
			startX,
			startY,
			endX,
			endY,
			pathData: `M ${point(startX, startY)} L ${point(endX, startY)} L ${point(endX, endY)}`,
		};
	}

	// ── curvedConnector3/4/5 — orientation-aware smooth elbow ──────────
	// Same axis-dominance choice as the bent variants above, rendered as
	// cubic Beziers instead of sharp corners.
	const curvedSegments = curvedSegmentCount(normalizedType);
	if (curvedSegments) {
		const adj1 = getConnectorAdjustment(element, 'adj1', 0.5);
		const adj2 = getConnectorAdjustment(element, 'adj2', 0.5);
		const adj3 = getConnectorAdjustment(element, 'adj3', 0.5);
		const curves = elbowCurveSegments(
			startX,
			startY,
			endX,
			endY,
			width,
			height,
			curvedSegments,
			adj1,
			adj2,
			adj3,
		);
		const curvePath = curves
			.map(({ control, end }) => `C ${point(...control)} ${point(...control)} ${point(...end)}`)
			.join(' ');
		return {
			startX,
			startY,
			endX,
			endY,
			pathData: `M ${point(startX, startY)} ${curvePath}`,
		};
	}

	// ── curvedConnector2 — quadratic Bézier (L-curve) ─────────────────
	if (normalizedType.includes('curvedconnector2')) {
		return {
			startX,
			startY,
			endX,
			endY,
			pathData: `M ${point(startX, startY)} Q ${point(endX, startY)} ${point(endX, endY)}`,
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
