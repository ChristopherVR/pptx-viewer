import { describe, expect, it } from 'vitest';

import { presenterPaneAdvancesOnClick } from './presenter-view';

/**
 * Regression for issue #106: the presenter console's current-slide pane had no
 * click handler at all, so the console could only be advanced with the keyboard
 * or the Next button - clicking the slide, which is how PowerPoint's presenter
 * console is actually driven, did nothing.
 */
describe('presenterPaneAdvancesOnClick', () => {
	it('advances with no tool selected', () => {
		expect(presenterPaneAdvancesOnClick('none')).toBeTruthy();
		expect(presenterPaneAdvancesOnClick(undefined)).toBeTruthy();
	});

	// The laser only tracks the cursor, so it never consumes the click.
	it('advances while the laser pointer is active', () => {
		expect(presenterPaneAdvancesOnClick('laser')).toBeTruthy();
	});

	// Pen/highlighter/eraser own the pointer: clicking must annotate, not jump
	// the deck out from under the stroke.
	it('does not advance while a drawing tool owns the pointer', () => {
		expect(presenterPaneAdvancesOnClick('pen')).toBeFalsy();
		expect(presenterPaneAdvancesOnClick('highlighter')).toBeFalsy();
		expect(presenterPaneAdvancesOnClick('eraser')).toBeFalsy();
	});
});
