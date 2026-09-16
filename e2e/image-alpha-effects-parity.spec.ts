/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression for GitHub issue #286: "Picture with a:alphaModFix gets the
 * alpha applied twice (SVG filter x CSS opacity)".
 *
 * A picture whose `a:blip` carries `<a:alphaModFix amt="15000"/>` used to
 * render at ~2.25% opacity instead of 15%, because
 * `packages/shared/src/render/image-effects.ts` emitted BOTH a CSS
 * `opacity: 0.15` on the `<img>` AND a `imgalpha-<id>` SVG `<filter>` whose
 * `feColorMatrix` ALSO multiplied alpha by 0.15 - the two composed
 * multiplicatively (0.15 x 0.15) since `hasAdvancedImageAlphaEffects`
 * treated `alphaModFix` alone as reason enough to build that filter.
 *
 * The fix: `alphaModFix` is applied EXCLUSIVELY as CSS `opacity`
 * (`getImageEffectsOpacity`), never folded into the SVG filter's own
 * primitives, even when that filter is built anyway for another advanced
 * alpha/colour effect (here, `a:biLevel`) on the same picture.
 *
 * Every binding just spreads `pptx-viewer-shared`'s `getComputedImageStyle` /
 * `getImageEffectsFilter` + `getImageEffectsOpacity` onto its `<img>` and SVG
 * defs, so this is a single shared fix; this spec exercises the real parse ->
 * render pipeline (not the pure function directly) in all five bindings.
 *
 * Fixture: `image-alpha-effects.pptx`
 * (`e2e/fixtures/generate-image-alpha-effects-fixture.ts`) - two pictures,
 * "AlphaModFix Alone" (just `alphaModFix`) and "AlphaModFix Combined"
 * (`alphaModFix` + `biLevel`, which genuinely needs the SVG filter).
 *
 * Run: bunx playwright test image-alpha-effects-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	ALONE_PICTURE_NAME,
	ALPHA_MOD_FIX_OPACITY,
	COMBINED_PICTURE_NAME,
} from './fixtures/generate-image-alpha-effects-fixture';
import { fixture, loadDeckAt, slideElements, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('image-alpha-effects.pptx');

/** Alpha channel serialises with float noise; half a percentage point is real. */
const OPACITY_TOLERANCE = 0.01;

/**
 * The alphaModFix feColorMatrix primitive this repo's SVG alpha filter would
 * emit if it (wrongly) folded alphaModFix's own multiplier in
 * (`... 0 0 0 ${mul} 0`, mul = 0.15). Its presence anywhere on the page,
 * inside an `imgalpha-*` filter, is exactly the double-application bug.
 */
const ALPHA_MOD_FIX_MATRIX_TAIL = `0 0 0 ${ALPHA_MOD_FIX_OPACITY} 0`;

interface PictureAlphaFacts {
	/** Both pictures' `<img>` computed `opacity`, in authoring/DOM order. */
	opacities: number[];
	/** Both pictures' `<img>` computed `filter`, in the same order. */
	filters: string[];
	/**
	 * How many `imgalpha-*` SVG `<filter>` defs exist anywhere on the page.
	 * Informational only: thumbnails and previews render the same picture
	 * again with their own def, so the count is per binding, not per picture.
	 */
	alphaFilterCount: number;
	/** Combined inner markup of every `imgalpha-*` filter (for the matrix check). */
	alphaFilterMarkup: string;
}

async function readImageAlphaFacts(page: Page, origin: string): Promise<PictureAlphaFacts> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(500);

	// Both pictures are plain top-level `p:pic` elements authored in a fixed
	// order (Alone, then Combined), which is DOM order in every binding - the
	// same assumption `accessibility-image-parity.spec.ts` relies on.
	const wrappers = slideElements(page).filter({ has: page.locator('img') });
	const count = await wrappers.count();
	const opacities: number[] = [];
	const filters: string[] = [];
	for (let i = 0; i < count; i++) {
		const img = wrappers.nth(i).locator('img').first();
		const style = await img.evaluate((el) => {
			const computed = getComputedStyle(el);
			return { opacity: computed.opacity, filter: computed.filter };
		});
		opacities.push(Number(style.opacity));
		filters.push(style.filter);
	}

	const { alphaFilterCount, alphaFilterMarkup } = await page.evaluate(() => {
		const filterDefs = [...document.querySelectorAll('filter[id*="imgalpha"]')];
		return {
			alphaFilterCount: filterDefs.length,
			alphaFilterMarkup: filterDefs.map((f) => f.innerHTML).join('\n'),
		};
	});

	return { opacities, filters, alphaFilterCount, alphaFilterMarkup };
}

test.describe('alphaModFix applied exactly once (issue #286)', () => {
	test('a picture with alphaModFix alone gets plain CSS opacity and no alpha SVG filter', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readImageAlphaFacts);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			const opacity = value.opacities[0];
			if (opacity === undefined || Math.abs(opacity - ALPHA_MOD_FIX_OPACITY) > OPACITY_TOLERANCE) {
				problems.push(
					`"${ALONE_PICTURE_NAME}" opacity is ${opacity}, expected ~${ALPHA_MOD_FIX_OPACITY} ` +
						'(a squared ~0.0225 means the alpha filter is ALSO multiplying it)',
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});

	test('combined with another advanced alpha effect (biLevel), alphaModFix still applies exactly once', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readImageAlphaFacts);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			const opacity = value.opacities[1];
			if (opacity === undefined || Math.abs(opacity - ALPHA_MOD_FIX_OPACITY) > OPACITY_TOLERANCE) {
				problems.push(
					`"${COMBINED_PICTURE_NAME}" opacity is ${opacity}, expected ~${ALPHA_MOD_FIX_OPACITY}`,
				);
			}
			// biLevel genuinely needs the imgalpha SVG filter, so the combined
			// picture's <img> must reference one, and the alone picture's must
			// not (its alphaModFix is plain CSS opacity). Checked per image, not
			// as a page-wide def count: the thumbnail strip renders the same
			// picture again with its own filter def.
			if (!value.filters[1]?.includes('imgalpha')) {
				problems.push(
					`"${COMBINED_PICTURE_NAME}" img filter is "${value.filters[1]}", expected an imgalpha url()`,
				);
			}
			if (value.filters[0]?.includes('imgalpha')) {
				problems.push(
					`"${ALONE_PICTURE_NAME}" img filter is "${value.filters[0]}", expected no imgalpha filter`,
				);
			}
			if (value.alphaFilterCount < 1) {
				problems.push('expected at least one imgalpha SVG filter def on the page, found none');
			}
			// The filter is legitimately built (for biLevel's own primitives), but
			// must not ALSO carry alphaModFix's multiplier: that would be the
			// double-application bug even though the filter has a real reason to
			// exist.
			if (value.alphaFilterMarkup.includes(ALPHA_MOD_FIX_MATRIX_TAIL)) {
				problems.push(
					`the imgalpha SVG filter still contains alphaModFix's own multiplier ("${ALPHA_MOD_FIX_MATRIX_TAIL}") ` +
						'alongside CSS opacity: alpha is being applied twice',
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
