import { describe, expect, it } from 'vitest';

import { applyFontAlignmentFallback, fontAlignmentVerticalAlign } from './text-font-alignment';
import type { RunStyle } from './text-run-style';

describe('fontAlignmentVerticalAlign', () => {
	it('maps t/ctr/b to the corresponding vertical-align keyword', () => {
		expect(fontAlignmentVerticalAlign('t')).toBe('top');
		expect(fontAlignmentVerticalAlign('ctr')).toBe('middle');
		expect(fontAlignmentVerticalAlign('b')).toBe('bottom');
	});

	it('leaves auto/base/undefined undeclared (the browser baseline default)', () => {
		expect(fontAlignmentVerticalAlign('auto')).toBeUndefined();
		expect(fontAlignmentVerticalAlign('base')).toBeUndefined();
		expect(fontAlignmentVerticalAlign(undefined)).toBeUndefined();
	});
});

describe('applyFontAlignmentFallback', () => {
	it('sets vertical-align from fontAlgn when the run declares none of its own', () => {
		const style: RunStyle = {};
		applyFontAlignmentFallback(style, 't');
		expect(style.verticalAlign).toBe('top');
	});

	it('never overrides a run own super/subscript vertical-align', () => {
		const style: RunStyle = { verticalAlign: 'super' };
		applyFontAlignmentFallback(style, 'b');
		expect(style.verticalAlign).toBe('super');
	});

	it('is a no-op for auto/base/undefined', () => {
		const style: RunStyle = {};
		applyFontAlignmentFallback(style, 'auto');
		expect(style.verticalAlign).toBeUndefined();
	});
});
