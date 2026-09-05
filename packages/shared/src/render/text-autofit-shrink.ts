/**
 * `a:normAutofit` ("Shrink text on overflow") editor-time recompute.
 *
 * ECMA-376 21.1.2.1.1 (`CT_TextNormalAutofit`) stores `fontScale` and
 * `lnSpcReduction` as PowerPoint's OWN pre-computed shrink-to-fit values, not
 * a formula the renderer evaluates: `text-style-helpers.ts`'s
 * `computeAutoFitTextStyle` applies whatever percentage is on disk verbatim.
 * That is correct for a deck nobody has edited since PowerPoint last saved it,
 * but the moment a user types into a `normAutofit` box in this editor, the
 * stored percentage is stale: PowerPoint recomputes it continuously as you
 * type (and grows it back toward 100% as you delete). Contrast with
 * `a:spAutoFit`, which resizes the SHAPE instead and already gets live
 * remeasurement via `shape-autofit-resize.ts`; this module is `normAutofit`'s
 * equivalent for the font-shrink side.
 *
 * Two pieces, split the same way `shape-autofit-resize.ts` splits its own:
 * - {@link computeNormAutofitShrink}: the pure decision (this module). Takes
 *   plain numbers and a measurement CALLBACK rather than touching the DOM
 *   itself, so it is unit-testable with a fake measurer and identical across
 *   all five bindings.
 * - `measureNormAutofitStepHeightPx` (`text-autofit-shrink-measure.ts`): the
 *   one DOM-touching implementation of that callback, shared for the same
 *   reason `measureAutoFitContentHeightPx` is.
 *
 * PowerPoint's own shrink staircase (fontScale / lnSpcReduction pairs) is not
 * a formula either: it is a fixed table PowerPoint steps through, trying each
 * one in order until the text fits. The values below are the commonly
 * documented reverse-engineered table (the same one the audit that opened
 * this gap cites: "PowerPoint steps roughly 100/92/84/76/...% with
 * lnSpcReduction kicking in after a few steps"). A COM probe was attempted
 * (see the implementation report) but proved inconclusive: `Presentation.
 * SaveAs` from an unrendered automation window never triggers PowerPoint's
 * layout pass, so the serialized `fontScale`/`lnSpcReduction` stayed absent
 * even for grossly overflowing text; reading `TextRange.Font.Size` from a
 * visible, selected shape DID shrink as text grew, but the read-back point
 * sizes did not resolve to clean percentages of any single base size,  so
 * they were not trustworthy as ground truth either. This table is therefore
 * the audit's documented value, not a freshly COM-verified one.
 */
import type { TextStyle } from 'pptx-viewer-core';

/** One (fontScale, lnSpcReduction) rung of PowerPoint's shrink staircase. */
export interface NormAutofitStep {
	/** Fraction 0..1: matches {@link TextStyle.autoFitFontScale}'s convention (1 = 100%, unscaled). */
	fontScale: number;
	/** Fraction 0..1: matches {@link TextStyle.autoFitLineSpacingReduction}'s convention. */
	lnSpcReduction: number;
}

/**
 * PowerPoint's `a:normAutofit` shrink staircase, largest (unscaled) first.
 *
 * `fontScale` steps down in roughly-8-point increments to a 25% floor;
 * `lnSpcReduction` stays 0 for the first few steps, then holds at 10%, then
 * 20% for the remainder. {@link computeNormAutofitShrink} always searches from
 * the top, which is also what makes the "grow back on deletion" requirement
 * fall out for free: a shorter document just finds a fit at an earlier rung.
 */
