import { describe, expect, it } from 'vitest';

import { resolveGenerationGapRatio } from './smartart-hierarchy-generation-gap';

describe('resolveGenerationGapRatio', () => {
	it('reads a stacking-axis `sp` fact directly when no composite wrapper is given (pre-existing, unconverted behaviour)', () => {
		const constraints = [{ type: 'sp', referenceType: 'h', factor: 0.25 }];
		expect(resolveGenerationGapRatio(constraints, 'h', 0.635)).toBeCloseTo(0.25, 6);
	});

	it('converts a cross-axis `sp` fact via the aspect ratio (organization-chart shape, unchanged by the composite correction)', () => {
		const constraints = [{ type: 'sp', referenceType: 'w', factor: 0.21 }];
		// gap_stacking = declaredFact / aspectRatio.
		expect(resolveGenerationGapRatio(constraints, 'h', 0.635)).toBeCloseTo(0.21 / 0.635, 6);
	});

	it('falls back to the default 0.25 when no `sp` constraint is declared at all', () => {
		expect(resolveGenerationGapRatio([], 'h', 0.635)).toBeCloseTo(0.25, 6);
	});

	it("session 10: corrects a composite-wrapped stacking-axis `sp` fact - `hierarchy--{flat3,hier5,hier8}.pptx`'s own declared 0.25/0.667/0.9/0.635 reproduces their measured 0.4580 row-to-row gap ratio (raw `dsp:sp` offsets, not the old solve-to-fill quantity) to within 0.35%", () => {
		const constraints = [{ type: 'sp', referenceType: 'h', factor: 0.25 }];
		const compositeChild = { aspectRatio: 0.635, widthFactor: 0.9, offsetXRatio: 0.1 };
		const ratio = resolveGenerationGapRatio(constraints, 'h', 0.635, compositeChild, 0.667);
		expect(ratio).toBeCloseTo(0.4596, 3);
		expect(Math.abs(ratio - 0.458) / 0.458).toBeLessThan(0.0035);
	});

	it('does not apply the composite correction when `compositeAspect` is missing (defensive: never divides by an unresolved value)', () => {
		const constraints = [{ type: 'sp', referenceType: 'h', factor: 0.25 }];
		const compositeChild = { aspectRatio: 0.635, widthFactor: 0.9, offsetXRatio: 0.1 };
		expect(resolveGenerationGapRatio(constraints, 'h', 0.635, compositeChild)).toBeCloseTo(0.25, 6);
	});

	it('does not apply the composite correction when `compositeChild.widthFactor` is 0 (defensive: never divides by zero)', () => {
		const constraints = [{ type: 'sp', referenceType: 'h', factor: 0.25 }];
		const compositeChild = { aspectRatio: 0.635, widthFactor: 0, offsetXRatio: 0.1 };
		expect(resolveGenerationGapRatio(constraints, 'h', 0.635, compositeChild, 0.667)).toBeCloseTo(
			0.25,
			6,
		);
	});
});
