/**
 * Pen-tilt calligraphic nib rendering.
 *
 * A stylus or digitizer pen can report its tilt (how far it leans off
 * perpendicular, and which way) alongside position and pressure. This module
 * turns that per-point tilt data into "nib marks": ellipses widened
 * perpendicular to the pen's lean direction, approximating the look of a
 * chisel-tip calligraphy pen. It is the tilt counterpart of the plain
 * pressure-circle rendering in `./ink-rendering`.
 *
 * Framework-agnostic: only depends on `./ink-rendering`'s point/width types,
 * so every binding (React, Vue, Angular, Svelte, Vanilla) consumes one copy.
 *
 * @module ink-tilt-nib
 */
import type { PathPoint, PressureConfig } from './ink-rendering';
import { interpolateWidth } from './ink-rendering';

/**
 * Configuration for tilt-driven "nib" rendering, extending {@link PressureConfig}
 * with how strongly tilt magnitude elongates the nib's wide axis.
 */
export interface NibMarkConfig extends PressureConfig {
	/**
	 * How strongly tilt magnitude widens the perpendicular axis relative to
	 * the base radius (0 disables elongation, 1 doubles it at full lean).
	 * Default 0.6, chosen to be a visible but subtle chisel-nib look.
	 */
	elongation?: number;
}

/**
 * One calligraphic nib mark: an ellipse whose wide axis sits perpendicular to
 * the pen's tilt-lean direction at that point, approximating a chisel-tip
 * nib. Degrades to a circle (`rPerp === rTilt`) wherever tilt magnitude is 0.
 */
export interface NibMark {
	cx: number;
	cy: number;
	/** Radius along the tilt-lean direction (the nib's narrow axis). */
	rTilt: number;
	/** Radius perpendicular to the tilt-lean direction (the nib's wide axis). */
	rPerp: number;
	/**
	 * Rotation, in degrees, to apply to an SVG `<ellipse rx={rPerp} ry={rTilt}>`
	 * (e.g. via `transform="rotate(rotationDeg cx cy)"`) so its wide axis
	 * points perpendicular to the lean direction.
	 */
	rotationDeg: number;
}

/**
 * Interpolate an angle (radians) at normalised position `t`, taking the
 * shortest angular path between samples so a wraparound near +-pi does not
 * spin the interpolated value the long way around.
 */
function interpolateAngle(angles: number[], t: number): number {
	if (angles.length === 0) {
		return 0;
	}
	if (angles.length === 1) {
		return angles[0];
	}
	const clampedT = Math.max(0, Math.min(1, t));
	const index = clampedT * (angles.length - 1);
	const lower = Math.floor(index);
	const upper = Math.min(lower + 1, angles.length - 1);
	const frac = index - lower;
	const diff = angles[upper] - angles[lower];
	// Wrap the raw difference into (-pi, pi] so interpolating across the +-pi
	// seam takes the short way around instead of spinning through 0. `%` in
	// JS keeps the sign of its left operand, so the textbook
	// `((diff + PI) % TAU) - PI` formula silently fails to wrap a negative
	// `diff` whose magnitude is already below `TAU`; round-trip through
	// `Math.round` instead, which is sign-agnostic.
	const wrapped = diff - 2 * Math.PI * Math.round(diff / (2 * Math.PI));
	return angles[lower] + wrapped * frac;
}

/**
 * Generate calligraphic nib marks for a set of path points, given per-point
 * (or interpolated) width, tilt-lean angle and tilt-lean magnitude data.
 *
 * This is the tilt counterpart of `generatePressureCircles`: instead of a
 * plain circle, each point becomes an ellipse widened perpendicular to the
 * pen's lean direction, the way a chisel-tip pen's mark widens depending on
 * which way it is held. A point with zero tilt magnitude renders as a plain
 * circle (`rPerp === rTilt`), so a stroke with a flat/upright tilt channel is
 * visually indistinguishable from the existing pressure-circle rendering.
 */
export function generateNibMarks(
	points: PathPoint[],
	widths: number[],
	tiltAngles: number[],
	tiltMagnitudes: number[],
	config: NibMarkConfig,
): NibMark[] {
	if (points.length === 0 || tiltAngles.length === 0) {
		return [];
	}
	const minR = config.minRadius ?? 0.5;
	const maxR = config.maxRadius ?? config.baseWidth;
	const elongation = config.elongation ?? 0.6;
	return points.map((pt, i) => {
		const t = points.length === 1 ? 0.5 : i / (points.length - 1);
		const w = interpolateWidth(widths, t);
		const ratio = config.baseWidth > 0 ? w / config.baseWidth : 1;
		const rTilt = Math.max(minR, Math.min(maxR, (config.baseWidth / 2) * ratio));
		const angle = interpolateAngle(tiltAngles, t);
		const magnitude = Math.max(0, Math.min(1, interpolateWidth(tiltMagnitudes, t)));
		const rPerp = rTilt * (1 + elongation * magnitude);
		// The wide (perpendicular) axis sits 90 degrees off the lean direction.
		const rotationDeg = (angle * 180) / Math.PI + 90;
		return { cx: pt.x, cy: pt.y, rTilt, rPerp, rotationDeg };
	});
}