export const NORM_AUTOFIT_STEPS: readonly NormAutofitStep[] = [
	{ fontScale: 1.0, lnSpcReduction: 0 },
	{ fontScale: 0.92, lnSpcReduction: 0 },
	{ fontScale: 0.84, lnSpcReduction: 0 },
	{ fontScale: 0.76, lnSpcReduction: 0 },
	{ fontScale: 0.7, lnSpcReduction: 0.1 },
	{ fontScale: 0.66, lnSpcReduction: 0.1 },
	{ fontScale: 0.6, lnSpcReduction: 0.2 },
	{ fontScale: 0.54, lnSpcReduction: 0.2 },
	{ fontScale: 0.5, lnSpcReduction: 0.2 },
	{ fontScale: 0.46, lnSpcReduction: 0.2 },
	{ fontScale: 0.42, lnSpcReduction: 0.2 },
	{ fontScale: 0.38, lnSpcReduction: 0.2 },
	{ fontScale: 0.34, lnSpcReduction: 0.2 },
	{ fontScale: 0.3, lnSpcReduction: 0.2 },
	{ fontScale: 0.25, lnSpcReduction: 0.2 },
];

/** Sub-percent noise (font hinting, rounding) should not dirty the document. */
const SCALE_EPSILON = 0.001;

/** Input to {@link computeNormAutofitShrink}. */
export interface NormAutofitShrinkInput {
	/** `a:bodyPr` autofit mode; only `'normal'` (`a:normAutofit`) shrinks the text. */
	autoFitMode: TextStyle['autoFitMode'] | undefined;
	/** The element's currently stored `autoFitFontScale`, or `undefined` for unscaled (1). */
	currentFontScale: number | undefined;
	/** The element's currently stored `autoFitLineSpacingReduction`, or `undefined` for none (0). */
	currentLnSpcReduction: number | undefined;
	/**
	 * Measures the rendered content height (px, the shape's whole box including
	 * insets, the same convention `measuredContentHeightPx` uses in
	 * `shape-autofit-resize.ts`) if the body were painted at `step`. Returning
	 * `0` (or any non-positive number) for every step means "no usable
	 * measurement", and the function returns `'unchanged'` without picking a
	 * rung.
	 */
	measureAtStep: (step: NormAutofitStep) => number;
	/** The shape's fixed box height (px). `normAutofit` never resizes the shape itself. */
	boxHeightPx: number;
}

/** The resolved shrink state, or `'unchanged'` when nothing needs to be written back. */
export type NormAutofitShrinkResult = NormAutofitStep | 'unchanged';

/**
 * Decide the `normAutofit` `fontScale`/`lnSpcReduction` pair that makes the
 * current text fit `boxHeightPx`, re-deriving from scratch (always searching
 * from 100%) so a user who deletes text grows the scale back exactly as
 * PowerPoint does.
 *
 * Pure: takes plain numbers and a measurement callback, so it is trivially
 * the same across all five bindings and unit-testable without a DOM.
 */
export function computeNormAutofitShrink(input: NormAutofitShrinkInput): NormAutofitShrinkResult {
	if (input.autoFitMode !== 'normal') {
		return 'unchanged';
	}
	if (!(input.boxHeightPx > 0)) {
		return 'unchanged';
	}

	let chosen: NormAutofitStep | undefined;
	for (const step of NORM_AUTOFIT_STEPS) {
		const measured = input.measureAtStep(step);
		if (!(measured > 0)) {
			// No usable measurement at all (e.g. no DOM node): bail without
			// picking a rung rather than silently shrinking to the floor.
			return 'unchanged';
		}
		if (measured <= input.boxHeightPx) {
			chosen = step;
			break;
		}
	}
	// Every rung, even the 25% floor, still overflows: PowerPoint keeps the
	// floor rather than shrinking further.
	if (!chosen) {
		chosen = NORM_AUTOFIT_STEPS[NORM_AUTOFIT_STEPS.length - 1];
	}

	const currentScale = input.currentFontScale ?? 1;
	const currentReduction = input.currentLnSpcReduction ?? 0;
	if (
		Math.abs(chosen.fontScale - currentScale) < SCALE_EPSILON &&
		Math.abs(chosen.lnSpcReduction - currentReduction) < SCALE_EPSILON
	) {
		return 'unchanged';
	}
	return chosen;
}
