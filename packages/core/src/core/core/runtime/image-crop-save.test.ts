import { describe, it, expect } from 'vitest';

import { buildSrcRectXml, clampCropForSave } from './image-crop-save';

describe('clampCropForSave', () => {
	it('preserves a negative outward-crop inset instead of clamping to 0 (issue G2)', () => {
		expect(clampCropForSave(-0.5)).toBe(-0.5);
	});

	it('clamps the magnitude while preserving sign', () => {
		expect(clampCropForSave(1)).toBe(0.95);
		expect(clampCropForSave(-1)).toBe(-0.95);
	});

	it('returns 0 for non-finite input', () => {
		expect(clampCropForSave(NaN)).toBe(0);
		expect(clampCropForSave(undefined)).toBe(0);
	});
});

describe('buildSrcRectXml (issue G2)', () => {
	it('returns undefined when there is no crop', () => {
		expect(buildSrcRectXml({})).toBeUndefined();
		expect(
			buildSrcRectXml({ cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0 }),
		).toBeUndefined();
	});

	it('writes a negative inset instead of dropping it', () => {
		const srcRect = buildSrcRectXml({ cropLeft: -0.2 });
		expect(srcRect?.['@_l']).toBe(String(Math.round(-0.2 * 100000)));
	});

	it('keeps both edges when a negative and positive inset on the same axis cancel out', () => {
		const srcRect = buildSrcRectXml({ cropLeft: -0.2, cropRight: 0.2 });
		expect(srcRect?.['@_l']).toBe(String(Math.round(-0.2 * 100000)));
		expect(srcRect?.['@_r']).toBe(String(Math.round(0.2 * 100000)));
	});

	it('rescales a horizontal crop approaching 100% to leave a 1% sliver', () => {
		const srcRect = buildSrcRectXml({ cropLeft: 0.5, cropRight: 0.5 });
		const expectedLeft = Math.round(clampCropForSave(0.5 * 0.99) * 100000);
		expect(srcRect?.['@_l']).toBe(String(expectedLeft));
	});
});
