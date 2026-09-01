/**
 * Arrow-head marker shapes for connectors.
 *
 * A connector's line geometry and its end decorations are independent concerns:
 * routing answers "where does the line go", this module answers "what is drawn
 * at each end and how big is it". Splitting them keeps `connector-path.ts`
 * within the file-size rule and gives the arrow-size mapping a home of its own,
 * since it is the part users actually configure (the inspector's six arrowhead
 * controls all resolve to values consumed here).
 *
 * Pure and framework-agnostic: the `<marker>` element itself is emitted by each
 * binding's view layer from the {@link MarkerShape} returned here.
 */

import type { ConnectorArrowType } from 'pptx-viewer-core';

/** Arrow head size token (`a:ln/a:headEnd|tailEnd/@w|@len`). */
export type ArrowSize = 'sm' | 'med' | 'lg';

/** Shape description for a SVG `<marker>` element (viewBox 0 0 10 10). */
export interface MarkerShape {
	shape: 'path' | 'circle';
	d?: string;
	/**
	 * Suggested `markerWidth` (along the line: arrow *length*). Derived from the
	 * connector's `@len` size token. Bindings should apply this instead of a
	 * hard-coded value so `sm`/`lg` arrows scale. Defaults to the historical `4`.
	 */
	markerWidth: number;
	/** Suggested `markerHeight` (perpendicular: arrow *width*, from `@w`). */
	markerHeight: number;
	/**
	 * True for a stroke-only (open, unfilled) marker path, i.e. the `'arrow'`
	 * open chevron. A binding should render this path with `fill="none"` and
	 * `stroke={strokeColor}` instead of the default solid `fill={strokeColor}`
	 * it uses for every other shape; a chevron rendered with a solid fill draws
	 * as a filled wedge, indistinguishable from `'triangle'`.
	 */
	strokeOnly?: boolean;
}

/**
 * Base `markerWidth`/`markerHeight` (in `strokeWidth` units) for a `med` arrow.
 * `sm`/`lg` scale relative to this, mirroring PowerPoint's discrete sizes.
 */
const ARROW_BASE_MARKER_SIZE = 4;
const ARROW_SIZE_SCALE: Record<ArrowSize, number> = { sm: 0.6, med: 1, lg: 1.5 };

/**
 * Map a `ConnectorArrowType` value to its SVG marker shape, scaling the marker
 * box by the arrow's width (`@w`) and length (`@len`) size tokens.
 *
 * The `<marker>` viewBox stays `0 0 10 10`; the returned {@link MarkerShape}
 * carries `markerWidth` (length, along the line) and `markerHeight` (width,
 * perpendicular) so bindings render `sm`/`med`/`lg` arrows at the right size
 * instead of a single fixed dimension.
 *
 * @param type        Arrow head shape.
 * @param arrowWidth  `@w` size token (perpendicular thickness). Defaults `med`.
 * @param arrowLength `@len` size token (length along the line). Defaults `med`.
 */
export function markerPath(
	type: ConnectorArrowType,
	arrowWidth?: ArrowSize,
	arrowLength?: ArrowSize,
): MarkerShape {
	const markerWidth = ARROW_BASE_MARKER_SIZE * (ARROW_SIZE_SCALE[arrowLength ?? 'med'] ?? 1);
	const markerHeight = ARROW_BASE_MARKER_SIZE * (ARROW_SIZE_SCALE[arrowWidth ?? 'med'] ?? 1);
	const box = { markerWidth, markerHeight };
	switch (type) {
		case 'diamond':
			return { shape: 'path', d: 'M5 0 L10 5 L5 10 L0 5 Z', ...box };
		case 'oval':
			return { shape: 'circle', ...box };
		case 'stealth':
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 L3 5 Z', ...box };
		case 'arrow':
			// Open chevron ("<"), stroke-only: distinct from the solid 'triangle'
			// wedge below. No closing `Z`, so a binding rendering it with
			// `fill="none"` draws two open strokes rather than a filled shape.
			return { shape: 'path', d: 'M1 1 L9 5 L1 9', strokeOnly: true, ...box };
		// triangle / fallback
		default:
			return { shape: 'path', d: 'M0 0 L10 5 L0 10 Z', ...box };
	}
}

/** Normalise a raw arrow type value: coerce `"none"` / `undefined` to `undefined`. */
export function normalizeArrow(a: ConnectorArrowType | undefined): ConnectorArrowType | undefined {
	return a && a !== 'none' ? a : undefined;
}
