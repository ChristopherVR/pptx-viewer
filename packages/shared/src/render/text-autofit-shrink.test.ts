import { describe, expect, it } from 'vitest';

import { computeNormAutofitShrink, NORM_AUTOFIT_STEPS } from './text-autofit-shrink';
import type { NormAutofitStep } from './text-autofit-shrink';

/** Fake measurer: content height grows linearly with fontScale (more text per
 * line at a smaller scale means less height), and shrinks further under
 * lnSpcReduction. `baseHeightAt100` is the height at the unscaled 100% rung. */
function linearMeasurer(baseHeightAt100: number) {
	return (step: NormAutofitStep): number =>
		baseHeightAt100 * step.fontScale * (1 - step.lnSpcReduction * 0.5);
}

describe('computeNormAutofitShrink', () => {
	it('returns unchanged for spAutoFit (shape-resize mode), never touching the font', () => {
		const result = computeNormAutofitShrink({
			autoFitMode: 'shrink',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 50,
			measureAtStep: linearMeasurer(500),
		});
		expect(result).toBe('unchanged');
	});

	it('returns unchanged for noAutofit / undefined mode', () => {
		expect(
			computeNormAutofitShrink({
				autoFitMode: 'none',
				currentFontScale: undefined,
				currentLnSpcReduction: undefined,
				boxHeightPx: 50,
				measureAtStep: linearMeasurer(500),
			}),
		).toBe('unchanged');
		expect(
			computeNormAutofitShrink({
				autoFitMode: undefined,
				currentFontScale: undefined,
				currentLnSpcReduction: undefined,
				boxHeightPx: 50,
				measureAtStep: linearMeasurer(500),
			}),
		).toBe('unchanged');
	});

	it('returns unchanged when the text already fits at 100%', () => {
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 200,
			measureAtStep: linearMeasurer(100),
		});
		expect(result).toBe('unchanged');
	});

	it('picks the first (largest) rung whose measured height fits the box', () => {
		// At 100% the linear measurer reports 100 * 0.92 = 92, which is <= 95,
		// so the 92% rung (the second step) is chosen, not a smaller one.
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 95,
			measureAtStep: linearMeasurer(100),
		});
		expect(result).toStrictEqual({ fontScale: 0.92, lnSpcReduction: 0 });
	});

	it('reaches a rung with lnSpcReduction > 0 when the plain font-only rungs are not enough', () => {
		// At base 1000: the 0.76/0 rung measures 760 (too tall for 650), but the
		// 0.7/0.1 rung's spacing credit is not quite enough (665, still over
		// 650), so PowerPoint's table lands on 0.66/0.1 (627, fits).
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 650,
			measureAtStep: linearMeasurer(1000),
		});
		expect(result).toStrictEqual({ fontScale: 0.66, lnSpcReduction: 0.1 });
	});

	it('keeps the 25% floor when even the smallest rung still overflows', () => {
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 1,
			measureAtStep: linearMeasurer(100000),
		});
		expect(result).toStrictEqual(NORM_AUTOFIT_STEPS[NORM_AUTOFIT_STEPS.length - 1]);
	});

	it('grows back toward 100% when text is deleted (re-derives from scratch, not from the stored scale)', () => {
		// Currently shrunk to 60%/20% (as if a longer draft had been typed
		// earlier), but the box now easily fits the (shorter) text at 100%.
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: 0.6,
			currentLnSpcReduction: 0.2,
			boxHeightPx: 200,
			measureAtStep: linearMeasurer(100),
		});
		expect(result).toStrictEqual({ fontScale: 1, lnSpcReduction: 0 });
	});

	it('returns unchanged when the chosen rung matches the currently stored scale', () => {
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: 0.92,
			currentLnSpcReduction: 0,
			boxHeightPx: 95,
			measureAtStep: linearMeasurer(100),
		});
		expect(result).toBe('unchanged');
	});

	it('returns unchanged (never picks the floor) when the measurer has no usable reading', () => {
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 100,
			measureAtStep: () => 0,
		});
		expect(result).toBe('unchanged');
	});

	it('returns unchanged for a non-positive box height', () => {
		const result = computeNormAutofitShrink({
			autoFitMode: 'normal',
			currentFontScale: undefined,
			currentLnSpcReduction: undefined,
			boxHeightPx: 0,
			measureAtStep: linearMeasurer(100),
		});
		expect(result).toBe('unchanged');
	});
});
