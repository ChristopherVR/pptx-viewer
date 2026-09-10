/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Google Fonts webfont fallback, in all five bindings.
 *
 * A deck may reference a font family that is neither installed on the
 * reader's machine nor embedded in the .pptx: PowerPoint renders such decks
 * anyway by silently downloading Microsoft 365 "cloud fonts" on demand, and
 * a browser has no equivalent. Every binding must resolve each referenced
 * family the same way: use it as-is when the local canvas metric probe
 * reports it installed, otherwise probe the Google Fonts css2 endpoint and
 * inject a `<link rel="stylesheet">` for the families it serves (with the
 * family properly encoded: spaces as %20, never a literal `+`, which the API
 * rejects with 400) so the text renders with the intended face.
 *
 * Two fixtures drive this, both sharing the same five-shape skeleton ("Box A",
 * "Box B", "Rounded", "Arrow", "Pinned"):
 *
 * - `adlam-webfont.pptx` stamps every run with `typeface="ADLaM Display"`, a
 *   family the css2 API serves under its OWN name: the "plain" case.
 * - `calibri-metric-webfont.pptx` (the same deck with every typeface swapped
 *   to "Calibri") exercises the METRIC-COMPATIBLE substitution case: Calibri
 *   is not itself on Google Fonts, so a binding must request "Carlito"
 *   (Calibri's verified metric clone, `getSubstituteFontFamily`'s second CSS
 *   fallback for Calibri) instead, while the rendered `font-family` stack
 *   keeps listing "Calibri" first so the authored name still wins if the
 *   reader's machine actually has it installed.
 *
 * The css2 endpoint is intercepted and answered with a stub `@font-face` so
 * the spec is fully offline-deterministic; what is under test is the REQUEST
 * the bindings make and the face it registers, not Google's CDN.
 *
 * Run: bunx playwright test google-webfonts
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt } from './support/deck';
import { acrossFrameworks } from './support/parity';

const ADLAM_DECK = fixture('adlam-webfont.pptx');
const CALIBRI_DECK = fixture('calibri-metric-webfont.pptx');

/** Text content shared by a known shape in both fixtures, to locate its element. */
const PROBE_SHAPE_TEXT = 'Box A';

interface WebfontProbe {
	/** The css2 URL the binding requested (`null` when it never asked). */
	css2Url: string | null;
	/** Whether a FontFace named `registerFaceFamily` got registered. */
	faceRegistered: boolean;
	/** The font-family stack of the probe shape's text. */
	shapeFontFamily: string | null;
}

/**
 * Load `deckPath` with the Google Fonts CSS2 endpoint stubbed to register
 * `registerFaceFamily`, then report what the binding asked for and what it
 * registered.
 *
 * @param deckFontFamily - The family the deck's runs reference (`ADLaM
 *   Display`, `Calibri`, ...). Passed to the canvas-measurement override
 *   below so it neutralizes exactly this family, regardless of whether the
 *   browser echoes `context.font` back quoted.
 */
