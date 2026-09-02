// @vitest-environment happy-dom
/**
 * google-webfonts.test.ts: unit tests for the Svelte binding's Google Fonts
 * webfont-fallback DOM management (the pure href resolution itself is covered
 * by `pptx-viewer-shared`). The `$effect` wiring lives in
 * `viewer-effects.svelte.ts`; these tests exercise the functions it calls.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	SVELTE_GOOGLE_FONTS_LINK_ID,
	removeGoogleWebfontsLink,
	resolveWebfontHref,
	syncGoogleWebfontsLink,
} from './google-webfonts';

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
	// The bundled catalogue answers every lookup; nothing may reach the network.
	vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
	document.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID)?.remove();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function textEl(fontFamily: string): PptxElement {
	return {
		type: 'text',
		textSegments: [{ style: { fontFamily } }],
	} as unknown as PptxElement;
}

function slide(...elements: PptxElement[]): PptxSlide {
	return { elements } as unknown as PptxSlide;
}

describe('resolveWebfontHref', () => {
	it('resolves a href for a deck referencing an unembedded known family', async () => {
		const href = await resolveWebfontHref([slide(textEl('ADLaM Display'))], []);
		expect(href).toContain('family=ADLaM%20Display');
	});

	it('returns null when no referenced family is in the catalogue', async () => {
		await expect(resolveWebfontHref([slide(textEl('Calibri'))], [])).resolves.toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('syncGoogleWebfontsLink', () => {
	it('injects a stylesheet link into <head>', () => {
		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=X&display=swap');
		const link = document.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID);
		expect(link?.getAttribute('rel')).toBe('stylesheet');
		expect(link?.getAttribute('href')).toContain('family=X');
	});

	it('reuses the element across syncs and removes it when null', () => {
		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=X');
		const first = document.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID);

		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=Y');
		const second = document.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID);
		expect(second).toBe(first);
		expect(second?.getAttribute('href')).toContain('family=Y');

		syncGoogleWebfontsLink(document, null);
		expect(document.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID)).toBeNull();
	});

	it('removeGoogleWebfontsLink clears the element', () => {
		syncGoogleWebfontsLink(document, 'https://fonts.googleapis.com/css2?family=X');
		removeGoogleWebfontsLink(document);
		expect(document.getElementById(SVELTE_GOOGLE_FONTS_LINK_ID)).toBeNull();
		removeGoogleWebfontsLink(document);
	});
});
