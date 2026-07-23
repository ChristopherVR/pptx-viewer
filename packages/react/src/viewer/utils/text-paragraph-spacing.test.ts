import type { TextStyle } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import { resolveParagraphSpacing } from './text-paragraph-spacing';

const base = {
	isFirst: false,
	isLast: false,
	spaceFirstLast: true,
};

describe('resolveParagraphSpacing', () => {
	it('applies per-paragraph before/after margins from paraProps', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.marginTop).toBe(12);
		expect(result.marginBottom).toBe(8);
	});

	it('falls back to body-level spacing when the paragraph has none', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: undefined,
			bodyStyle: { paragraphSpacingBefore: 5, paragraphSpacingAfter: 7 } as TextStyle,
		});
		expect(result.marginTop).toBe(5);
		expect(result.marginBottom).toBe(7);
	});

	it('prefers paragraph spacing over the body fallback', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 20 } as TextStyle,
			bodyStyle: { paragraphSpacingBefore: 5 } as TextStyle,
		});
		expect(result.marginTop).toBe(20);
	});

	it('maps a line-spacing multiplier to a unitless line-height', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacing: 1.5 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.lineHeight).toBe(1.5);
	});

	it('maps exact-pt line spacing to a px line-height', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacingExactPt: 18 } as TextStyle,
			bodyStyle: undefined,
		});
		// 18pt * 96/72 = 24px
		expect(result.lineHeight).toBe('24px');
	});

	it('uses the paragraph line-spacing unit without mixing body values', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { lineSpacing: 2 } as TextStyle,
			bodyStyle: { lineSpacingExactPt: 40 } as TextStyle,
		});
		expect(result.lineHeight).toBe(2);
	});

	it('suppresses first-paragraph top spacing when spaceFirstLast is false', () => {
		const result = resolveParagraphSpacing({
			...base,
			isFirst: true,
			spaceFirstLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.marginTop).toBeUndefined();
		expect(result.marginBottom).toBe(8);
	});

	it('suppresses last-paragraph bottom spacing when spaceFirstLast is false', () => {
		const result = resolveParagraphSpacing({
			...base,
			isLast: true,
			spaceFirstLast: false,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.marginTop).toBe(12);
		expect(result.marginBottom).toBeUndefined();
	});

	it('applies first/last edge spacing when spaceFirstLast is true', () => {
		const result = resolveParagraphSpacing({
			...base,
			isFirst: true,
			isLast: true,
			spaceFirstLast: true,
			paraProps: { paragraphSpacingBefore: 12, paragraphSpacingAfter: 8 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.marginTop).toBe(12);
		expect(result.marginBottom).toBe(8);
	});

	it('ignores zero / negative spacing values', () => {
		const result = resolveParagraphSpacing({
			...base,
			paraProps: { paragraphSpacingBefore: 0, paragraphSpacingAfter: -4 } as TextStyle,
			bodyStyle: undefined,
		});
		expect(result.marginTop).toBeUndefined();
		expect(result.marginBottom).toBeUndefined();
	});
});
