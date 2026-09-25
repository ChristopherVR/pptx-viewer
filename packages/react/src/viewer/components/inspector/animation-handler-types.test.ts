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

	it('contains the broader directional presets from shared', () => {
		expect(DIRECTIONAL_PRESETS.has('wipeIn')).toBeTruthy();
		expect(DIRECTIONAL_PRESETS.has('wipeOut')).toBeTruthy();
		expect(DIRECTIONAL_PRESETS.has('peekIn')).toBeTruthy();
		expect(DIRECTIONAL_PRESETS.has('crawlIn')).toBeTruthy();
		expect(DIRECTIONAL_PRESETS.has('stretchIn')).toBeTruthy();
	});

	it('leaves out Float In, which PowerPoint saves with no direction variant', () => {
		expect(DIRECTIONAL_PRESETS.has('floatIn')).toBeFalsy();
	});

	it('does not contain non-directional presets', () => {
		expect(DIRECTIONAL_PRESETS.has('fadeIn')).toBeFalsy();
		expect(DIRECTIONAL_PRESETS.has('fadeOut')).toBeFalsy();
		expect(DIRECTIONAL_PRESETS.has('spin')).toBeFalsy();
		expect(DIRECTIONAL_PRESETS.has('zoomIn')).toBeFalsy();
	});
});
