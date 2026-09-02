import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	buildGoogleFontsFragment,
	buildGoogleFontsHref,
	collectReferencedFontFamilies,
	isFontFamilyInstalledLocally,
	probeGoogleWebfontFragments,
	resetGoogleWebfontProbeCache,
	resolveGoogleWebfontHref,
	selectGoogleWebfontFamilies,
} from './google-webfonts';

/** Minimal text element carrying one styled segment. */
function textEl(fontFamily?: string): PptxElement {
	return {
		type: 'text',
		textSegments: fontFamily ? [{ style: { fontFamily } }] : [{ style: {} }],
	} as unknown as PptxElement;
}

function slide(...elements: PptxElement[]): PptxSlide {
	return { elements } as unknown as PptxSlide;
}

/** A fetch stub keyed by family name: 200 for `served`, 400 otherwise. */
function fetchStub(served: readonly string[]): {
	fetch: (url: string) => Promise<{ status: number }>;
	urls: string[];
} {
	const urls: string[] = [];
	const fetch = async (url: string): Promise<{ status: number }> => {
		urls.push(url);
		const match = /family=([^&]+)/.exec(url);
		const name = match ? decodeURIComponent(match[1]) : '';
		return { status: served.includes(name.split(':')[0]) ? 200 : 400 };
	};
	return { fetch, urls };
}

