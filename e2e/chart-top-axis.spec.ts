/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for a real-world bar-chart construct (found on slide 20
 * of a user-supplied deck, `ppt/charts/chart2.xml`) that produced two visible
 * defects, run identically against every framework demo:
 *
 *   1. Category-axis label clipping: the chart's ONLY `c:catAx` carries
 *      `c:axPos val="t"` (PowerPoint draws its tick labels above the plot).
 *      `computePlotLayout` used to reserve the category-label band at the
 *      BOTTOM of the plot regardless of `axPos`, leaving no room above the
 *      plot for the top-positioned labels, which then rendered outside the
 *      chart SVG's own bounds and clipped against its edge.
 *   2. Grey plot background: `c:chartSpace` has no `c:spPr` at all (the
 *      common, deliberately-unstyled case). The bindings used to paint a
 *      synthetic `#0f172a11` wash whenever no fill was recorded; real
 *      PowerPoint renders this fully transparent.
 *
 * `e2e/fixtures/chart-top-axis.pptx` (generate-chart-top-axis-fixture.ts)
 * reproduces the construct with synthetic data (the source deck is personal
 * content unrelated to this repo). Both defects were root-caused and fixed in
 * `packages/shared/src/render` (chart-view-model-layout.ts, chart-axis.ts,
 * chart-area-fill.ts), consumed identically by every binding, so this spec
 * runs unmodified across all five framework demos.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	CHART_TOP_AXIS_CATEGORIES,
	CHART_TOP_AXIS_TITLE,
} from './fixtures/generate-chart-top-axis-fixture';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/chart-top-axis.pptx', import.meta.url)),
);

async function openDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor({ timeout: 15_000 });
}

test.describe('chart with a top-positioned category axis + no chartSpace fill', () => {
	test('does not clip the top category-axis labels and paints no grey background', async ({
		page,
	}) => {
		await openDeck(page);

		// The chart element: the `data-element-id` element that renders an inline
		// <svg> and contains the chart title text (same selection strategy as
		// chart-rendering.spec.ts's `chartElement`).
		const chartEl = page
			.locator('[data-pptx-viewport] [data-element-id]:visible:has(svg)')
			.filter({ hasText: CHART_TOP_AXIS_TITLE })
			.first();
		await chartEl.waitFor({ timeout: 15_000 });
		await expect(chartEl, 'chart renders as a real SVG, not a placeholder').toContainText(
			CHART_TOP_AXIS_TITLE,
		);

		const svg = chartEl.locator('svg').first();
		const svgBox = await svg.boundingBox();
		expect(svgBox, 'chart svg has a layout box').not.toBeNull();

		// (1) Category labels must not clip against the chart's own top edge: each
		// category label's rendered top must fall within the svg's own bounding
		// box, not poke out above it (which is what the pre-fix layout produced -
		// the label band was reserved at the bottom regardless of `axPos="t"`).
		for (const category of CHART_TOP_AXIS_CATEGORIES) {
			const label = svg.locator('text', { hasText: category }).first();
			await expect(label, `"${category}" label is present`).toHaveCount(1);
			const labelBox = await label.boundingBox();
			expect(labelBox, `"${category}" label has a layout box`).not.toBeNull();
			// eslint-disable-next-line jest/no-conditional-in-test -- narrows for TS after the not-null assertions above
			if (!labelBox || !svgBox) {
				continue;
			}
			expect(
				labelBox.y,
				`"${category}" label top (${labelBox.y}) must not sit above the chart svg's own top (${svgBox.y})`,
			).toBeGreaterThanOrEqual(svgBox.y - 1);
		}

		// (2) No grey chart-area wash: the shared engine only ever emits a
		// background rect when `vm.areaFill`/`vm.plotFill` is set, and this
		// fixture's chart declares no fill anywhere, so no such rect should exist
		// at all. Guard both on absence and on the specific legacy wash colour in
		// case a binding still paints its own fallback.
		const washRects = svg.locator('rect[fill="#0f172a11"]');
		expect(await washRects.count(), 'no rect paints the legacy grey chart-area wash').toBe(0);
	});
});
