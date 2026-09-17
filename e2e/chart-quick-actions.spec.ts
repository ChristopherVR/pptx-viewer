/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeckAt, resetTabSession, selectElement } from './support/deck';
import { acrossFrameworks } from './support/parity';

/**
 * PowerPoint's three floating quick-action icons shown just outside a
 * selected chart's top-right corner: "Chart Elements" (+, a checklist for
 * title/legend/gridlines/data-labels/axes/axis-titles), "Chart Styles" (a
 * one-click recolour gallery), and "Chart Filters" (a funnel-shaped
 * series show/hide list).
 *
 * All three are backed by `pptx-viewer-shared`'s
 * `buildChartQuickActionsDescriptor` (`chart-quick-actions.ts`) plus its
 * mutation helpers (`chart-quick-action-toggles.ts`,
 * `chart-quick-action-styles.ts`, and the existing `chart-ext-editor-actions.ts`
 * hide/restore-series functions), so this spec exists to prove the SAME
 * on-canvas behaviour in every binding rather than five separate
 * implementations. `chart-filtered-series.pptx` (COM-authored, see
 * `chart-filtered-series.spec.ts`) already carries 2 visible + 1
 * filtered series, which doubles as Chart Filters fixture data.
 */
const FIXTURE = resolve(
	fileURLToPath(new URL('./fixtures/chart-filtered-series.pptx', import.meta.url)),
);

/** Rendered SVG `<text>` contents inside the chart (legend labels, title, ...). */
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

/** The `fill` of the first plotted data mark (series 0, point 0), or null. */
async function firstMarkFill(page: Page): Promise<string | null> {
	return page.evaluate(() => {
		const mark = document
			.querySelector('[aria-roledescription="slide"]')
			?.querySelector('[aria-roledescription="chart"] svg')
			?.querySelector('[data-chart-part="dataPoint"][data-chart-series="0"]');
		return mark?.getAttribute('fill') ?? null;
	});
}

async function selectChart(page: Page, origin: string): Promise<void> {
	await resetTabSession(page);
	await loadDeckAt(page, origin, FIXTURE);
	const chart = page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
	await chart.waitFor();
	await page.waitForTimeout(300);
	await selectElement(page, chart);
	await expect(page.locator('[data-testid="chart-quick-action-elements"]')).toBeVisible();
}

test.describe('chart quick actions (Elements/Styles/Filters)', () => {
	test('all three quick-action buttons appear when a chart is selected', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await selectChart(page, origin);
			return {
				elements: await page.locator('[data-testid="chart-quick-action-elements"]').isVisible(),
				styles: await page.locator('[data-testid="chart-quick-action-styles"]').isVisible(),
				filters: await page.locator('[data-testid="chart-quick-action-filters"]').isVisible(),
			};
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.elements, `${where} Chart Elements button`).toBe(true);
			expect(value.styles, `${where} Chart Styles button`).toBe(true);
			expect(value.filters, `${where} Chart Filters button`).toBe(true);
		}
	});

	test('Chart Elements: unchecking legend removes it from the rendered chart', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await selectChart(page, origin);
			const before = await chartTexts(page);

			await page.locator('[data-testid="chart-quick-action-elements"]').click();
			const legendCheckbox = page.locator('[data-testid="chart-quick-element-legend"]');
			await expect(legendCheckbox).toBeVisible();
			await expect(legendCheckbox).toBeChecked();
			await legendCheckbox.uncheck();

			await expect.poll(async () => (await chartTexts(page)).join('|')).not.toContain('Series A');
			const after = await chartTexts(page);
			return { before, after };
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.before.join('|'), `${where} legend before toggling off`).toContain('Series A');
			expect(value.after.join('|'), `${where} legend after toggling off`).not.toContain('Series A');
		}
	});

	test('Chart Filters: hiding a series reduces the plotted mark count', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await selectChart(page, origin);
			const before = await dataPointCount(page);

			await page.locator('[data-testid="chart-quick-action-filters"]').click();
			const seriesRow = page.locator('[data-testid="chart-quick-filter-visible-0"]');
			await expect(seriesRow).toBeVisible();
			await expect(seriesRow).toBeChecked();
			// A plain click, not `.uncheck()`: hiding the FIRST visible series
			// shifts every remaining visible series down by one index, so the
			// SAME testid ("visible-0") now names a different series' checkbox
			// (still checked). `.uncheck()`'s own follow-up assertion re-queries
			// that testid and would misread the shift as "click had no effect";
			// the real assertion here is the mark-count poll below.
			await seriesRow.click();

			await expect.poll(async () => dataPointCount(page)).toBeLessThan(before);
			return { before, after: await dataPointCount(page) };
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.after, `${where} marks after hiding a series`).toBeLessThan(value.before);
		}
	});

	test('Chart Styles: applying a preset recolours the plotted marks', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await selectChart(page, origin);
			const before = await firstMarkFill(page);

			await page.locator('[data-testid="chart-quick-action-styles"]').click();
			const preset = page.locator('[data-testid="chart-quick-style-monochrome"]');
			await expect(preset).toBeVisible();
			await preset.click();

			await expect.poll(() => firstMarkFill(page)).not.toBe(before);
			return { before, after: await firstMarkFill(page) };
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;
			expect(value.after, `${where} mark fill after applying a style preset`).not.toBe(
				value.before,
			);
		}
	});
});
