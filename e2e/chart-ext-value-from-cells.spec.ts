/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { inspector, loadDeckAt, resetTabSession, selectElement } from './support/deck';
import { acrossFrameworks } from './support/parity';

/**
 * PowerPoint 2013+'s "Value From Cells" custom data labels
 * (`c15:datalabelsRange`/`c15:dlblRangeCache`) and Chart Filters series
 * show/hide (`c15:filteredBarSeries` + `c15:filteredSeriesTitle`), the last
 * passthrough-only rows of the "Office chart extensions" limitations.md
 * entry. `chart-ext-datalabels-range.pptx` is a COM-authored column chart
 * (`Series.DataLabels.ShowRange = True`, verified via PowerPoint COM to
 * round-trip as a real `c15:showDataLabelsRange` flag) with the range
 * formula/cache and a per-point `c15:xForSave` hand-authored alongside it
 * per the published [MS-ODRAWXML] schema (see
 * `scripts/make-chart-ext-fixtures.ps1`).
 *
 * Both the render (label text from the cache) and the edit (inspector's
 * `chart-dlbl-range-*`/`chart-series-hide-*`/`chart-series-show-*` controls,
 * `pptx-viewer-shared`'s `chart-ext-editor-actions.ts`) are shared logic, so
 * this proves the SAME behaviour in all five bindings rather than five
 * separate implementations.
 */
const DATALABELS_RANGE_FIXTURE = resolve(
	fileURLToPath(new URL('./fixtures/chart-ext-datalabels-range.pptx', import.meta.url)),
);
const FILTERED_TITLES_FIXTURE = resolve(
	fileURLToPath(new URL('./fixtures/chart-ext-filtered-titles.pptx', import.meta.url)),
);

/** Every rendered SVG `<text>` node's trimmed content inside the chart. */
async function chartTexts(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		const svg = stage?.querySelector('[aria-roledescription="chart"] svg');
		if (!svg) {
			return [];
		}
		return [...svg.querySelectorAll('text')]
			.map((node) => (node.textContent ?? '').trim())
			.filter((t) => t.length > 0);
	});
}

/** Number of `data-chart-part="dataPoint"` marks plotted inside the chart. */
async function dataPointCount(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			document
				.querySelector('[aria-roledescription="slide"]')
				?.querySelector('[aria-roledescription="chart"] svg')
				?.querySelectorAll('[data-chart-part="dataPoint"]').length ?? 0,
	);
}

async function openChartInspector(page: Page, origin: string, fixturePath: string): Promise<void> {
	await resetTabSession(page);
	await loadDeckAt(page, origin, fixturePath);
	const chart = page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
	await chart.waitFor();
	await page.waitForTimeout(300);
	await selectElement(page, chart);
	await expect(inspector(page)).toBeVisible();
}

test.describe('chart extensions: Value From Cells + Chart Filters', () => {
	test('the rendered label text comes from the c15:dlblRangeCache cache', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openChartInspector(page, origin, DATALABELS_RANGE_FIXTURE);
			await expect.poll(async () => (await chartTexts(page)).length).toBeGreaterThan(0);
			return await chartTexts(page);
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.join('|'), `${where} rendered chart text`).toContain('Low');
		}
	});

	test('editing a cached label in the inspector updates the rendered text live', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openChartInspector(page, origin, DATALABELS_RANGE_FIXTURE);
			const input = inspector(page).locator('[data-testid="chart-dlbl-range-0-1"]');
			await expect(input).toBeVisible();
			await expect(input).toHaveValue('Medium');
			await input.fill('Renamed');
			await input.press('Tab');
			await expect.poll(async () => (await chartTexts(page)).join('|')).toContain('Renamed');
			return await chartTexts(page);
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.join('|'), `${where} rendered chart text after edit`).toContain('Renamed');
			expect(value.join('|'), `${where} the old cached text must be gone`).not.toContain('Medium');
		}
	});

	test('hiding then restoring a series updates the plotted mark count', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await openChartInspector(page, origin, FILTERED_TITLES_FIXTURE);
			const before = await dataPointCount(page);

			const hideButton = inspector(page).locator('[data-testid="chart-series-hide-0"]');
			await expect(hideButton).toBeVisible();
			await hideButton.click();
			await expect.poll(async () => dataPointCount(page)).toBeLessThan(before);
			const afterHide = await dataPointCount(page);

			const showButton = inspector(page).locator('[data-testid="chart-series-show-0"]');
			await expect(showButton).toBeVisible();
			await showButton.click();
			await expect.poll(async () => dataPointCount(page)).toBeGreaterThan(afterHide);
			const afterRestore = await dataPointCount(page);

			return { before, afterHide, afterRestore };
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.afterHide, `${where} marks after hiding`).toBeLessThan(value.before);
			expect(value.afterRestore, `${where} marks after restoring`).toBe(value.before);
		}
	});
});
