/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Chart title rich text (`c:title/c:tx/c:rich` with several `c:r` runs), run
 * identically against every framework demo.
 *
 * The fixture (`chart-title-runs.pptx`, `e2e/fixtures/generate-chart-title-
 * runs-fixture.ts`) is a pie chart whose title carries two runs: "Sales "
 * (bold) then "Overview" (italic, red). The shared `resolveChartTitleRunSpans`
 * (`packages/shared/src/render/chart-title-runs.ts`) resolves those into
 * per-run `<tspan>` descriptors every binding's chart SVG paints, instead of
 * collapsing the title to one flat string in a single style.
 *
 * The chart is deliberately a PIE (see the fixture generator's doc): a pie
 * has no axes, so `ChartAxisOptions` / `ChartAxisStyleOptions` render nothing
 * and the inspector's chart-data "Title" field is the only field labelled
 * "Title" on the panel (the axis-title field shares that exact string).
 *
 * `collapseChartTitleRunsForEdit` is the write-side companion: editing the
 * flat title through the inspector must collapse the multi-run body to ONE
 * run in the dominant style, not leave a second, stale run trailing the new
 * text.
 *
 * Run: bunx playwright test chart-title-runs
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	CHART_TITLE_RUN_1,
	CHART_TITLE_RUN_2,
	EDITED_TITLE,
} from './fixtures/generate-chart-title-runs-fixture';
import { fixture, inspector, loadDeck, selectElement } from './support/deck';

const CHART_FIXTURE = fixture('chart-title-runs.pptx');

interface TitleTspan {
	text: string;
	fontWeight: string;
	fontStyle: string;
	fill: string;
}

/** Every `<tspan>` inside the chart's title `<text>` node (`data-chart-part="title"`). */
async function titleTspans(page: Page): Promise<TitleTspan[]> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		const titleText = stage?.querySelector('svg [data-chart-part="title"]');
		if (!titleText) {
			return [];
		}
		return [...titleText.querySelectorAll('tspan')].map((node) => {
			const style = getComputedStyle(node);
			return {
				text: (node.textContent ?? '').trim(),
				fontWeight: style.fontWeight,
				fontStyle: style.fontStyle,
				fill: style.fill,
			};
		});
	});
}

async function openChart(page: Page): Promise<void> {
	await loadDeck(page, CHART_FIXTURE);
	await page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first()
		.waitFor();
	await page.waitForTimeout(300);
}

test.describe('chart title rich text (multi-run titles)', () => {
	test('renders one tspan per authored run, with its own bold/italic/colour', async ({ page }) => {
		await openChart(page);

		const tspans = await titleTspans(page);
		expect(tspans.length, `expected 2 title tspans, got ${JSON.stringify(tspans)}`).toBe(2);

		const [first, second] = tspans;
		expect(first.text).toBe(CHART_TITLE_RUN_1.trim());
		expect(Number(first.fontWeight)).toBeGreaterThanOrEqual(700);

		expect(second.text).toBe(CHART_TITLE_RUN_2);
		expect(second.fontStyle).toBe('italic');
		expect(second.fill).toBe('rgb(255, 0, 0)');
	});

	test('editing the flat title through the inspector collapses to one run', async ({ page }) => {
		await openChart(page);

		// Selected via the shared accessibility contract, not `data-pptx-element`:
		// two bindings do not tag a chart's graphic frame as an element (see
		// `support/svg-fingerprint.ts`'s `taggedAsElement`), so an element-marker
		// locator would silently find no chart in those two.
		const chart = page
			.locator('[aria-roledescription="slide"]')
			.first()
			.locator('[aria-roledescription="chart"]')
			.first();
		await selectElement(page, chart);
		await expect(inspector(page)).toBeVisible();

		// `visible=true`: the vanilla inspector keeps every section in the DOM and
		// toggles `hidden` (its Accessibility section also owns a "Title" field), so
		// a bare `.first()` would land on that hidden input in DOM order.
		const titleInput = inspector(page)
			.getByLabel('Title', { exact: true })
			.locator('visible=true')
			.first();
		await expect(titleInput).toBeVisible();
		await titleInput.fill(EDITED_TITLE);
		await titleInput.press('Tab');
		await page.waitForTimeout(400);

		await expect
			.poll(async () => {
				const tspans = await titleTspans(page);
				return tspans.map((t) => t.text).join('|');
			})
			.toBe(EDITED_TITLE);

		const tspans = await titleTspans(page);
		expect(tspans.length, 'a collapsed multi-run title must render as a single run').toBe(1);
	});
});
