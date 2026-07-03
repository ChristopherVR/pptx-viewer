/**
 * Pure connector line-style helpers shared across bindings.
 *
 * Compound (double/triple) parallel-stroke geometry and connector-family
 * classification. No framework imports. The actual SVG `<marker>` / `<path>`
 * emission stays in each binding's view layer.
 */

/** OOXML compound line token type (`a:ln/@cmpd`). */
export type CompoundLineType = 'sng' | 'dbl' | 'thickThin' | 'thinThick' | 'tri';

/**
 * Compute perpendicular offsets for compound (double/triple) line styles.
 * Returns an array of offset distances from the centre line in px. A single
 * line style returns `[0]`.
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
 * Map an OOXML line-cap token (`a:ln/@cap`) to its SVG `stroke-linecap` value.
 *
 * `flat` -> `butt`, `sq` -> `square`, `rnd` -> `round`. Anything absent or
 * unrecognised falls back to `round`, matching the viewer's historical default.
 */
export function svgLineCap(
	lineCap: 'flat' | 'rnd' | 'sq' | undefined,
): 'butt' | 'round' | 'square' {
	switch (lineCap) {
		case 'flat':
			return 'butt';
		case 'sq':
			return 'square';
		default:
			return 'round';
	}
}

/** Connector routing family, derived from the OOXML preset shape type. */
export type ConnectorKind = 'straight' | 'bent' | 'curved';

/**
 * Classify a connector by its OOXML preset shape type (case-insensitive):
 * `bentConnector*` → `"bent"`, `curvedConnector*` → `"curved"`, everything
 * else (incl. `straightConnector1`) → `"straight"`.
 */
export function connectorKind(shapeType: string | undefined): ConnectorKind {
	const t = (shapeType ?? '').toLowerCase();
	if (t.includes('bentconnector')) {
		return 'bent';
	}
	if (t.includes('curvedconnector')) {
		return 'curved';
	}
	return 'straight';
}

/**
 * Determine whether a connector `shapeType` requires multi-segment (path)
 * rendering rather than a simple `<line>` element.
 */
export function connectorNeedsPath(shapeType: string | undefined): boolean {
	return connectorKind(shapeType) !== 'straight';
}