async function probeWebfonts(
	page: Page,
	origin: string,
	deckPath: string,
	deckFontFamily: string,
	registerFaceFamily: string,
): Promise<WebfontProbe> {
	let css2Url: string | null = null;
	// The shared resolver skips the network for families its canvas metric
	// probe reports as locally installed. This spec is about the probe +
	// injected link, so force "not installed" to stay deterministic on
	// machines that DO have the fixture's family installed - which, for a
	// common Office font like Calibri, is the common case on Windows (it
	// ships with the OS itself, not just Microsoft 365): measuring with the
	// family stripped out returns the fallback-only width, exactly what a
	// missing font produces.
	//
	// The stripping regex must not assume `context.font`'s GETTER echoes the
	// family back quoted: Chromium keeps the quotes for a multi-word name
	// ("ADLaM Display", which cannot be a bare CSS ident) but drops them when
	// serializing a single bare-ident name like "Calibri" back out. Matching
	// on the KNOWN family name itself (quotes optional) instead of "any
	// quoted segment" handles both; the previous quote-only pattern silently
	// no-opped for "Calibri" and let its real, actually-installed metrics
	// through, which looked identical to "the webfont path never fired".
	await page.addInitScript((familyToForceMissing: string) => {
		const original = CanvasRenderingContext2D.prototype.measureText;
		const escaped = familyToForceMissing.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
		const pattern = new RegExp(`"?${escaped}"?,\\s*`, 'iu');
		CanvasRenderingContext2D.prototype.measureText = function (text) {
			const font = this.font;
			if (pattern.test(font)) {
				this.font = font.replace(pattern, '');
				try {
					return original.call(this, text);
				} finally {
					this.font = font;
				}
			}
			return original.call(this, text);
		};
	}, deckFontFamily);
	await page.route('**/fonts.googleapis.com/css2**', async (route) => {
		css2Url = route.request().url();
		await route.fulfill({
			status: 200,
			contentType: 'text/css',
			// local() keeps the stub offline: the face registers without any
			// font-binary fetch, which is all this spec asserts.
			body: `@font-face { font-family: "${registerFaceFamily}"; src: local("Arial"); font-display: swap; }`,
		});
	});

	await loadDeckAt(page, origin, deckPath);
	await page.waitForTimeout(1000);

	const state = await page.evaluate(
		(args) => ({
			faceRegistered: [...document.fonts].some(
				(f) => f.family.replace(/"/g, '') === args.registerFaceFamily,
			),
			shapeFontFamily: (() => {
				// Every ancestor wrapper down to the actual run (the shape's own
				// element, an inner layout div, a per-segment span, then per-word
				// spans for letter-spacing) shares the same trimmed textContent, so
				// several elements match; only the run-level span carries the
				// resolved `font-family`, the rest inherit or use the page's own
				// default. `querySelectorAll` returns matches in DOCUMENT ORDER
				// (ancestors before descendants), so the LAST match among nested
				// candidates is always the deepest, which is the one this probe
				// needs (verified against all five bindings' actual DOM).
				const candidates = [
					...document.querySelectorAll('[data-pptx-viewport] span, [data-pptx-viewport] div'),
				].filter((n) => (n.textContent ?? '').trim() === args.probeText);
				const el = candidates.at(-1) ?? null;
				return el ? getComputedStyle(el).fontFamily : null;
			})(),
		}),
		{ registerFaceFamily, probeText: PROBE_SHAPE_TEXT },
	);
	return { css2Url, ...state };
}

test.describe('google webfonts fallback', () => {
	test('references a missing cloud font from Google Fonts in every binding', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			probeWebfonts(page, origin, ADLAM_DECK, 'ADLaM Display', 'ADLaM Display'),
		);

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (!value.css2Url) {
				problems.push(`${framework.name}: no Google Fonts css2 request was made`);
				continue;
			}
			// Spaces must travel as %20: a literal '+' decodes to an invalid
			// family-name character and the API answers 400. The probe requests
			// the family with the universal axis spec appended after the name.
			if (!value.css2Url.includes('family=ADLaM%20Display')) {
				problems.push(`${framework.name}: css2 URL is not correctly encoded: ${value.css2Url}`);
			}
			if (!value.faceRegistered) {
				problems.push(`${framework.name}: the stubbed @font-face never registered`);
			}
			if (!value.shapeFontFamily) {
				problems.push(`${framework.name}: no slide text is styled with the webfont`);
			}
		}
		expect(problems).toStrictEqual([]);
	});

	test('substitutes an unservable Office font with its metric-compatible clone, in every binding', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			probeWebfonts(page, origin, CALIBRI_DECK, 'Calibri', 'Carlito'),
		);

		const problems: string[] = [];
		for (const { framework, value } of results) {
			if (!value.css2Url) {
				problems.push(`${framework.name}: no Google Fonts css2 request was made for Calibri`);
				continue;
			}
			// The request must go out for Carlito (Calibri's verified
			// metric-compatible clone), never for Calibri itself: Google Fonts
			// does not serve Calibri and would answer 400.
			if (!value.css2Url.includes('family=Carlito')) {
				problems.push(`${framework.name}: css2 request did not ask for Carlito: ${value.css2Url}`);
			}
			if (value.css2Url.includes('family=Calibri')) {
				problems.push(`${framework.name}: css2 request asked for unservable "Calibri" directly`);
			}
			if (!value.faceRegistered) {
				problems.push(`${framework.name}: the stubbed Carlito @font-face never registered`);
			}
			// The rendered stack must keep the authored family FIRST (so an
			// actually-installed Calibri still wins) with Carlito right after it,
			// matching getSubstituteFontFamily('Calibri').
			if (!value.shapeFontFamily?.includes('Calibri')) {
				problems.push(
					`${framework.name}: rendered font-family dropped the authored "Calibri": ${value.shapeFontFamily}`,
				);
			}
			if (!value.shapeFontFamily?.includes('Carlito')) {
				problems.push(
					`${framework.name}: rendered font-family is missing the "Carlito" fallback: ${value.shapeFontFamily}`,
				);
			}
		}
		expect(problems).toStrictEqual([]);
	});
});
