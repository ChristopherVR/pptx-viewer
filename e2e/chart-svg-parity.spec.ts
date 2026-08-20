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
import { applyExclusions } from './support/parity-exclusions';
import type { ParityExclusion } from './support/parity-exclusions';
import { diffCharts, fingerprintCharts } from './support/svg-fingerprint';

/**
 * Known, documented divergences (parity debt); see `support/parity-exclusions`.
 *
 * Empty on purpose. The colour divergence this once excluded (Angular painting
 * different series colours than the other four) was the two shared entry
 * points carrying two different default palettes (`DEFAULT_CHART_PALETTE` vs
 * the view-model's `DEFAULT_PALETTE`); they are now one Office-accent set, and
 * explicit `<c:srgbClr>` series colours win over the palette everywhere (core
 * also parses line-series colours from `c:spPr/a:ln`). Add an entry only per
 * the `support/parity-exclusions` policy, and delete it when its bug is fixed.
 */
const KNOWN_DIVERGENCES: readonly ParityExclusion[] = [];

test.use({ viewport: { width: 1440, height: 900 } });

const GALLERY = fixture('chart-gallery.pptx');

/**
 * Every gallery slide is compared: the rendering families past the first eight
 * (scatter, bubble, radar, combo and friends) are exactly the ones with the
 * most per-binding painting code, so capping the sweep excluded the slides
 * most likely to drift. `chart-rendering.spec.ts` remains the per-binding
 * threshold sweep.
 */
const SLIDES_UNDER_COMPARISON = CHART_SLIDES.length;

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
				// Neutral navigation-done signal: the wait below is satisfied by the
				// PREVIOUS slide's chart <svg> too, so without this the capture races
				// slide switching in the slower bindings.
				// 90s per wait, not 45s: `acrossFrameworks` drives ALL FIVE bindings
				// inside this single test, so each wait competes with four other
				// browsers on the same runner. 15s cleared a warm local machine in 27s
				// total and timed out on CI at 30s (raised to 45s); 45s then started
				// timing out on CI too, at a different slide each retry, once every
				// SVG mark started carrying a <title> tooltip node (chart-mark
				// tooltips) - more DOM per chart, on the same CI budget. Locally the
				// full 20-slide, five-binding sweep clears in ~10s, so this is a
				// contention budget, not a rendering defect; raised again with more
				// headroom rather than to the exact measured minimum.
				await page
					.getByText(new RegExp(`\\b${slide} of \\d+\\b`, 'u'))
					.first()
					.waitFor({ timeout: 90_000 });
				await slideStage(page).waitFor();
				// The chart renderers mount their <svg> after the slide stage paints,
				// so wait for the drawing itself rather than the element box. Located
				// through the accessibility contract because two bindings do not tag
				// their chart frames with `data-pptx-element` at all.
				await page
					.locator('[aria-roledescription="slide"] [aria-roledescription="chart"] svg')
					.first()
					.waitFor({ timeout: 90_000 });
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
				const raw = diffCharts(referenceCharts, candidateCharts).map(
					(problem) => `[${key}] ${problem}`,
				);
				perBinding.push(
					...applyExclusions(raw, { binding: candidate.framework.name }, KNOWN_DIVERGENCES),
				);
			}
			if (perBinding.length > 0) {
				problems.push(formatDiff(candidate.framework.name, perBinding, 60));
			}
		}

		expect(problems.join('\n\n')).toBe('');
	});
});
