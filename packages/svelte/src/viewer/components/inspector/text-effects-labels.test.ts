import { describe, expect, it } from 'vitest';

import { bevelPresetLabel, materialPresetLabel, warpPresetLabel } from './text-effects-labels';

describe('text-effects labels', () => {
	it('bridges the panel short warp value onto the text-prefixed catalogue', () => {
		expect(warpPresetLabel('archUp')).toBe('Arch Up');
		expect(warpPresetLabel('wave1')).toBe('Wave 1');
		expect(warpPresetLabel('fadeRight')).toBe('Fade Right');
		expect(warpPresetLabel('triangle')).toBe('Triangle');
	});

	it('labels the 3D material and bevel presets', () => {
		expect(materialPresetLabel('warmMatte')).toBe('Warm Matte');
		expect(materialPresetLabel('softEdge')).toBe('Soft Edge');
		expect(bevelPresetLabel('relaxedInset')).toBe('Relaxed Inset');
		expect(bevelPresetLabel('coolSlant')).toBe('Cool Slant');
	});

	it('falls back to the raw token rather than blanking an unknown preset', () => {
		// A deck may carry a value newer than the catalogue; an empty option
		// would read as a broken control instead of an untranslated one.
		expect(warpPresetLabel('somethingNew')).toBe('somethingNew');
		expect(materialPresetLabel('somethingNew')).toBe('somethingNew');
		expect(bevelPresetLabel('somethingNew')).toBe('somethingNew');
	});
});
