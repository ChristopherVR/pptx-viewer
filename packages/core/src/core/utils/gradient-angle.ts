/**
 * OOXML gradient angle -> CSS gradient angle conversion.
 *
 * ECMA-376 Part 1 §20.1.8.41 (`a:lin/@ang`) measures the linear-gradient
 * vector clockwise from the positive x-axis (3 o'clock, y pointing down),
 * running from the FIRST gradient stop towards the last:
 *
 *   - `ang="0"`         -> left to right
 *   - `ang="5400000"`   -> top to bottom   (90 deg)
 *   - `ang="10800000"`  -> right to left   (180 deg)
 *
 * CSS `linear-gradient(<angle>, ...)` measures clockwise from "to top"
 * (12 o'clock):
 *
 *   - `0deg`   -> bottom to top
 *   - `90deg`  -> left to right
 *   - `180deg` -> top to bottom
 *
 * The two conventions sit a quarter turn apart, so an OOXML angle piped
 * straight into a CSS gradient string renders the fill rotated 90 degrees.
 * Every CSS gradient built from an authored `a:lin` angle must go through
 * {@link ooxmlGradientAngleToCssDegrees}.
 *
 * SVG/Canvas renderers do NOT use these helpers: their coordinate system
 * already matches OOXML (clockwise from +x with y down), so they consume
 * `fillGradientAngle` directly.
 */

/** Quarter-turn offset between the OOXML and CSS gradient angle origins. */
const OOXML_TO_CSS_OFFSET_DEG = 90;

/** Normalise a degree value into the [0, 360) range; non-finite input -> 0. */
function normalizeDegrees(deg: number): number {
	if (!Number.isFinite(deg)) {
		return 0;
	}
	return ((deg % 360) + 360) % 360;
}

/**
 * Convert an OOXML linear-gradient angle (in degrees, i.e. `a:lin/@ang` already
 * divided by 60000) to the equivalent CSS `linear-gradient()` angle in degrees,
 * normalised to [0, 360).
 */
export function ooxmlGradientAngleToCssDegrees(angleDegrees: number): number {
	return normalizeDegrees(angleDegrees + OOXML_TO_CSS_OFFSET_DEG);
}

/**
 * Inverse of {@link ooxmlGradientAngleToCssDegrees}: convert a CSS gradient
 * angle back to the OOXML convention, normalised to [0, 360).
 */
export function cssDegreesToOoxmlGradientAngle(cssDegrees: number): number {
	return normalizeDegrees(cssDegrees - OOXML_TO_CSS_OFFSET_DEG);
}
