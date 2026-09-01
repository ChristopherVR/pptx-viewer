// @vitest-environment happy-dom
/**
 * Regression coverage for the Google Fonts webfont fallback in
 * `useFontInjection`: a deck that references a family which is neither
 * installed nor embedded (PowerPoint would fetch it as a Microsoft 365 cloud
 * font) must get a Google Fonts stylesheet link once the API probe confirms
 * the family is served, and must not when the deck embeds it itself or the
 * probe rejects the family.
 */
import type { PptxElement, PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { resetGoogleWebfontProbeCache } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFontInjection } from './useFontInjection';

const LINK_ID = 'pptx-google-fonts';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	resetGoogleWebfontProbeCache();
	// happy-dom eagerly fetches injected `<link rel="stylesheet">` elements;
	// disable that so tests stay offline-deterministic, and silence its
	// "loading is disabled" report for the links this hook injects.
	vi.spyOn(console, 'error').mockImplementation(() => {});
	const happy = (
		window as unknown as { happyDOM?: { settings: { disableCSSFileLoading?: boolean } } }
	).happyDOM;
	if (happy) {
		happy.settings.disableCSSFileLoading = true;
	}
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	document.getElementById(LINK_ID)?.remove();
	document.getElementById('pptx-embedded-fonts')?.remove();
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
	return {
		id: 's1',
		rId: 'rId1',
		elements,
	} as unknown as PptxSlide;
}

function Probe({ slides, fonts }: { slides: PptxSlide[]; fonts: PptxEmbeddedFont[] }): null {
	useFontInjection({ embeddedFonts: fonts, slides });
	return null;
}

function render(slides: PptxSlide[], fonts: PptxEmbeddedFont[]): void {
	act(() => {
		root.render(<Probe slides={slides} fonts={fonts} />);
	});
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

describe('useFontInjection google webfonts fallback', () => {
	it('injects a Google Fonts link once the probe confirms the family', async () => {
		stubProbe(['ADLaM Display']);
		render([slide(textEl('ADLaM Display'))], []);
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).not.toBeNull());
		const link = document.getElementById(LINK_ID);
		expect(link?.getAttribute('rel')).toBe('stylesheet');
		expect(link?.getAttribute('href')).toContain('family=ADLaM%20Display');
	});

	it('skips the link when the referenced family is embedded', async () => {
		stubProbe(['ADLaM Display']);
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		render(
			[slide(textEl('ADLaM Display'))],
			[{ name: 'ADLaM Display', dataUrl: 'data:font/ttf;base64,AA==' }],
		);
		await act(async () => {
			await Promise.resolve();
		});
		expect(document.getElementById(LINK_ID)).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('injects no link when the probe rejects every referenced family', async () => {
		stubProbe([]);
		render([slide(textEl('Some Local Font'), textEl('Calibri'))], []);
		await act(async () => {
			await Promise.resolve();
		});
		expect(document.getElementById(LINK_ID)).toBeNull();
	});

	it('removes the link when the deck changes to unneeded families', async () => {
		stubProbe(['ADLaM Display']);
		render([slide(textEl('ADLaM Display'))], []);
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).not.toBeNull());

		stubProbe([]);
		render([slide(textEl('Some Local Font'))], []);
		await vi.waitFor(() => expect(document.getElementById(LINK_ID)).toBeNull());
	});
});
