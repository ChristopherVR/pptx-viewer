import type { PressureCircle } from './ink-rendering';
import {
	extractPathPoints,
	generatePressureCircles,
	hasPressureVariation,
	pressuresToWidths,
} from './ink-rendering';
/**
 * The single per-stroke rendering decision shared by both freehand ink
 * representations this project has (a Draw-tab `InkPptxElement` and a loaded
 * `p:contentPart`'s `ContentPartInkStroke`): given one stroke's path, style,
 * and optional pressure/tilt data, decide whether it paints as a plain
 * constant-width path, pressure-sensitive circles, or tilt-driven calligraphic
 * nib marks.
 *
 * Lifted out of `content-part-strokes.ts` (which used to inline this exact
 * logic) when `ink-group-strokes.ts` needed the identical decision for
 * `InkPptxElement`; every binding's ink renderer had been hand-rolling its own
 * (subtly drifted) copy of the pressure-circle half of this already.
 *
 * @module render/ink-stroke-view
 */
import type { NibMark } from './ink-tilt-nib';
import { generateNibMarks } from './ink-tilt-nib';

/** Everything one stroke needs to decide its render mode. */
export interface InkStrokeViewInput {
	path: string;
	color: string;
	width: number;
	opacity: number;
	/** Per-point pressure (0-1); rendered as variable-width circles when it varies. */
	pressures?: number[];
	/**
	 * Legacy per-point WIDTH values (already in the same units as `width`, not
	 * a 0-1 pressure reading) for older authored data that predates the
	 * `pressures` channel. Used only when `pressures` itself has no usable
	 * variation.
	 */
	legacyPointWidths?: number[];
	/** Per-point pen-tilt lean direction (radians); pairs with `tiltMagnitudes`. */
	tiltAngles?: number[];
	/** Per-point pen-tilt lean strength (0 upright, 1 maximally leaned). */
	tiltMagnitudes?: number[];
}

/** One rendered stroke: a constant-width path, pressure circles, or tilt nib marks. */
export interface InkStrokeView {
	d: string;
	color: string;
	width: number;
	opacity: number;
	/** Per-point pressure circles; `null` renders the plain path. Mutually exclusive with `nibMarks`. */
	circles: PressureCircle[] | null;
	/**
	 * Per-point calligraphic nib marks, built from the stroke's tilt channels;
	 * `null` when the stroke declared no (or all-zero) tilt data, in which
	 * case `circles` (or the plain path) renders as before this feature
	 * existed.
	 */
	nibMarks: NibMark[] | null;
}

/** Circle/nib sizing envelope shared by every stroke: 0.5px minimum, 1.5x the base width at full pressure/lean. */
function strokeConfig(baseWidth: number) {
	return { baseWidth, minRadius: 0.5, maxRadius: baseWidth * 1.5 };
}

/** Per-point width samples for pressure/nib sizing, or a single flat entry when neither channel has variation. */
function pointWidthsFor(input: InkStrokeViewInput): number[] {
	const { pressures, legacyPointWidths, width } = input;
	if (pressures && pressures.length > 1 && hasPressureVariation(pressures)) {
		return pressuresToWidths(pressures, width);
	}
	if (
		legacyPointWidths &&
		legacyPointWidths.length > 1 &&
		hasPressureVariation(legacyPointWidths)
	) {
		return legacyPointWidths;
	}
	return [width];
}

/** Decide a stroke's render mode: plain path, pressure circles, or tilt nib marks. */
export function buildInkStrokeView(input: InkStrokeViewInput): InkStrokeView {
	const { path, color, width, opacity, tiltAngles, tiltMagnitudes } = input;
	const base = { d: path, color, width, opacity };

	// Tilt-driven calligraphic nib rendering takes priority when the stroke
	// declared tilt channels; it degrades to plain circles wherever tilt
	// magnitude is 0, so this is safe even for a stroke whose tilt barely
	// varies (or a mixed document where this particular stroke has none).
	if (tiltAngles && tiltAngles.length > 0) {
		const magnitudes = tiltMagnitudes ?? tiltAngles.map(() => 0.5);
		const nibMarks = generateNibMarks(
			extractPathPoints(path),
			pointWidthsFor(input),
			tiltAngles,
			magnitudes,
			strokeConfig(width),
		);
		return { ...base, circles: null, nibMarks };
	}

	const circles = pressureCirclesFor(input);
	return { ...base, circles, nibMarks: null };
}

/** Per-point pressure circles, or `null` when neither channel has usable variation. */
function pressureCirclesFor(input: InkStrokeViewInput): PressureCircle[] | null {
	const { pressures, legacyPointWidths, path, width } = input;
	if (pressures && pressures.length > 1 && hasPressureVariation(pressures)) {
		return generatePressureCircles(
			extractPathPoints(path),
			pressuresToWidths(pressures, width),
			strokeConfig(width),
		);
	}
	if (
		legacyPointWidths &&
		legacyPointWidths.length > 1 &&
		hasPressureVariation(legacyPointWidths)
	) {
		return generatePressureCircles(extractPathPoints(path), legacyPointWidths, strokeConfig(width));
	}
	return null;
}
