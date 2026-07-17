import { describe, it, expect } from 'vitest';

import { LOCALE_CATALOG } from './locale-catalog';

describe('locale catalog', () => {
	it('has unique codes', () => {
		const codes = LOCALE_CATALOG.map((entry) => entry.code);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it('lists English first', () => {
		expect(LOCALE_CATALOG[0]?.code).toBe('en');
	});

	it('every entry has non-empty label and nativeLabel', () => {
		for (const entry of LOCALE_CATALOG) {
			expect(entry.label.length).toBeGreaterThan(0);
			expect(entry.nativeLabel.length).toBeGreaterThan(0);
		}
	});
});
