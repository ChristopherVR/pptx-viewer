/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Insert > Chart > Bar: category-label clipping regression, run identically
 * across every framework demo.
 *
 * A freshly inserted horizontal-bar chart's default category labels
 * ("Category 1"/2/3, from `createDefaultChartElement` in
 * packages/shared/src/render/insert-chart.ts) are far wider, at the axis font
 * size, than the 40px band `computePlotLayout` reserved for a value axis's
 * short numeric ticks. PowerPoint's "Bar" chart type transposes the chart
 * (categories run down the LEFT, not along the bottom, values along the
 * bottom), so that inset is what the category TEXT sits in, not a numeric
 * tick, and the label rendered with its own left edge past the chart's own
 * SVG boundary: "Category 1" visually read as "egory 1" on screen, even
 * though its DOM text content was never truncated, only drawn starting
 * off-canvas. See `packages/shared/src/render/chart-view-model-layout.ts`'s
 * `leftAxisBand` and `chart-horizontal-bars-helpers.ts`'s
 * `widestCategoryLabelWidth`, which is why a plain `toContainText` assertion
 * would not have caught this: it checks the DOM string, not where the glyphs
 * actually painted.
 *
 * Framework-neutral by construction: every binding renders the same `<svg>`
 * chart view-model straight out of `pptx-viewer-shared`, and the ribbon
 * "Insert > Chart" control exposes the identical ARIA "Chart type" combobox +
 * "Chart" button in all five demos.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openRibbonTab, resetTabSession, viewport } from './support/deck';

async function newBlankPresentation(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens straight into the
	// viewer and the landing page's "New Presentation" button never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page
		.getByRole('button', { name: /new presentation/iu })
		.first()
		.click();
	await expect(viewport(page)).toBeVisible();
}

test('a freshly inserted Bar chart keeps its category labels inside the chart svg', async ({
	page,
}) => {
	await newBlankPresentation(page);
	await openRibbonTab(page, 'Insert');

	await page.getByRole('combobox', { name: /chart type/iu }).selectOption({ label: 'Bar' });
	await page.getByRole('button', { name: 'Chart', exact: true }).click();

	// Sanity: the chart actually rendered as data marks, not an empty/broken
	// insert (which would make the label check below pass for the wrong
	// reason: no label placed at all, rather than one placed correctly).
	const bars = page.locator('svg rect[data-chart-part="dataPoint"]');
	await expect(bars.first()).toBeVisible();
	expect(await bars.count(), 'bar chart data rects rendered').toBeGreaterThan(0);

	// Every default category label ("Category 1"/2/3) must paint with its own
	// left-most ink at or right of the chart svg's left edge (x=0 in the
	// svg's own coordinate space, which IS the element's pixel frame: see
	// `computePlotLayout`'s viewBox doc comment). `getBBox()` measures the
	// GLYPHS as actually laid out, so this catches the label being pushed
	// off-canvas even though its DOM text content is complete either way.
	for (const label of ['Category 1', 'Category 2', 'Category 3']) {
		// eslint-disable-next-line no-await-in-loop -- each check depends on the same chart instance; sequential is clearer than Promise.all here
		const locator = page.locator('svg text', { hasText: label }).first();
		// eslint-disable-next-line no-await-in-loop -- see above
		await expect(locator, `${label} renders`).toBeVisible();
		// eslint-disable-next-line no-await-in-loop -- see above
		const left = await locator.evaluate((node) => (node as SVGGraphicsElement).getBBox().x);
		expect(
			left,
			`${label} left edge (${left}) must not be clipped off the chart's left edge`,
		).toBeGreaterThanOrEqual(-0.5);
	}
});
