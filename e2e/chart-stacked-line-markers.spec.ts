/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for a real-world stacked-line-chart construct (found on
 * slide 21 of a user-supplied deck, `ppt/charts/chart3.xml`) that produced
 * three visible defects, run identically against every framework demo:
 *
 *   1. No gridlines: `<c:valAx><c:majorGridlines/>` with no `c:spPr` and no
 *      attributes parses via fast-xml-parser to an empty STRING, which
 *      `chart-axis-parser.ts`'s old truthy-object presence check treated as
 *      absent (fixed: `hasLocalName`).
 *   2. Plain circle markers instead of PowerPoint's automatic per-series
 *      shape: neither series authors a `c:symbol`, and PowerPoint (COM
 *      verified) renders series `c:idx` 1 as a SQUARE and `c:idx` 2 as a
 *      TRIANGLE (fixed: `PptxChartSeries.idx` + the automatic marker cycle
 *      in `chart-datapoint-style.ts`).
 *   3. Legend text at the wrong (tiny, hardcoded) size: `<c:legend><c:txPr>`
 *      authors an 18pt font for the whole legend, never parsed before
 *      (fixed: `parseChartLegendStyle` + `applyLegendEntryOverrides`'s
 *      `legendBaseStyle`).
 *
 * `e2e/fixtures/chart-stacked-line-markers.pptx`
 * (generate-chart-stacked-line-markers-fixture.ts) reproduces the construct
 * with synthetic data (the source deck is personal content unrelated to this
 * repo). All three were root-caused and fixed in `packages/shared/src/render`
 * and `packages/core/src/core/utils`, consumed identically by every binding,
 * so this spec runs unmodified across all five framework demos.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	CHART_STACKED_LINE_SERIES_A_NAME,
	CHART_STACKED_LINE_SERIES_B_NAME,
	CHART_STACKED_LINE_TITLE,
} from './fixtures/generate-chart-stacked-line-markers-fixture';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/chart-stacked-line-markers.pptx', import.meta.url)),
);

async function openDeck(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor({ timeout: 15_000 });
}

test.describe('stacked line chart with automatic markers, bare gridlines, and a legend font', () => {
	test('renders gridlines, non-circle markers, and the authored legend font size', async ({
		page,
	}) => {
		await openDeck(page);

		// The title lives in its own text-box shape, separate from the chart's
		// graphic frame, so it's asserted on the page rather than inside the
		// chart element.
		await expect(
			page.locator('[data-pptx-viewport]'),
			'deck loaded past the placeholder state',
		).toContainText(CHART_STACKED_LINE_TITLE);

		const chartEl = page
			.locator('[data-pptx-viewport] [data-element-id]:visible:has(svg)')
			.filter({ hasText: CHART_STACKED_LINE_SERIES_A_NAME })
			.first();
		await chartEl.waitFor({ timeout: 15_000 });
		const svg = chartEl.locator('svg').first();

		// (1) Gridlines: the bare `<c:majorGridlines/>` must still produce
		// horizontal gridline `<line>` elements across the plot.
		const gridlineCount = await svg.locator('line').count();
		expect(gridlineCount, 'major gridlines render for a bare <c:majorGridlines/>').toBeGreaterThan(
			0,
		);

		// (2) Markers: series A (c:idx=1) resolves to a square (rect), series B
		// (c:idx=2) to a triangle (polygon); neither should be a plain circle.
		expect(
			await svg.locator('rect').count(),
			'series A (idx=1) draws square markers, not circles',
		).toBeGreaterThan(0);
		expect(
			await svg.locator('polygon').count(),
			'series B (idx=2) draws triangle markers, not circles',
		).toBeGreaterThan(0);

		// (3) Legend font: the "A"/"B" legend labels render at the authored 18pt
		// (24px at 96/72 CSS px-per-pt), not the renderer's old 9px hardcoded
		// default.
		const legendLabelA = svg.locator('text', { hasText: CHART_STACKED_LINE_SERIES_A_NAME }).last();
		await expect(legendLabelA, 'legend label "A" is present').toHaveCount(1);
		const fontSize = await legendLabelA.evaluate((el) =>
			Number.parseFloat(getComputedStyle(el).fontSize),
		);
		expect(
			fontSize,
			'legend label renders at the authored ~18pt size, not the 9px default',
		).toBeGreaterThan(15);

		const legendLabelB = svg.locator('text', { hasText: CHART_STACKED_LINE_SERIES_B_NAME }).last();
		await expect(legendLabelB, 'legend label "B" is present').toHaveCount(1);
	});
});
