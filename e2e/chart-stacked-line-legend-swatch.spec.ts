/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Stacked line chart with a non-sequential `c:idx` and partial `c:dPt` marker
 * overrides, run identically against every framework demo (Playwright project
 * per binding; see `playwright.config.ts`).
 *
 * Reproduces a real-world report of two symptoms on this exact construct:
 * (1) the series polylines not rendering, (2) the legend not showing a line
 * sample for each series. Investigation against the real deck (COM-verified
 * against real PowerPoint) found (1) already correct in every binding - the
 * shared stacked-line math plots each series at its running-sum height and
 * matched PowerPoint's own render exactly - and (2) a real, shared-engine gap:
 * every chart kind's legend drew a plain filled-rect swatch, even a
 * line-drawn series PowerPoint samples with a line + marker. See
 * `chart-legend-swatch.ts` in `pptx-viewer-shared`.
 *
 * This spec asserts BOTH: the polylines render with real geometry (a
 * regression guard for the already-correct half), and the legend now draws a
 * `<line>` + marker sample instead of a `<rect>` (the actual fix).
 *
 * Fixture: `stacked-line-legend.pptx`
 * (`e2e/fixtures/generate-stacked-line-legend-fixture.ts`).
 *
 * Run: bunx playwright test chart-stacked-line-legend-swatch
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { SERIES_A_COLOR, SERIES_B_COLOR } from './fixtures/generate-stacked-line-legend-fixture';
import { fixture, loadDeck, slideStage } from './support/deck';

const CHART_FIXTURE = fixture('stacked-line-legend.pptx');

async function chartSvg(page: Page) {
	await loadDeck(page, CHART_FIXTURE);
	const chart = slideStage(page).locator('[aria-roledescription="chart"]').first();
	await chart.waitFor();
	return chart.locator('svg').first();
}

interface LegendSwatch {
	label: string;
	hasRect: boolean;
	hasLine: boolean;
	hasMarker: boolean;
	lineStroke: string | null;
}

async function legendSwatches(svg: ReturnType<Page['locator']>): Promise<LegendSwatch[]> {
	return svg.evaluate((node) => {
		const groups = Array.from(node.querySelectorAll('g')).filter((g) => g.querySelector('text'));
		return groups.map((g) => {
			const line = g.querySelector('line');
			return {
				label: g.querySelector('text')?.textContent?.trim() ?? '',
				hasRect: g.querySelector('rect') !== null,
				hasLine: line !== null,
				hasMarker: g.querySelector('circle, polygon, path, rect') !== null,
				lineStroke: line?.getAttribute('stroke') ?? null,
			};
		});
	});
}

test.describe('stacked line chart: polylines + legend line swatch', () => {
	test('renders both series polylines with real (non-empty) point data', async ({ page }) => {
		const svg = await chartSvg(page);
		const polylines = svg.locator('polyline');
		await expect(polylines).toHaveCount(2);
		for (const points of await polylines.evaluateAll((els) =>
			els.map((el) => el.getAttribute('points')),
		)) {
			expect(points, 'each series polyline must carry real coordinate data').toBeTruthy();
			// Five categories -> five "x,y" pairs.
			expect(points!.trim().split(/\s+/u)).toHaveLength(5);
		}
	});

	test('draws a line + marker legend swatch, not a rect, for each series', async ({ page }) => {
		const svg = await chartSvg(page);
		const swatches = await legendSwatches(svg);
		expect(swatches.map((s) => s.label)).toStrictEqual(['A', 'B']);
		for (const swatch of swatches) {
			expect(swatch.hasRect, `${swatch.label}'s swatch must not be the default rect`).toBe(false);
			expect(swatch.hasLine, `${swatch.label}'s swatch must draw a connecting line`).toBe(true);
			expect(swatch.hasMarker, `${swatch.label}'s swatch must draw a marker`).toBe(true);
		}
		expect(swatches[0].lineStroke?.toUpperCase()).toBe(`#${SERIES_A_COLOR}`);
		expect(swatches[1].lineStroke?.toUpperCase()).toBe(`#${SERIES_B_COLOR}`);
	});

	test('plots series B (order 1) above series A (order 0): stacked, not clustered', async ({
		page,
	}) => {
		const svg = await chartSvg(page);
		const polylines = svg.locator('polyline');
		const [pointsA, pointsB] = await polylines.evaluateAll((els) =>
			els.map((el) => el.getAttribute('points') ?? ''),
		);
		const firstY = (points: string) => Number(points.trim().split(/\s+/u)[0].split(',')[1]);
		// Smaller y = higher on screen. B's running-sum height (A + B) is always
		// greater than A's own height, so B must sit above A at every category.
		expect(firstY(pointsB)).toBeLessThan(firstY(pointsA));
	});
});
