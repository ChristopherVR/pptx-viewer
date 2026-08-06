/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings paint the same PIXELS?
 *
 * `slide-render-parity` compares what the DOM says was painted; this spec
 * compares the paint. The distinction matters because whole classes of drift
 * are invisible to a computed-style fingerprint: an SVG gradient resolving to
 * the wrong stop, a preset clip-path eating a corner, a table border painted
 * once instead of collapsed, a bullet glyph substituted from the wrong font.
 * Every one of those has shipped in this repo while the DOM read identically.
 *
 * The demos fit the slide to their own chrome, so raw stage screenshots come
 * back at different sizes. `support/visual-diff` normalises each one onto a
 * fixed 1280x720 canvas inside the captured page (no image dependency: the
 * browser is the decoder), Node diffs the resulting grids per-pixel, and the
 * budget absorbs only the anti-aliasing halo that different zoom factors
 * necessarily leave around glyph and shape edges.
 *
 * On failure the normalised reference, candidate and red-overlay diff PNGs
 * are attached to the report, so a human sees what diverged without re-running.
 *
 * Run: bunx playwright test slide-visual-parity
 */
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { fixture, loadDeckAt, thumbnail } from './support/deck';
import { acrossFrameworks, splitReference } from './support/parity';
import type { FrameworkResult } from './support/parity';
import { captureNormalizedStage, compareVisualResults } from './support/visual-diff';
import type { SlideCaptures, VisualBudget, VisualExclusion } from './support/visual-diff';

test.use({ viewport: { width: 1440, height: 900 } });

const SAMPLE = fixture('sample-deck.pptx');
const TEXT_FEATURES = fixture('text-features.pptx');
const GALLERY = fixture('chart-gallery.pptx');

/**
 * How far a candidate may drift from the reference before the pair fails.
 *
 * A pixel counts as different when its shift-tolerant delta (see
 * `support/pixels`) exceeds `channelThreshold` on any RGB channel; the pair
 * fails when more than `maxDiffRatio` of the canvas differs. Tuned against
 * measured drift on current main: with threshold 25 most pairs measure
 * 0.1-0.6%, and the noisiest genuinely-matching pair (the table slide, all
 * candidates ~1.2%: it is text-dense, and each binding rasterises the glyphs
 * at its own zoom before normalisation) stays well under 2%. A single
 * missing tile-sized shape or a re-filled panel measures far above it.
 */
const BUDGET: VisualBudget = { channelThreshold: 25, maxDiffRatio: 0.02 };

/**
 * Known, tracked product divergences this suite must not go red on.
 *
 * Each entry is parity debt: it names the binding, the slide and the root
 * cause, and it must be deleted when the underlying defect is fixed so the
 * pixels start being asserted again.
 */
const EXCLUSIONS: readonly VisualExclusion[] = [];

/** The chart drawing itself; mounts after the slide stage paints. */
const CHART_DRAWING = '[aria-roledescription="slide"] [aria-roledescription="chart"] svg';

/**
 * Navigate to a slide and wait until it has actually rendered.
 *
 * The wait keys on `data-element-id`, which core assigns from the slide's own
 * part name (`ppt/slides/slideN.xml-...`) identically in every binding, so
 * "the new slide is up" is observable without any binding-specific hook. The
 * prefix includes `.xml`, so `slide1` can never match `slide11`.
 */
async function gotoSlide(page: Page, slide: number): Promise<void> {
	if (slide > 1) {
		await thumbnail(page, slide).click();
	}
	await page
		.locator(`[data-pptx-viewport] [data-element-id^="ppt/slides/slide${slide}.xml"]`)
		.first()
		.waitFor({ timeout: 15_000 });
}

/** Walk `slides` and capture each one, normalised, keyed as `slide-N`. */
async function captureSlides(
	page: Page,
	slides: readonly number[],
	readySelector?: string,
): Promise<SlideCaptures> {
	const captures: SlideCaptures = {};
	for (const slide of slides) {
		await gotoSlide(page, slide);
		if (readySelector) {
			await page.locator(readySelector).first().waitFor({ timeout: 15_000 });
		}
		captures[`slide-${slide}`] = await captureNormalizedStage(page);
	}
	return captures;
}

/**
 * Diff every candidate against the reference, attach the evidence, assert.
 *
 * The per-pair measurements are always attached (not only on failure) so the
 * budget above stays auditable against real numbers from any run.
 */
async function assertVisualParity(
	testInfo: TestInfo,
	results: FrameworkResult<SlideCaptures>[],
): Promise<void> {
	const { reference } = splitReference(results);
	expect(Object.keys(reference.value).length).toBeGreaterThan(0);

	const report = compareVisualResults(results, BUDGET, EXCLUSIONS);
	await testInfo.attach('visual-diff-measurements', {
		body: Buffer.from(report.measurements.join('\n'), 'utf8'),
		contentType: 'text/plain',
	});
	for (const artifact of report.artifacts) {
		await testInfo.attach(artifact.name, {
			body: artifact.body,
			contentType: artifact.contentType,
		});
	}
	expect(report.problems.join('\n\n')).toBe('');
}

test.describe('cross-binding visual rendering', () => {
	test('every slide of the sample deck paints the same pixels everywhere', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			// All 7 slides, deliberately including slide 5: it holds the suite's
			// only table, which no other parity spec has ever compared visually.
			return captureSlides(page, [1, 2, 3, 4, 5, 6, 7]);
		});

		await assertVisualParity(testInfo, results);
	});

	test('the text-features title slide paints the same pixels everywhere', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, TEXT_FEATURES);
			// Slide 1 carries a slide-number field; it resolves to the same value
			// on every load, so no masking is needed (there are no date/time
			// fields anywhere in this suite's visual coverage).
			return captureSlides(page, [1]);
		});

		await assertVisualParity(testInfo, results);
	});

	test('chart slides of the gallery paint the same pixels everywhere', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, GALLERY);
			// Slide 1 is the clustered bar, slide 4 the pie: one rectangular and
			// one radial chart family, per the fixture's CHART_SLIDES manifest.
			// The chart <svg> mounts after the stage paints, so each capture
			// additionally waits for the drawing itself.
			return captureSlides(page, [1, 4], CHART_DRAWING);
		});

		await assertVisualParity(testInfo, results);
	});
});
