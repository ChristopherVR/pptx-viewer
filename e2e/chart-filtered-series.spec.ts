/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';

import { loadDeckAt, resetTabSession } from './support/deck';
import { acrossFrameworks } from './support/parity';

/**
 * PowerPoint's "Chart Filters" feature (limitations.md "Office chart
 * extensions" row): a series or category hidden from the plot stays in the
 * workbook, as `c15:filteredBarSeries` (a full `c:ser`-shaped node PowerPoint
 * moves out of the plotted `c:ser` list) plus a shortened `c:strCache`/
 * `c:numCache` on every surviving series for the filtered category.
 *
 * `chart-filtered-series.pptx` is COM-authored ground truth
 * (`Series.IsFiltered = True` on series B, `FullCategoryCollection().
 * IsFiltered = True` on one of four categories, on a 3-series column chart).
 * No binding ever reads the filtered-series extension when rendering (see
 * `chart-filtered-series.ts`), so this spec exists to prove that holds for
 * all five, not to test five separate code paths: it counts the plotted data
 * marks and expects exactly 2 visible series x 3 visible categories = 6,
 * never the 9 a chart that also plotted the hidden series would draw.
 */
const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/chart-filtered-series.pptx', import.meta.url)),
);

test.describe('chart filtered-series (Chart Filters)', () => {
	test('every binding plots only the visible series and categories', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await resetTabSession(page);
			await loadDeckAt(page, origin, fixturePath);
			const svg = page.locator('[data-pptx-viewport] [data-element-id] svg').first();
			await svg.waitFor();
			const marks = svg.locator('[data-chart-part="dataPoint"]');
			await expect.poll(async () => marks.count(), { timeout: 5000 }).toBeGreaterThan(0);
			const texts = await svg.evaluate((node) =>
				[...node.querySelectorAll('text')].map((t) => t.textContent ?? ''),
			);
			return { markCount: await marks.count(), texts };
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			// 2 visible series x 3 visible categories. Never 9 (the filtered
			// series plotted too) or 8 (the filtered category not collapsed).
			expect(value.markCount, `${where} plotted data marks`).toBe(6);
			const legendText = value.texts.join('|');
			expect(legendText, `${where} legend/labels`).toContain('Series A');
			expect(legendText, `${where} legend/labels`).toContain('Series C');
			expect(legendText, `${where} filtered series must not render`).not.toContain('Series B');
			expect(legendText, `${where} filtered category must not render`).not.toContain('Cat3');
		}
	});
});
