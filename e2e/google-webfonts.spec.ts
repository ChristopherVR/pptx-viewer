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
 * The fixture (`adlam-webfont.pptx`) stamps slide 1's runs with
 * `typeface="ADLaM Display"` and embeds nothing. The css2 endpoint is
 * intercepted and answered with a stub `@font-face` so the spec is fully
 * offline-deterministic; what is under test is the REQUEST the bindings make
 * and the face it registers, not Google's CDN.
 *
 * Run: bunx playwright test google-webfonts
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt } from './support/deck';
import { acrossFrameworks } from './support/parity';

const ADLAM_DECK = fixture('adlam-webfont.pptx');

interface WebfontProbe {
	/** The css2 URL the binding requested (`null` when it never asked). */
	css2Url: string | null;
	/** Whether a FontFace named "ADLaM Display" got registered. */
	faceRegistered: boolean;
	/** The font-family stack of the slide-1 title text. */
	titleFontFamily: string | null;
}

/**
 * Load the ADLaM deck with the Google Fonts CSS2 endpoint stubbed, then
 * report what the binding asked for and what it registered.
 */
async function probeWebfonts(page: Page, origin: string): Promise<WebfontProbe> {
	let css2Url: string | null = null;
	// The shared resolver skips the network for families its canvas metric
	// probe reports as locally installed. This spec is about the probe +
	// injected link, so force "not installed" to stay deterministic on
	// machines that DO have the fixture's family installed (it ships with
	// Microsoft 365): measuring with any quoted family returns the
	// fallback-only width, which is exactly what a missing font produces.
	await page.addInitScript(() => {
		const original = CanvasRenderingContext2D.prototype.measureText;
		CanvasRenderingContext2D.prototype.measureText = function (text) {
			const font = this.font;
			if (/"[^"]+"/.test(font)) {
				this.font = font.replace(/"[^"]+",\s*/, '');
				try {
					return original.call(this, text);
				} finally {
					this.font = font;
				}
			}
			return original.call(this, text);
		};
	});
	await page.route('**/fonts.googleapis.com/css2**', async (route) => {
		css2Url = route.request().url();
		await route.fulfill({
			status: 200,
			contentType: 'text/css',
			// local() keeps the stub offline: the face registers without any
			// font-binary fetch, which is all this spec asserts.
			body: '@font-face { font-family: "ADLaM Display"; src: local("Arial"); font-display: swap; }',
		});
	});

	await loadDeckAt(page, origin, ADLAM_DECK);
	await page.waitForTimeout(1000);

	const state = await page.evaluate(() => ({
		faceRegistered: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'ADLaM Display'),
		titleFontFamily: (() => {
			const el = [
				...document.querySelectorAll('[data-pptx-viewport] span, [data-pptx-viewport] div'),
			].find(
				(n) =>
					(n.textContent ?? '').trim().length > 0 &&
					getComputedStyle(n).fontFamily.includes('ADLaM'),
			);
			return el ? getComputedStyle(el).fontFamily : null;
		})(),
	}));
	return { css2Url, ...state };
}

test.describe('google webfonts fallback', () => {
	test('references a missing cloud font from Google Fonts in every binding', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, (page, origin) =>
			probeWebfonts(page, origin),
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
			if (!value.titleFontFamily) {
				problems.push(`${framework.name}: no slide text is styled with the webfont`);
			}
		}
		expect(problems).toStrictEqual([]);
	});
});
