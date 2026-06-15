/**
 * Connector routing helpers for the Vue viewer.
 *
 * Thin framework-agnostic wrappers around the core connector geometry engine.
 * Designed so this file can be extracted to `pptx-viewer-shared` later without
 * any Vue-specific entanglement.
 *
 * For connector path geometry (bent / curved / straight) we delegate directly
 * to the core's `getConnectorPathGeometry` — no re-implementation needed.
 * We add the compound-line helpers (parallel stroke offsets / widths) which
 * live in the React renderer today but are framework-agnostic.
 */

// Re-export core geometry so callers have one import point.
export { getConnectorPathGeometry, getConnectorAdjustment } from 'pptx-viewer-core';
export type { ConnectorPathGeometry } from 'pptx-viewer-core';

// ── Compound (double / triple) line helpers ──────────────────────────────────

/** OOXML compound line token type. */
export type CompoundLineType = 'sng' | 'dbl' | 'thickThin' | 'thinThick' | 'tri';

/**
 * Compute perpendicular offsets for compound (double/triple) line styles.
 * Returns an array of Y-axis offset distances from the centre line in px.
 * A single-line style returns `[0]`.
 *
 * @param compoundLine - OOXML `a:ln/@cmpd` value (e.g. `"dbl"`, `"tri"`).
 * @param strokeWidth  - The resolved stroke width in pixels.
 */
export function getCompoundLineOffsets(
	compoundLine: string | undefined,
	strokeWidth: number,
): number[] {
	if (!compoundLine || compoundLine === 'sng') {
		return [0];
	}
	const gap = Math.max(strokeWidth * 0.6, 1.5);
	if (compoundLine === 'dbl') {
		return [-gap, gap];
	}
	if (compoundLine === 'thickThin') {
		return [-gap * 0.6, gap];
	}
	if (compoundLine === 'thinThick') {
		return [-gap, gap * 0.6];
	}
	if (compoundLine === 'tri') {
		return [-gap, 0, gap];
	}
	return [0];
}

/**
 * Compute individual stroke widths for each parallel path in a compound line.
 * The array length matches the one returned by {@link getCompoundLineOffsets}.
 *
 * @param compoundLine - OOXML `a:ln/@cmpd` value.
 * @param strokeWidth  - The resolved stroke width in pixels.
 */
export function getCompoundLineWidths(
	compoundLine: string | undefined,
	strokeWidth: number,
): number[] {
	const base = Math.max(strokeWidth, 1);
	if (!compoundLine || compoundLine === 'sng') {
		return [base];
	}
	if (compoundLine === 'dbl') {
		return [base * 0.5, base * 0.5];
	}
	if (compoundLine === 'thickThin') {
		return [base * 0.7, base * 0.3];
	}
	if (compoundLine === 'thinThick') {
		return [base * 0.3, base * 0.7];
	}
	if (compoundLine === 'tri') {
		return [base * 0.3, base * 0.4, base * 0.3];
	}
	return [base];
}

/**
 * Determine whether a connector shapeType requires multi-segment (path)
 * rendering rather than a simple `<line>` element.
 *
 * @param shapeType - The `shapeType` string from the element (may be undefined).
 */
export function connectorNeedsPath(shapeType: string | undefined): boolean {
	if (!shapeType) {
		return false;
	}
	const t = shapeType.toLowerCase();
	return t.includes('bentconnector') || t.includes('curvedconnector');
}
