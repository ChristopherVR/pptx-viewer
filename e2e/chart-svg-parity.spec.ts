/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings paint the same chart?
 *
 * `e2e/chart-rendering.spec.ts` already asks whether each binding draws *a*
 * chart, per type, with a plausible number of primitives. It cannot ask the
 * question that actually matters here, because it checks each binding against
 * a threshold rather than against the others: two bindings can both satisfy
 * "more than zero bars" while drawing different charts.
 *
 * Charts are the one part of a slide where an exact answer is available.
 * `packages/shared/src/render/chart-view-model.ts` resolves the whole scene -
 * geometry, colours, label text and its typography - into framework-agnostic
 * primitives, and every binding does nothing but paint them. There is no
 * per-binding layout step in between, so the emitted SVG should agree
 * attribute for attribute. Anything that does not is a binding failing to
 * paint what the shared engine handed it, which is exactly the class of drift
 * that a per-binding threshold test cannot see.
 *
 * Run: bunx playwright test chart-svg-parity
 */
import { expect, test } from '@playwright/test';

import { CHART_SLIDES } from './fixtures/generate-chart-fixture';
import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks, formatDiff, splitReference } from './support/parity';
import { diffCharts, fingerprintCharts } from './support/svg-fingerprint';

test.use({ viewport: { width: 1440, height: 900 } });

const GALLERY = fixture('chart-gallery.pptx');

/**
 * How many gallery slides to compare.
 *
 * The full gallery is long and every slide costs one navigation on each of the
 * bindings under comparison. These cover the distinct rendering families
 * (bar/line/area/pie/doughnut and whatever follows them in the manifest);
 * `chart-rendering.spec.ts` remains the exhaustive per-type sweep.
 */
const SLIDES_UNDER_COMPARISON = Math.min(8, CHART_SLIDES.length);

test.describe('cross-binding chart rendering', () => {
	test('every binding paints the shared chart model identically', async ({ browser }, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, GALLERY);

			const perSlide: Record<
				string,
				ReturnType<typeof fingerprintCharts> extends Promise<infer T> ? T : never
			> = {};
			for (let slide = 1; slide <= SLIDES_UNDER_COMPARISON; slide += 1) {
				await thumbnail(page, slide).click();
				await slideStage(page).waitFor();
				// The chart renderers mount their <svg> after the slide stage paints,
				// so wait for the drawing itself rather than the element box. Located
				// through the accessibility contract because two bindings do not tag
				// their chart frames with `data-pptx-element` at all.
				await page
					.locator('[aria-roledescription="slide"] [aria-roledescription="chart"] svg')
					.first()
					.waitFor({ timeout: 15_000 });
				perSlide[CHART_SLIDES[slide - 1].key] = await fingerprintCharts(page);
			}
			return perSlide;
		});

		const { reference, candidates } = splitReference(results);

		const captured = Object.values(reference.value).flat().length;
		expect(captured, 'the reference binding rendered no charts at all').toBeGreaterThan(0);

		const problems: string[] = [];
		for (const candidate of candidates) {
			const perBinding: string[] = [];
			for (const [key, referenceCharts] of Object.entries(reference.value)) {
				const candidateCharts = candidate.value[key] ?? [];
				perBinding.push(
					...diffCharts(referenceCharts, candidateCharts).map((problem) => `[${key}] ${problem}`),
				);
			}
			if (perBinding.length > 0) {
				problems.push(formatDiff(candidate.framework.name, perBinding));
			}
		}

		expect(problems.join('\n\n')).toBe('');
	});
});
