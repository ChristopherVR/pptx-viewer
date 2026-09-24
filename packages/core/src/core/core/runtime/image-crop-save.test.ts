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

	it('omits @t/@b for a partial (left/right-only) authored crop', () => {
		// A source `<a:srcRect l="..." r="..."/>` with no `t`/`b` means the
		// top/bottom crop is 0%, exactly as a written `t="0"`/`b="0"` would.
		// Writing them anyway materialized two attributes the source never
		// had on every picture with a partial authored crop.
		const srcRect = buildSrcRectXml({ cropLeft: 0.1, cropRight: 0.1 });
		expect(srcRect?.['@_l']).toBeDefined();
		expect(srcRect?.['@_r']).toBeDefined();
		expect(srcRect?.['@_t']).toBeUndefined();
		expect(srcRect?.['@_b']).toBeUndefined();
	});

	it('omits @l/@r for a partial (top/bottom-only) authored crop', () => {
		const srcRect = buildSrcRectXml({ cropTop: 0.1, cropBottom: 0.1 });
		expect(srcRect?.['@_t']).toBeDefined();
		expect(srcRect?.['@_b']).toBeDefined();
		expect(srcRect?.['@_l']).toBeUndefined();
		expect(srcRect?.['@_r']).toBeUndefined();
	});
});
