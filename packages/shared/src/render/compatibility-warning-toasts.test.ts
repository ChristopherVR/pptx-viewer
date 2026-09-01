import { describe, expect, it } from 'vitest';

import { compatibilityWarningToasts } from './compatibility-warning-toasts';

describe('compatibilityWarningToasts', () => {
	it('maps a known code to its message key', () => {
		const toasts = compatibilityWarningToasts([
			{ code: 'SAVE_SIGNATURES_STRIPPED', severity: 'warning' },
		]);
		expect(toasts).toStrictEqual([
			{
				id: 'SAVE_SIGNATURES_STRIPPED',
				code: 'SAVE_SIGNATURES_STRIPPED',
				severity: 'warning',
				messageKey: 'pptx.compatibility.saveSignaturesStripped',
				params: undefined,
			},
		]);
	});

	it('maps EXTERNAL_IMAGE_REFERENCE', () => {
		const toasts = compatibilityWarningToasts([
			{ code: 'EXTERNAL_IMAGE_REFERENCE', severity: 'info' },
		]);
		expect(toasts[0].messageKey).toBe('pptx.compatibility.externalImageReference');
		expect(toasts[0].severity).toBe('info');
	});

	it('dedupes identical codes, keeping the first severity', () => {
		const toasts = compatibilityWarningToasts([
			{ code: 'SAVE_ELEMENT_SKIPPED', severity: 'warning', elementId: 'a' },
			{ code: 'SAVE_ELEMENT_SKIPPED', severity: 'info', elementId: 'b' },
			{ code: 'SAVE_ELEMENT_SKIPPED', severity: 'warning', elementId: 'c' },
		]);
		expect(toasts).toHaveLength(1);
		expect(toasts[0].severity).toBe('warning');
	});

	it('falls back to the generic key with a code param for an unknown code', () => {
		const toasts = compatibilityWarningToasts([{ code: 'SOME_FUTURE_CODE', severity: 'warning' }]);
		expect(toasts[0].messageKey).toBe('pptx.compatibility.generic');
		expect(toasts[0].params).toStrictEqual({ code: 'SOME_FUTURE_CODE' });
	});

	it('returns one toast per distinct code, preserving first-seen order', () => {
		const toasts = compatibilityWarningToasts([
			{ code: 'UNMODELLED_SLIDE_MARKUP', severity: 'info' },
			{ code: 'EXTERNAL_IMAGE_REFERENCE', severity: 'warning' },
			{ code: 'UNMODELLED_SLIDE_MARKUP', severity: 'info' },
		]);
		expect(toasts.map((t) => t.code)).toStrictEqual([
			'UNMODELLED_SLIDE_MARKUP',
			'EXTERNAL_IMAGE_REFERENCE',
		]);
	});

	it('returns an empty list for no warnings', () => {
		expect(compatibilityWarningToasts([])).toStrictEqual([]);
	});

	it('maps the lowercase-hyphen group-depth-exceeded code', () => {
		const toasts = compatibilityWarningToasts([
			{ code: 'group-depth-exceeded', severity: 'warning' },
		]);
		expect(toasts[0].messageKey).toBe('pptx.compatibility.groupDepthExceeded');
	});
});
