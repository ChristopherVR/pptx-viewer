/**
 * google-webfonts.service.test.ts: Unit tests for GoogleWebfontsService's
 * `<link>` management (vitest + happy-dom, no TestBed), mirroring
 * `embedded-fonts.service.test.ts`.
 *
 * The service calls `inject(DestroyRef)` in its constructor, so it is built
 * inside a minimal injection context with a capturing `DestroyRef` stub.
 */

import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetGoogleWebfontSessionCache } from '../internal/shared';
import { GoogleWebfontsService, GOOGLE_WEBFONTS_LINK_ID } from './google-webfonts.service';

beforeEach(() => {
	resetGoogleWebfontSessionCache();
	// happy-dom eagerly fetches injected `<link rel="stylesheet">` elements;
	// disable that so tests stay offline-deterministic, and silence its
	// "loading is disabled" report for the links this service injects.
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const happy = (
		window as unknown as { happyDOM?: { settings: { disableCSSFileLoading?: boolean } } }
	).happyDOM;
	if (happy) {
		happy.settings.disableCSSFileLoading = true;
	}
});

afterEach(() => {
	document.getElementById(GOOGLE_WEBFONTS_LINK_ID)?.remove();
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

/** The bundled catalogue answers every lookup; nothing may reach the network. */
function stubNetwork(): void {
	vi.stubGlobal('fetch', vi.fn());
}

/** Build the service inside an injection context with a capturing DestroyRef. */
function makeService(): { svc: GoogleWebfontsService; destroy: () => void } {
	let teardown: (() => void) | undefined;
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: (cb: () => void) => {
			teardown = cb;
			return () => {};
		},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }],
	});
	const svc = runInInjectionContext(injector, () => new GoogleWebfontsService());
	return {
		svc,
		destroy: () => (teardown ? teardown() : svc.dispose()),
	};
}

describe('googleWebfontsService', () => {
	it('injects no <link> before a deck is synced', () => {
		const { destroy } = makeService();
		expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).toBeNull();
		destroy();
	});

	it('injects a Google Fonts link for a catalogue family', async () => {
		stubNetwork();
		const { svc, destroy } = makeService();
		svc.sync([slide(textEl('ADLaM Display'))], []);

		await vi.waitFor(() => expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).not.toBeNull());
		const link = document.getElementById(GOOGLE_WEBFONTS_LINK_ID);
		expect(link?.getAttribute('rel')).toBe('stylesheet');
		expect(link?.getAttribute('href')).toContain('family=ADLaM%20Display');
		destroy();
	});

	it('skips the link when the referenced family is embedded', async () => {
		stubNetwork();
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		const { svc, destroy } = makeService();
		svc.sync([slide(textEl('ADLaM Display'))], [{ name: 'ADLaM Display' }]);
		await Promise.resolve();
		expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
		destroy();
	});

	it('reuses a single <link> element across syncs', async () => {
		stubNetwork();
		const { svc, destroy } = makeService();
		svc.sync([slide(textEl('ADLaM Display'))], []);
		await vi.waitFor(() => expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).not.toBeNull());
		const first = document.getElementById(GOOGLE_WEBFONTS_LINK_ID);

		svc.sync([slide(textEl('Roboto'))], []);
		await vi.waitFor(() =>
			expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)?.getAttribute('href')).toContain(
				'family=Roboto',
			),
		);
		const second = document.getElementById(GOOGLE_WEBFONTS_LINK_ID);

		expect(second).toBe(first);
		destroy();
	});

	it('removes the <link> when nothing needs fetching or on destroy', async () => {
		stubNetwork();
		const { svc, destroy } = makeService();
		svc.sync([slide(textEl('ADLaM Display'))], []);
		await vi.waitFor(() => expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).not.toBeNull());

		svc.sync([slide(textEl('Some Local Font'))], []);
		await vi.waitFor(() => expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).toBeNull());

		svc.sync([slide(textEl('ADLaM Display'))], []);
		await vi.waitFor(() => expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).not.toBeNull());

		destroy();
		expect(document.getElementById(GOOGLE_WEBFONTS_LINK_ID)).toBeNull();
	});
});
