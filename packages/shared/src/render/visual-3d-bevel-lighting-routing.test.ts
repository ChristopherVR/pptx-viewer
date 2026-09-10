import { describe, expect, it } from 'vitest';

import { isRoutedToLegacyBevelShadow } from './visual-3d-bevel-lighting-routing';

describe('isRoutedToLegacyBevelShadow', () => {
	it('routes metal|circle (calibration could not beat the box-shadow baseline)', () => {
		expect(isRoutedToLegacyBevelShadow('metal', 'circle')).toBeTruthy();
	});

	it('does not route metal for other calibrated profiles', () => {
		expect(isRoutedToLegacyBevelShadow('metal', 'angle')).toBeFalsy();
		expect(isRoutedToLegacyBevelShadow('metal', 'hardEdge')).toBeFalsy();
		expect(isRoutedToLegacyBevelShadow('metal', 'softRound')).toBeFalsy();
	});

	it('does not route matte for any profile', () => {
		expect(isRoutedToLegacyBevelShadow('matte', 'circle')).toBeFalsy();
	});

	it('does not route an undefined material', () => {
		expect(isRoutedToLegacyBevelShadow(undefined, 'circle')).toBeFalsy();
	});
});
