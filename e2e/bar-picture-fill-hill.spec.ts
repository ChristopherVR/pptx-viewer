/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A real-world "hill/mountain silhouette" bar chart: ONE category, SIX
 * series, each drawn with a bare `c:spPr/a:blipFill` picture fill and NO
 * `c:pictureOptions` sibling at all - PowerPoint's own default "stretch, no
 * stack" picture fill when the format pane's stack settings are never
 * touched. `c:gapWidth val="5"`/`c:overlap val="23"` pack the six bars close
 * enough to visually merge into a continuous silhouette.
 *
 * Before this fix, this construct rendered "entirely different" from
 * PowerPoint two independent ways:
 *
 * 1. The picture fill was silently dropped (the parser required
 *    `c:pictureOptions` to notice a picture fill at all), so every bar fell
 *    back to a flat palette colour - see `PptxHandlerRuntimeChartParsing.ts`'s
 *    `impliedSeriesPicture` and `chart-datapoint-style.ts`'s
 *    `resolveActiveDataPointPicture`.
 * 2. `c:gapWidth`/`c:overlap` sizing divided the bar width by the raw series
 *    count even at high overlap, so a six-series cluster rendered far too
 *    narrow (COM-verified: PowerPoint's cluster-width-to-bar-width ratio is
 *    `1 + (seriesCount - 1) * (1 - overlap / 100)`, independent of the
 *    `c:gapWidth` term) - see `chart-cartesian-bars.ts`'s `buildBars`.
 *
 * This spec asserts both fixes hold, identically, across all five bindings:
 * every bar paints a `url(#...)` pattern fill (not a solid palette colour),
 * all six bars share one width, and the overlapped cluster's total span
 * matches the COM-verified ratio.
 *
 * Run: bunx playwright test bar-picture-fill-hill
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';
import { fingerprintCharts } from './support/svg-fingerprint';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('bar-picture-fill-hill.pptx');
const SERIES_COUNT = 6;
const OVERLAP_PERCENT = 23;
/** COM-verified: cluster span / one bar's width, independent of c:gapWidth. */
const EXPECTED_CLUSTER_RATIO = 1 + (SERIES_COUNT - 1) * (1 - OVERLAP_PERCENT / 100);

test.describe('bar chart picture fill with no c:pictureOptions (hill silhouette)', () => {
	test('every binding paints all 6 bars as picture-filled patterns, sized and overlapped identically', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, FIXTURE);
			await slideStage(page).waitFor();
			await page
				.locator('[aria-roledescription="slide"] [aria-roledescription="chart"] svg')
				.first()
				.waitFor({ timeout: 20_000 });
			return fingerprintCharts(page);
		});

		const failures = results.flatMap(({ framework, value: charts }) => {
			if (charts.length === 0) {
				return [`${framework.name}: no chart rendered at all`];
			}
			const allRects = charts[0].shapes.filter((s) => s.tag === 'rect' && s.geometry.length === 4);
			// Fix 1: every bar paints a pattern (the picture fill), never a solid
			// palette colour. Filtering on `url(...)` here (rather than asserting
			// the raw rect count) also excludes the plot area's own background
			// rect, which is a plain (non-bar) solid-fill rect painted underneath.
			const rects = allRects.filter((r) => r.fill.startsWith('url('));
			const problems: string[] = [];

			if (rects.length !== SERIES_COUNT) {
				problems.push(
					`expected ${SERIES_COUNT} picture-filled bar rects, found ${rects.length} ` +
						`(${allRects.length} rects total; fills seen: ${allRects.map((r) => r.fill).join(', ')})`,
				);
				return [`${framework.name}: ${problems.join('; ')}`];
			}

			// Fix 2: gapWidth/overlap sizing. All bars share one width, and the
			// overlapped cluster's span matches the COM-verified ratio.
			const sorted = [...rects].sort((a, b) => a.geometry[0] - b.geometry[0]);
			const width = sorted[0].geometry[2];
			const widths = sorted.map((r) => r.geometry[2]);
			if (widths.some((w) => Math.abs(w - width) > 0.5)) {
				problems.push(`bar widths are not uniform: ${widths.join(', ')}`);
			}
			const clusterSpan =
				sorted[sorted.length - 1].geometry[0] +
				sorted[sorted.length - 1].geometry[2] -
				sorted[0].geometry[0];
			const ratio = clusterSpan / width;
			if (Math.abs(ratio - EXPECTED_CLUSTER_RATIO) > 0.05) {
				problems.push(
					`cluster-width-to-bar-width ratio is ${ratio.toFixed(3)}, expected ` +
						`${EXPECTED_CLUSTER_RATIO.toFixed(3)} (COM-verified for ${SERIES_COUNT} series at ` +
						`${OVERLAP_PERCENT}% overlap) - bars are too narrow relative to the cluster`,
				);
			}

			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
