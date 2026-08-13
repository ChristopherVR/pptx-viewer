import {
	DEFAULT_RIBBON_TRANSITION_DURATION_SEC,
	RIBBON_TRANSITION_PRESETS,
} from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { DEFAULT_TRANSITION_DURATION_SEC, TRANSITION_PRESETS } from './transition-presets';

describe('transitionPresets', () => {
	it('is the shared gallery itself, not a hand-copied twin of it', () => {
		expect(TRANSITION_PRESETS).toBe(RIBBON_TRANSITION_PRESETS);
		expect(DEFAULT_TRANSITION_DURATION_SEC).toBe(DEFAULT_RIBBON_TRANSITION_DURATION_SEC);
	});

	it('starts with none and every entry has a matching pptx.ribbon.transition.* label key', () => {
		expect(TRANSITION_PRESETS[0].type).toBe('none');
		for (const preset of TRANSITION_PRESETS) {
			expect(preset.labelKey).toBe(`pptx.ribbon.transition.${preset.type}`);
		}
	});

	it('lists each preset type exactly once', () => {
		const types = TRANSITION_PRESETS.map((p) => p.type);
		expect(new Set(types).size).toBe(types.length);
	});

	it('defaults the duration field to 0.7s', () => {
		expect(DEFAULT_TRANSITION_DURATION_SEC).toBe(0.7);
	});
});
