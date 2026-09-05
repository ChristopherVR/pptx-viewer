import { describe, expect, it } from 'vitest';

import {
	gradientStopColorCommitPatch,
	tableCellFillColorCommitPatch,
	tableCellTextColorCommitPatch,
} from './theme-color-field-commit';

const THEME_REF = { scheme: 'accent1' } as const;

describe('gradientStopColorCommitPatch', () => {
	it('carries both hex and ref through for a theme-swatch commit', () => {
		const patch = gradientStopColorCommitPatch({ hex: '#4472c4', ref: THEME_REF });
		expect(patch).toStrictEqual({ color: '#4472c4', colorRef: THEME_REF });
	});

	it('clears the ref for a custom-colour commit', () => {
		const patch = gradientStopColorCommitPatch({ hex: '#ff0000', ref: undefined });
		expect(patch.colorRef).toBeFalsy();
		expect(patch.color).toBe('#ff0000');
	});
});

describe('tableCellFillColorCommitPatch', () => {
	it('writes backgroundColor and backgroundColorRef for a theme-swatch commit', () => {
		const patch = tableCellFillColorCommitPatch({ hex: '#123456', ref: THEME_REF });
		expect(patch).toStrictEqual({ backgroundColor: '#123456', backgroundColorRef: THEME_REF });
	});

	it('clears backgroundColorRef for a custom-colour commit', () => {
		const patch = tableCellFillColorCommitPatch({ hex: '#123456', ref: undefined });
		expect(patch.backgroundColorRef).toBeFalsy();
	});
});

describe('tableCellTextColorCommitPatch', () => {
	it('writes color and colorRef for a theme-swatch commit', () => {
		const patch = tableCellTextColorCommitPatch({ hex: '#abcdef', ref: THEME_REF });
		expect(patch).toStrictEqual({ color: '#abcdef', colorRef: THEME_REF });
	});

	it('clears colorRef for a custom-colour commit', () => {
		const patch = tableCellTextColorCommitPatch({ hex: '#abcdef', ref: undefined });
		expect(patch.colorRef).toBeFalsy();
	});
});
