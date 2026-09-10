import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GOOGLE_FONTS_CATALOGUE_DATE, GOOGLE_FONTS_FAMILIES } from './google-fonts-catalogue';
import {
	buildGoogleFontsFragment,
	buildGoogleFontsHref,
	collectReferencedFontFamilies,
	isFontFamilyInstalledLocally,
	findGoogleFontsFamily,
	findMetricCompatibleGoogleFontsFamily,
	matchGoogleWebfontFragments,
	resetGoogleWebfontSessionCache,
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

beforeEach(() => {
	resetGoogleWebfontSessionCache();
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

	it('accepts a self-hosted base URL override', () => {
		const href = buildGoogleFontsHref(
			[buildGoogleFontsFragment('Carlito')],
			'https://fonts.example.com/css2',
		);
		expect(href).toMatch(/^https:\/\/fonts\.example\.com\/css2\?family=Carlito/u);
	});
});

describe('google-fonts-catalogue', () => {
	it('is a sorted, deduplicated snapshot with a regeneration date', () => {
		expect(GOOGLE_FONTS_CATALOGUE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
		expect(GOOGLE_FONTS_FAMILIES.length).toBeGreaterThan(1000);
		expect(new Set(GOOGLE_FONTS_FAMILIES).size).toBe(GOOGLE_FONTS_FAMILIES.length);
		expect([...GOOGLE_FONTS_FAMILIES]).toStrictEqual(
			[...GOOGLE_FONTS_FAMILIES].sort((a, b) => a.localeCompare(b, 'en')),
		);
	});
});

describe('findGoogleFontsFamily', () => {
	it('answers with the canonical spelling, case- and whitespace-insensitively', () => {
		expect(findGoogleFontsFamily('ADLaM Display')).toBe('ADLaM Display');
		expect(findGoogleFontsFamily('adlam  display ')).toBe('ADLaM Display');
		expect(findGoogleFontsFamily('roboto')).toBe('Roboto');
	});

	it('rejects families the API does not serve without any request', () => {
		expect(findGoogleFontsFamily('Calibri')).toBeNull();
		expect(findGoogleFontsFamily('Helvetica Neue Medium')).toBeNull();
		expect(findGoogleFontsFamily('')).toBeNull();
	});
});

describe('findMetricCompatibleGoogleFontsFamily', () => {
	it('resolves an unserved Office font to its metric-compatible clone', () => {
		expect(findMetricCompatibleGoogleFontsFamily('Calibri')).toBe('Carlito');
		expect(findMetricCompatibleGoogleFontsFamily('Cambria')).toBe('Caladea');
		expect(findMetricCompatibleGoogleFontsFamily('Arial')).toBe('Arimo');
		expect(findMetricCompatibleGoogleFontsFamily('Times New Roman')).toBe('Tinos');
		expect(findMetricCompatibleGoogleFontsFamily('Courier New')).toBe('Cousine');
		expect(findMetricCompatibleGoogleFontsFamily('Georgia')).toBe('Gelasio');
	});

	it('chains through Aptos to the same Calibri clone', () => {
		expect(findMetricCompatibleGoogleFontsFamily('Aptos')).toBe('Carlito');
	});

	it('returns null when the family is already servable under its own name', () => {
		expect(findMetricCompatibleGoogleFontsFamily('Roboto')).toBeNull();
	});

	it('returns null when no fallback in the chain is on the catalogue', () => {
		// Segoe UI's metric-compatible match (Selawik) is not on Google Fonts.
		expect(findMetricCompatibleGoogleFontsFamily('Segoe UI')).toBeNull();
		expect(findMetricCompatibleGoogleFontsFamily('Totally Unknown Face')).toBeNull();
	});
});

describe('matchGoogleWebfontFragments', () => {
	it('keeps catalogue families (canonically spelled) and drops unknown ones', () => {
		const fragments = matchGoogleWebfontFragments(['adlam display', 'Roboto', 'Totally Unknown']);
		expect(fragments).toStrictEqual([
			'ADLaM Display:ital,wght@0,400;0,700;1,400;1,700',
			'Roboto:ital,wght@0,400;0,700;1,400;1,700',
		]);
	});

	it('never touches the network', () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		matchGoogleWebfontFragments(['ADLaM Display', 'Totally Unknown']);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('substitutes an unmatched Office font with its metric-compatible clone', () => {
		expect(matchGoogleWebfontFragments(['Calibri'])).toStrictEqual([
			buildGoogleFontsFragment('Carlito'),
		]);
	});

	it('dedupes two families that resolve to the same clone into one fragment', () => {
		// Aptos and Calibri both resolve to Carlito; the request should not
		// ask Google Fonts for the same family twice.
		expect(matchGoogleWebfontFragments(['Aptos', 'Calibri'])).toStrictEqual([
			buildGoogleFontsFragment('Carlito'),
		]);
	});
});

describe('resolveGoogleWebfontHref', () => {
	it('resolves the href for a deck referencing an unembedded served font', async () => {
		const href = await resolveGoogleWebfontHref([slide(textEl('ADLaM Display'))], []);
		expect(href).toContain('family=ADLaM%20Display%3Aital');
	});

	it('returns null when the family is embedded or truly unmatched', async () => {
		await expect(
			resolveGoogleWebfontHref([slide(textEl('ADLaM Display'))], [{ name: 'ADLaM Display' }]),
		).resolves.toBeNull();
		await expect(
			resolveGoogleWebfontHref([slide(textEl('Totally Unknown Face'))], []),
		).resolves.toBeNull();
	});

	it('resolves an unembedded Office font to its metric-compatible clone', async () => {
		const href = await resolveGoogleWebfontHref([slide(textEl('Calibri'))], []);
		expect(href).toContain('family=Carlito%3Aital');
	});

	it('an embedded Office font is NOT redirected to its clone', async () => {
		await expect(
			resolveGoogleWebfontHref([slide(textEl('Calibri'))], [{ name: 'Calibri' }]),
		).resolves.toBeNull();
	});

	it('accepts a self-hosted CSS2 API mirror base URL', async () => {
		const href = await resolveGoogleWebfontHref(
			[slide(textEl('Calibri'))],
			[],
			undefined,
			'https://fonts.example.com/css2',
		);
		expect(href).toMatch(/^https:\/\/fonts\.example\.com\/css2\?family=Carlito/u);
	});

	it('never loads a family the runtime reports as installed', async () => {
		await expect(
			resolveGoogleWebfontHref(
				[slide(textEl('Roboto'), textEl('ADLaM Display'))],
				[],
				(family) => family === 'Roboto',
			),
		).resolves.toBe(buildGoogleFontsHref([buildGoogleFontsFragment('ADLaM Display')]));
	});

	it('keeps a family it already resolved even when it now measures as installed', async () => {
		// Once the injected stylesheet has loaded, the canvas measurement sees
		// the webfont itself and reports the family as "installed". Without the
		// session guard the second resolve would drop the family, the binding
		// would remove the <link>, and the third resolve would find it missing
		// again: an oscillation that re-fetches on every edit.
		const slides = [slide(textEl('ADLaM Display'))];
		let webfontLoaded = false;
		const isInstalled = (): boolean => webfontLoaded;

		const first = await resolveGoogleWebfontHref(slides, [], isInstalled);
		expect(first).toContain('family=ADLaM%20Display');
		webfontLoaded = true;

		const second = await resolveGoogleWebfontHref(slides, [], isInstalled);
		expect(second).toBe(first);
	});

	it('still runs the local check for families the session has not resolved', async () => {
		await resolveGoogleWebfontHref([slide(textEl('ADLaM Display'))], [], () => false);
		await expect(
			resolveGoogleWebfontHref(
				[slide(textEl('ADLaM Display'), textEl('Roboto'))],
				[],
				(family) => family === 'Roboto',
			),
		).resolves.toBe(buildGoogleFontsHref([buildGoogleFontsFragment('ADLaM Display')]));
	});
});
