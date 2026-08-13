import { describe, expect, it } from 'vitest';

import {
	SLIDE_SHOW_OPTIONS,
	readSlideShowOption,
	slideShowOptionChange,
} from './ribbon-slide-show-options';

describe('slideShowOptions catalogue', () => {
	it('declares the two options nothing backs, rather than shipping them silently inert', () => {
		expect(
			SLIDE_SHOW_OPTIONS.filter((option) => option.unsupported).map((option) => option.id),
		).toStrictEqual(['keepUpdated', 'mediaControls']);
	});
});

describe('readSlideShowOption', () => {
	it('defaults both supported options ON, matching PowerPoint', () => {
		expect(readSlideShowOption(undefined, 'useTimings')).toBeTruthy();
		expect(readSlideShowOption({}, 'playNarrations')).toBeTruthy();
	});

	it('reflects what the deck actually says', () => {
		expect(readSlideShowOption({ advanceMode: 'manual' }, 'useTimings')).toBeFalsy();
		expect(readSlideShowOption({ showWithNarration: false }, 'playNarrations')).toBeFalsy();
	});

	it('reads unsupported options as off', () => {
		expect(readSlideShowOption({}, 'keepUpdated')).toBeFalsy();
		expect(readSlideShowOption({}, 'mediaControls')).toBeFalsy();
	});
});

describe('slideShowOptionChange', () => {
	it('maps Use Timings onto the advance mode the playback path reads', () => {
		expect(slideShowOptionChange('useTimings', false)).toStrictEqual({ advanceMode: 'manual' });
		expect(slideShowOptionChange('useTimings', true)).toStrictEqual({ advanceMode: 'useTimings' });
	});

	it('maps Play Narrations onto p:showPr/@showNarration', () => {
		expect(slideShowOptionChange('playNarrations', false)).toStrictEqual({
			showWithNarration: false,
		});
	});

	it('has no change to commit for an unsupported option', () => {
		expect(slideShowOptionChange('keepUpdated', true)).toBeNull();
		expect(slideShowOptionChange('mediaControls', true)).toBeNull();
	});
});
