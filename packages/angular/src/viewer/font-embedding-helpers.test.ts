/**
 * font-embedding-helpers.test.ts: Unit tests for the font-availability probing
 * split out of the font-embedding panel. The DOM font API is unreliable across
 * test environments, so these assert type / robustness contracts rather than a
 * specific availability result.
 */

import { describe, expect, it } from 'vitest';

import { checkFontAvailable, scanAvailableFonts } from './font-embedding-helpers';

describe('checkFontAvailable', () => {
	it('returns a boolean and never throws', () => {
		expect(checkFontAvailable('Arial')).toBeTypeOf('boolean');
		expect(() => checkFontAvailable('')).not.toThrow();
	});
});

describe('scanAvailableFonts', () => {
	it('resolves to a Set for an empty family list', async () => {
		const result = await scanAvailableFonts([]);
		expect(result).toBeInstanceOf(Set);
		expect(result.size).toBe(0);
	});

	it('only ever reports families that were asked about', async () => {
		const families = ['Arial', 'Calibri', 'Nonexistent Font XYZ'];
		const result = await scanAvailableFonts(families);
		expect(result).toBeInstanceOf(Set);
		for (const family of result) {
			expect(families).toContain(family);
		}
	});
});
