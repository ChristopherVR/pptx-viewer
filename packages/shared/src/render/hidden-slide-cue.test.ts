import { describe, expect, it } from 'vitest';

import {
	HIDDEN_SLIDE_ATTRIBUTE,
	HIDDEN_SLIDE_LABEL_KEY,
	HIDDEN_SLIDE_SLASH_GRADIENT,
	hiddenSlideCue,
	hiddenSlideLabelId,
} from './hidden-slide-cue';

describe('hiddenSlideCue', () => {
	it('is inert for a visible slide so every attribute is omitted', () => {
		const cue = hiddenSlideCue(false, 'rail', 2);
		expect(cue.hidden).toBeFalsy();
		expect(cue.labelId).toBeUndefined();
		expect(cue.marker).toBeUndefined();
	});

	it('treats an absent flag as visible', () => {
		expect(hiddenSlideCue(undefined, 'rail', 0).hidden).toBeFalsy();
	});

	it('marks a hidden slide and points aria-describedby at its label', () => {
		const cue = hiddenSlideCue(true, 'rail', 2);
		expect(cue.hidden).toBeTruthy();
		expect(cue.marker).toBe('true');
		expect(cue.labelId).toBe('pptx-hidden-slide-rail-2');
	});

	it('keeps the rail and the sorter apart: both can be mounted at once', () => {
		expect(hiddenSlideLabelId('rail', 4)).not.toBe(hiddenSlideLabelId('sorter', 4));
	});

	it('exposes a neutral attribute usable as a bare CSS/locator selector', () => {
		expect(HIDDEN_SLIDE_ATTRIBUTE).toBe('data-pptx-slide-hidden');
	});

	it('reuses the sorter dictionary key rather than adding a per-surface string', () => {
		expect(HIDDEN_SLIDE_LABEL_KEY).toBe('pptx.slideSorter.hidden');
	});

	it('draws the slash in currentColor so it survives both chrome themes', () => {
		expect(HIDDEN_SLIDE_SLASH_GRADIENT).toContain('currentColor');
		expect(HIDDEN_SLIDE_SLASH_GRADIENT.startsWith('linear-gradient(')).toBeTruthy();
	});
});