beforeEach(() => {
	resetGoogleWebfontProbeCache();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('collectReferencedFontFamilies', () => {
	it('collects unique families across slides and dedupes', () => {
		const families = collectReferencedFontFamilies([
			slide(textEl('ADLaM Display'), textEl('Arial'), textEl('ADLaM Display')),
			slide(textEl('Roboto')),
		]);
		expect([...families]).toStrictEqual(['ADLaM Display', 'Arial', 'Roboto']);
	});

	it('recurses into group children', () => {
		const group = {
			type: 'group',
			children: [textEl('ADLaM Display')],
		} as unknown as PptxElement;
		expect([...collectReferencedFontFamilies([slide(group)])]).toStrictEqual(['ADLaM Display']);
	});

	it('skips segments without a family and empty decks', () => {
		expect(collectReferencedFontFamilies([slide(textEl())]).size).toBe(0);
		expect(collectReferencedFontFamilies([]).size).toBe(0);
	});
});

describe('selectGoogleWebfontFamilies', () => {
	it('keeps every referenced family the deck does not embed', () => {
		expect(
			selectGoogleWebfontFamilies(['ADLaM Display', 'Roboto', 'Some Local Font'], ['Roboto']),
		).toStrictEqual(['ADLaM Display', 'Some Local Font']);
	});

	it('accepts an empty embedded list', () => {
		expect(selectGoogleWebfontFamilies(['Cabin'], [])).toStrictEqual(['Cabin']);
	});

	it('drops families the runtime reports as installed before anything is requested', () => {
		expect(
			selectGoogleWebfontFamilies(
				['Installed Face', 'Missing Face'],
				[],
				(family) => family === 'Installed Face',
			),
		).toStrictEqual(['Missing Face']);
	});
});

describe('isFontFamilyInstalledLocally', () => {
	it('returns false when there is no DOM to ask (pure runtime)', () => {
		expect(isFontFamilyInstalledLocally('Arial')).toBeFalsy();
	});
});

describe('buildGoogleFontsFragment', () => {
	it('appends the universal axis spec', () => {
		expect(buildGoogleFontsFragment('ADLaM Display')).toBe(
			'ADLaM Display:ital,wght@0,400;0,700;1,400;1,700',
		);
	});
});

describe('buildGoogleFontsHref', () => {
	it('joins verified fragments with spaces encoded as %20', () => {
		const href = buildGoogleFontsHref([
			buildGoogleFontsFragment('ADLaM Display'),
			buildGoogleFontsFragment('Roboto'),
		]);
		expect(href).toBe(
			'https://fonts.googleapis.com/css2?family=ADLaM%20Display%3Aital%2Cwght%400%2C400%3B0%2C700%3B1%2C400%3B1%2C700&family=Roboto%3Aital%2Cwght%400%2C400%3B0%2C700%3B1%2C400%3B1%2C700&display=swap',
		);
	});

	it('returns null when nothing was verified', () => {
		expect(buildGoogleFontsHref([])).toBeNull();
	});
});

describe('probeGoogleWebfontFragments', () => {
	it('keeps families the API serves and drops unknown ones', async () => {
		const { fetch } = fetchStub(['ADLaM Display', 'Roboto']);
		const fragments = await probeGoogleWebfontFragments(
			['ADLaM Display', 'Roboto', 'Totally Unknown'],
			fetch,
		);
		expect(fragments).toHaveLength(2);
		expect(fragments[0]).toContain('ADLaM Display:ital,wght');
		expect(fragments[1]).toBe('Roboto:ital,wght@0,400;0,700;1,400;1,700');
	});

	it('falls back to a bare fragment when the axis spec is rejected', async () => {
		const served = new Set(['Legacy Face']);
		const fetch = async (url: string): Promise<{ status: number }> => ({
			status:
				served.has(decodeURIComponent(/family=([^&]+)/.exec(url)![1])) && !url.includes('ital')
					? 200
					: 400,
		});
		const fragments = await probeGoogleWebfontFragments(['Legacy Face'], fetch);
		expect(fragments).toStrictEqual(['Legacy Face']);
	});

	it('caches probes for the session', async () => {
		const { fetch, urls } = fetchStub(['ADLaM Display']);
		await probeGoogleWebfontFragments(['ADLaM Display'], fetch);
		await probeGoogleWebfontFragments(['ADLaM Display'], fetch);
		expect(urls).toHaveLength(1);
	});

	it('returns nothing when fetch is unavailable', async () => {
		vi.stubGlobal('fetch', undefined);
		const fragments = await probeGoogleWebfontFragments(['ADLaM Display']);
		expect(fragments).toStrictEqual([]);
	});
});

describe('resolveGoogleWebfontHref', () => {
	it('resolves the href for a deck referencing an unembedded served font', async () => {
		const { fetch } = fetchStub(['ADLaM Display']);
		const href = await resolveGoogleWebfontHref([slide(textEl('ADLaM Display'))], [], fetch);
		expect(href).toContain('family=ADLaM%20Display%3Aital');
	});

	it('returns null when the family is embedded or not served', async () => {
		const { fetch } = fetchStub([]);
		await expect(
			resolveGoogleWebfontHref(
				[slide(textEl('ADLaM Display'))],
				[{ name: 'ADLaM Display' }],
				fetch,
			),
		).resolves.toBeNull();
		await expect(
			resolveGoogleWebfontHref([slide(textEl('Calibri'))], [], fetch),
		).resolves.toBeNull();
	});

	it('never requests a family the runtime reports as installed', async () => {
		const { fetch, urls } = fetchStub(['Missing Face']);
		await expect(
			resolveGoogleWebfontHref(
				[slide(textEl('Installed Face'), textEl('Missing Face'))],
				[],
				fetch,
				(family) => family === 'Installed Face',
			),
		).resolves.toContain('family=Missing%20Face');
		expect(urls.some((url) => url.includes('Installed'))).toBeFalsy();
	});

	it('keeps a family the probe already verified even when it now measures as installed', async () => {
		// Once the injected stylesheet has loaded, the canvas measurement sees
		// the webfont itself and reports the family as "installed". Without the
		// probe-cache guard the second resolve would drop the family, the
		// binding would remove the <link>, and the third resolve would find it
		// missing again: an oscillation that re-fetches on every edit.
		const { fetch, urls } = fetchStub(['ADLaM Display']);
		const slides = [slide(textEl('ADLaM Display'))];
		let webfontLoaded = false;
		const isInstalled = (): boolean => webfontLoaded;

		const first = await resolveGoogleWebfontHref(slides, [], fetch, isInstalled);
		expect(first).toContain('family=ADLaM%20Display');
		webfontLoaded = true;

		const second = await resolveGoogleWebfontHref(slides, [], fetch, isInstalled);
		expect(second).toBe(first);
		// The cached probe answered; no new request went out.
		expect(urls).toHaveLength(1);
	});

	it('still runs the local check for families the session has not probed', async () => {
		const { fetch, urls } = fetchStub(['Probed Face', 'Installed Face']);
		await resolveGoogleWebfontHref([slide(textEl('Probed Face'))], [], fetch, () => false);
		await expect(
			resolveGoogleWebfontHref(
				[slide(textEl('Probed Face'), textEl('Installed Face'))],
				[],
				fetch,
				(family) => family === 'Installed Face',
			),
		).resolves.toContain('family=Probed%20Face');
		expect(urls.some((url) => url.includes('Installed'))).toBeFalsy();
	});
});
