import { describe, it, expect } from 'vitest';

import { createBlankSlide, makeSlideId } from './slide-operations';

describe('makeSlideId', () => {
	it('produces a slide-<ts>-<rand> id by default', () => {
		expect(makeSlideId()).toMatch(/^slide-\d+-[0-9a-z]+$/u);
	});

	it('uses the supplied id generator verbatim when given', () => {
		expect(makeSlideId(() => 'custom-id')).toBe('custom-id');
	});

	it('produces distinct ids across calls', () => {
		const ids = new Set([makeSlideId(), makeSlideId(), makeSlideId(), makeSlideId()]);
		expect(ids.size).toBeGreaterThan(1);
	});
});

describe('createBlankSlide', () => {
	it('builds a minimal blank slide with the given number', () => {
		const s = createBlankSlide(3);
		expect(s.slideNumber).toBe(3);
		expect(s.rId).toBe('');
		expect(s.elements).toStrictEqual([]);
		expect(s.id).toMatch(/^slide-\d+-[0-9a-z]+$/u);
	});

	it('forwards a custom id generator', () => {
		const s = createBlankSlide(1, () => 'uuid-1');
		expect(s.id).toBe('uuid-1');
	});
});
