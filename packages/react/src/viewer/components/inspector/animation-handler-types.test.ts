import { describe, it, expect } from 'vitest';

import { DIRECTIONAL_PRESETS } from './animation-handler-types';

// ---------------------------------------------------------------------------
// DIRECTIONAL_PRESETS
// ---------------------------------------------------------------------------

describe('dIRECTIONAL_PRESETS', () => {
	it('is a Set', () => {
		expect(DIRECTIONAL_PRESETS).toBeInstanceOf(Set);
	});

	it('contains flyIn', () => {
		expect(DIRECTIONAL_PRESETS.has('flyIn')).toBeTruthy();
	});

	it('contains flyOut', () => {
		expect(DIRECTIONAL_PRESETS.has('flyOut')).toBeTruthy();
	});

	it('has exactly 2 entries', () => {
		expect(DIRECTIONAL_PRESETS.size).toBe(2);
	});

	it('does not contain non-directional presets', () => {
		expect(DIRECTIONAL_PRESETS.has('fadeIn')).toBeFalsy();
		expect(DIRECTIONAL_PRESETS.has('fadeOut')).toBeFalsy();
		expect(DIRECTIONAL_PRESETS.has('spin')).toBeFalsy();
		expect(DIRECTIONAL_PRESETS.has('zoomIn')).toBeFalsy();
	});
});
