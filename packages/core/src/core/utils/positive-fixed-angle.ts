/**
 * `ST_PositiveFixedAngle` helpers (ECMA-376 Part 1 S20.1.10.53).
 *
 * Every OOXML effect angle attribute (`a:outerShdw/@dir`, `a:innerShdw/@dir`,
 * `a:prstShdw/@dir`, `a:reflection/@dir`, ...) is typed
 * `ST_PositiveFixedAngle`: a value in 60000ths of a degree constrained to
 * `0 <= v < 21600000`. A NEGATIVE value is not "the same angle measured the
 * other way", it is schema-invalid, and PowerPoint rejects the entire package
 * (the file-repair dialog, or a flat refusal to open) rather than clamping it.
 *
 * The trap is that the natural way to derive a shadow direction from a shadow
 * offset is `Math.atan2(offsetY, offsetX)`, whose range is `(-pi, pi]`. Half of
 * the unit circle - every direction in the lower half plane, e.g. a
 * conventional 225 degree "up and to the left" drop shadow - therefore comes
 * back negative and, written out unmodified, poisons the document. Angles that
 * reach the model from a UI control (a spinner, a drag handle) can be out of
 * range in the same way, and by more than one turn.
 *
 * Serializers must route every such attribute through
 * {@link positiveFixedAngleAttribute}, or at minimum normalise the degree value
 * with {@link normalizePositiveFixedAngleDegrees} first.
 */

/** Attribute units: OOXML angles are expressed in 60000ths of a degree. */
const UNITS_PER_DEGREE = 60000;

/**
 * Fold an arbitrary degree value into the `[0, 360)` range that
 * `ST_PositiveFixedAngle` permits. Non-finite input degrades to `0` rather than
 * emitting `NaN` into the document.
 */
export function normalizePositiveFixedAngleDegrees(degrees: number): number {
	if (!Number.isFinite(degrees)) {
		return 0;
	}
	return ((degrees % 360) + 360) % 360;
}

/**
 * Serialize a degree value as a schema-valid `ST_PositiveFixedAngle` attribute
 * string (60000ths of a degree, normalised into `[0, 21600000)`).
 */
export function positiveFixedAngleAttribute(degrees: number): string {
	const normalized = normalizePositiveFixedAngleDegrees(degrees);
	// Rounding 359.999... degrees must not land on a full turn, which is out of
	// range by exactly one unit.
	const units = Math.round(normalized * UNITS_PER_DEGREE) % (360 * UNITS_PER_DEGREE);
	return String(units);
}

/**
 * Convert a shadow offset (in px, y pointing down) into the OOXML pair of
 * distance (px) and direction (degrees, normalised into `[0, 360)`).
 *
 * Callers scale `distance` by the EMU-per-px constant themselves; the direction
 * is unit-free and ready for {@link positiveFixedAngleAttribute}.
 */
export function shadowOffsetToDistanceAndDirection(
	offsetX: number,
	offsetY: number,
): { distance: number; directionDegrees: number } {
	const x = Number.isFinite(offsetX) ? offsetX : 0;
	const y = Number.isFinite(offsetY) ? offsetY : 0;
	return {
		distance: Math.sqrt(x * x + y * y),
		directionDegrees: normalizePositiveFixedAngleDegrees((Math.atan2(y, x) * 180) / Math.PI),
	};
}
