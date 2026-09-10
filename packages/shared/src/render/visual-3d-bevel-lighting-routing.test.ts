import { describe, expect, it } from 'vitest';

import { isRoutedToLegacyBevelShadow } from './visual-3d-bevel-lighting-routing';

describe('isRoutedToLegacyBevelShadow', () => {
	it('does not route metal|circle any more (the 2026-09 profile cross-section refit fixed it; see the module doc comment)', () => {
		expect(isRoutedToLegacyBevelShadow('metal', 'circle')).toBeFalsy();
	});

	it('does not route metal for any profile', () => {
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
