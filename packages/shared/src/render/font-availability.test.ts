import { describe, expect, it, vi } from 'vitest';

import type { FontAvailabilitySource } from './font-availability';
import { isFontFamilyAvailable, scanAvailableFontFamilies } from './font-availability';

describe('font availability', () => {
	it('checks a safely quoted CSS font family', () => {
		const check = vi.fn(() => true);
		const source: FontAvailabilitySource = { ready: Promise.resolve(), check };
		expect(isFontFamilyAvailable('Aptos "Display"', source)).toBeTruthy();
		expect(check).toHaveBeenCalledWith('12px "Aptos \\"Display\\""');
	});

	it('returns only available families after the font set is ready', async () => {
		const source: FontAvailabilitySource = {
			ready: Promise.resolve(),
			check: (font) => font.includes('Aptos'),
		};
		expect([...(await scanAvailableFontFamilies(['Aptos', 'Missing'], source))]).toStrictEqual([
			'Aptos',
		]);
	});

	it('fails closed when font APIs throw or are unavailable', async () => {
		const source: FontAvailabilitySource = {
			ready: Promise.reject(new Error('unavailable')),
			check: () => {
				throw new Error('unavailable');
			},
		};
		expect(isFontFamilyAvailable('Aptos', source)).toBeFalsy();
		await expect(scanAvailableFontFamilies(['Aptos'], source)).resolves.toStrictEqual(new Set());
		expect(isFontFamilyAvailable('Aptos', undefined)).toBeFalsy();
	});
});
