import { describe, expect, it } from 'vitest';

import { sourceBlocksEditing, stageShowsLoading } from './stage-loading';

describe('stageShowsLoading', () => {
	it('shows the message while nothing is displayed yet', () => {
		expect(stageShowsLoading(true, 'bootstrap', false)).toBeTruthy();
		expect(stageShowsLoading(true, 'user', false)).toBeTruthy();
	});

	it('keeps a collaboration-synced slide mounted during the bootstrap load', () => {
		expect(stageShowsLoading(true, 'bootstrap', true)).toBeFalsy();
	});

	it('still replaces the stage for a file the user chose', () => {
		expect(stageShowsLoading(true, 'user', true)).toBeTruthy();
	});

	it('never shows the message when not loading', () => {
		expect(stageShowsLoading(false, 'bootstrap', true)).toBeFalsy();
	});
});

describe('sourceBlocksEditing', () => {
	it('blocks editing while the first source load has nothing on screen', () => {
		expect(sourceBlocksEditing(true, true, 'bootstrap', false)).toBeTruthy();
	});

	it('does not revoke editing when a bootstrap load lands over synced slides', () => {
		expect(sourceBlocksEditing(true, true, 'bootstrap', true)).toBeFalsy();
	});

	it('ignores a missing source or a finished load', () => {
		expect(sourceBlocksEditing(false, true, 'bootstrap', false)).toBeFalsy();
		expect(sourceBlocksEditing(true, false, 'bootstrap', false)).toBeFalsy();
	});
});
