// @vitest-environment happy-dom
/**
 * webfonts.test.ts: unit tests for the vanilla binding's Google Fonts
 * webfont-fallback DOM management (the pure href resolution itself is covered
 * by `pptx-viewer-shared`). The store subscription lives in `PptxViewer`;
 * these tests exercise the functions it calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	VANILLA_GOOGLE_FONTS_LINK_ID,
	removeGoogleWebfontsLink,
	syncGoogleWebfontsLink,
} from './webfonts';

beforeEach(() => {
	// happy-dom eagerly fetches injected `<link rel="stylesheet">` elements;
	// disable that so tests stay offline-deterministic, and silence its
	// "loading is disabled" report for the links under test.
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const happy = (
		window as unknown as { happyDOM?: { settings: { disableCSSFileLoading?: boolean } } }
	).happyDOM;
	if (happy) {
		happy.settings.disableCSSFileLoading = true;
	}
});

afterEach(() => {
	document.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID)?.remove();
	vi.restoreAllMocks();
});

describe('syncGoogleWebfontsLink', () => {
	it('injects a stylesheet link into <head>', () => {
		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=X&display=swap');
		const link = document.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID);
		expect(link?.getAttribute('rel')).toBe('stylesheet');
		expect(link?.getAttribute('href')).toContain('family=X');
	});

	it('reuses the element across syncs and removes it when null', () => {
		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=X');
		const first = document.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID);

		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=Y');
		const second = document.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID);
		expect(second).toBe(first);
		expect(second?.getAttribute('href')).toContain('family=Y');

		syncGoogleWebfontsLink(document, null);
		expect(document.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID)).toBeNull();
	});

	it('removeGoogleWebfontsLink clears the element', () => {
		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=X');
		removeGoogleWebfontsLink(document);
		expect(document.getElementById(VANILLA_GOOGLE_FONTS_LINK_ID)).toBeNull();
		removeGoogleWebfontsLink(document);
	});
});
