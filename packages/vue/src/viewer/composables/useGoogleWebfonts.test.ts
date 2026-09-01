// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { resetGoogleWebfontProbeCache } from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useGoogleWebfonts } from './useGoogleWebfonts';

const LINK_ID = 'pptx-vue-google-fonts';

beforeEach(() => {
	resetGoogleWebfontProbeCache();
	// happy-dom eagerly fetches injected `<link rel="stylesheet">` elements;
	// disable that so tests stay offline-deterministic, and silence its
	// "loading is disabled" report for the links this composable injects.
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const happy = (
		window as unknown as { happyDOM?: { settings: { disableCSSFileLoading?: boolean } } }
	).happyDOM;
	if (happy) {
		happy.settings.disableCSSFileLoading = true;
	}
});

afterEach(() => {
	document.getElementById(LINK_ID)?.remove();
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

/** Stub the session probe: 200 (served) for the listed families, else 400. */
function stubProbe(served: readonly string[]): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string | URL | Request) => {
			const match = /family=([^&]+)/.exec(String(url));
			const name = match ? decodeURIComponent(match[1]) : '';
			return { status: served.includes(name.split(':')[0]) ? 200 : 400 };
		}),
	);
}

/** Run `fn` inside an effect scope so watchers + dispose work. */
function withScope<T>(fn: () => T): { result: T; stop: () => void } {
	const scope = effectScope();
	const result = scope.run(fn)!;
	return { result, stop: () => scope.stop() };
}

describe('useGoogleWebfonts', () => {
	it('injects a Google Fonts link once the probe confirms the family', async () => {
		stubProbe(['ADLaM Display']);
		const slides = ref([slide(textEl('ADLaM Display'))]);
		withScope(() => useGoogleWebfonts(slides, ref([])));
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).not.toBeNull());
		const link = document.getElementById(LINK_ID);
		expect(link?.getAttribute('rel')).toBe('stylesheet');
		expect(link?.getAttribute('href')).toContain('family=ADLaM%20Display');
	});

	it('skips the link when the referenced family is embedded', async () => {
		stubProbe([]);
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		const fonts = ref<PptxEmbeddedFont[]>([
			{ name: 'ADLaM Display', dataUrl: 'data:font/ttf;base64,AA==' },
		]);
		withScope(() => useGoogleWebfonts(ref([slide(textEl('ADLaM Display'))]), fonts));
		await nextTick();
		await Promise.resolve();
		expect(document.getElementById(LINK_ID)).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('updates the managed link when slides change reactively', async () => {
		stubProbe(['ADLaM Display']);
		const slides = ref([slide(textEl('ADLaM Display'))]);
		withScope(() => useGoogleWebfonts(slides, ref([])));
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).not.toBeNull());

		stubProbe([]);
		slides.value = [slide(textEl('Some Local Font'))];
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).toBeNull());
	});

	it('removes the injected link on scope dispose', async () => {
		stubProbe(['ADLaM Display']);
		const slides = ref([slide(textEl('ADLaM Display'))]);
		const { stop } = withScope(() => useGoogleWebfonts(slides, ref([])));
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).not.toBeNull());

		stop();
		expect(document.getElementById(LINK_ID)).toBeNull();
	});
});
