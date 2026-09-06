/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Element-level accessibility fields (alt text + title) on graphic-frame
 * elements (table, chart), run identically against every framework demo.
 *
 * Sibling of `element-accessibility.spec.ts`, which covers a plain shape,
 * text box and connector; this closes the last gap in the limitations row for
 * "altText/title accessibility fields": every binding's inspector shows the
 * same Accessibility section (alt text + title) for a table/chart/smartArt/
 * media/ole selection, not only for a shape/text/connector. `shared`'s
 * `shouldShowAccessibilitySection` (`packages/shared/src/render/
 * element-non-visual-description.ts`) is the single decision every binding
 * consumes.
 *
 * Reuses two existing fixtures rather than adding a new one:
 * - `table-styling.pptx` (slide 4, "No Style, Table Grid"; see
 *   `table-style-editor.spec.ts`), whose graphic frame is named "Table 1".
 * - `chart-title-runs.pptx` (a pie chart; see `chart-title-runs.spec.ts`),
 *   whose graphic frame is named "Pie Chart".
 *
 * The two accessibility inputs are located by their i18n placeholder contract
 * (`pptx.elementAccessibility.*Placeholder`), same as the sibling spec: a
 * chart's own data "Title" field labels itself differently ("Title", no
 * placeholder contract), so the two never collide even though both can be
 * visible on a chart's inspector at once.
 *
 * Run: bunx playwright test element-accessibility-graphic-frame
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { fixture, inspector, loadDeck, selectElement } from './support/deck';
import { downloadBytes } from './support/exports';
import { extractElementBlock, readZipPartText } from './support/pptx-xml';

const TABLE_FIXTURE = fixture('table-styling.pptx');
const CHART_FIXTURE = fixture('chart-title-runs.pptx');
const ALT_TEXT = 'A quarterly figures table, described for screen readers';
const TITLE = 'Quarterly figures';

/** Slide 4 of `table-styling.pptx`: "No Style, Table Grid" (see `table-style-editor.spec.ts`). */
const TABLE_SLIDE_NUMBER = 4;
const TABLE_SAMPLE_CELL_TEXT = 'R2C1';
const TABLE_FRAME_NAME = 'Table 1';
const CHART_FRAME_NAME = 'Pie Chart';

function altTextInput(page: Page): Locator {
	return inspector(page)
		.getByPlaceholder('Describe this element for accessibility', { exact: true })
		.locator('visible=true')
		.first();
}

function titleInput(page: Page): Locator {
	return inspector(page)
		.getByPlaceholder('Accessibility title (optional)', { exact: true })
		.locator('visible=true')
		.first();
}

async function fillAndCommit(input: Locator, value: string): Promise<void> {
	await expect(input).toBeVisible();
	await input.fill(value);
	// Every binding commits these fields on change/blur, not per keystroke.
	await input.press('Tab');
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(500);
}

/** The `<td>`/`<th>` on the main canvas whose text is exactly `text`. */
function canvasCell(page: Page, text: string): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('td, th')
		.filter({ hasText: new RegExp(`^\\s*${text}\\s*$`, 'u') })
		.first();
}

/** Select the TABLE (not a cell): the first press on a cell selects its table. */
async function selectTable(page: Page): Promise<void> {
	const cell = canvasCell(page, TABLE_SAMPLE_CELL_TEXT);
	const box = await cell.boundingBox();
	if (!box) {
		throw new Error('sample cell has no layout box');
	}
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(400);
	await expect(inspector(page)).toBeVisible();
}

/** Select the chart's graphic frame on the canvas. */
async function selectChart(page: Page): Promise<void> {
	const chart = page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
	await chart.waitFor();
	await page.waitForTimeout(300);
	// Selected via the shared accessibility contract, not `data-pptx-element`:
	// see `chart-title-runs.spec.ts` for why (two bindings do not tag a
	// chart's graphic frame as an element).
	await selectElement(page, chart);
	await expect(inspector(page)).toBeVisible();
}

test.describe('element accessibility on a graphic frame (table)', () => {
	test('the inspector exposes editable alt text and title for a table', async ({ page }) => {
		await loadDeck(page, TABLE_FIXTURE);
		await gotoSlide(page, TABLE_SLIDE_NUMBER);
		await selectTable(page);

		await fillAndCommit(altTextInput(page), ALT_TEXT);
		await fillAndCommit(titleInput(page), TITLE);
		await page.waitForTimeout(300);

		// Deselect and reselect: the value must come back from the model, not
		// from the input's own uncommitted state.
		await page.mouse.click(5, 5);
		await page.waitForTimeout(200);
		await selectTable(page);
		await expect(altTextInput(page)).toHaveValue(ALT_TEXT);
		await expect(titleInput(page)).toHaveValue(TITLE);
	});

	test('both fields reach the table graphic frame p:cNvPr and survive a reload', async ({
		page,
	}) => {
		await loadDeck(page, TABLE_FIXTURE);
		await gotoSlide(page, TABLE_SLIDE_NUMBER);
		await selectTable(page);
		await fillAndCommit(altTextInput(page), ALT_TEXT);
		await fillAndCommit(titleInput(page), TITLE);
		await page.waitForTimeout(300);

		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);
		const savedPath = await download.path();
		expect(bytes.length, 'the saved .pptx must not be empty').toBeGreaterThan(0);
		expect(savedPath, 'the browser must retain the downloaded file').not.toBeNull();

		const slideXml = await readZipPartText(bytes, `ppt/slides/slide${TABLE_SLIDE_NUMBER}.xml`);
		const frame = extractElementBlock(slideXml, 'p:graphicFrame', TABLE_FRAME_NAME);
		const cNvPr = /<p:cNvPr\b[^>]*>/u.exec(frame)?.[0] ?? '';
		expect(cNvPr).toContain(`descr="${ALT_TEXT}"`);
		expect(cNvPr).toContain(`title="${TITLE}"`);

		await loadDeck(page, savedPath!);
		await gotoSlide(page, TABLE_SLIDE_NUMBER);
		await selectTable(page);
		await expect(altTextInput(page)).toHaveValue(ALT_TEXT);
		await expect(titleInput(page)).toHaveValue(TITLE);
	});
});

test.describe('element accessibility on a graphic frame (chart)', () => {
	test('the inspector exposes editable alt text and title for a chart', async ({ page }) => {
		await loadDeck(page, CHART_FIXTURE);
		await selectChart(page);

		await fillAndCommit(altTextInput(page), ALT_TEXT);
		await fillAndCommit(titleInput(page), TITLE);
		await page.waitForTimeout(300);

		await page.mouse.click(5, 5);
		await page.waitForTimeout(200);
		await selectChart(page);
		await expect(altTextInput(page)).toHaveValue(ALT_TEXT);
		await expect(titleInput(page)).toHaveValue(TITLE);
	});

	test('both fields reach the chart graphic frame p:cNvPr and survive a reload', async ({
		page,
	}) => {
		await loadDeck(page, CHART_FIXTURE);
		await selectChart(page);
		await fillAndCommit(altTextInput(page), ALT_TEXT);
		await fillAndCommit(titleInput(page), TITLE);
		await page.waitForTimeout(300);

		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);
		const savedPath = await download.path();
		expect(bytes.length, 'the saved .pptx must not be empty').toBeGreaterThan(0);
		expect(savedPath, 'the browser must retain the downloaded file').not.toBeNull();

		const slideXml = await readZipPartText(bytes, 'ppt/slides/slide1.xml');
		const frame = extractElementBlock(slideXml, 'p:graphicFrame', CHART_FRAME_NAME);
		const cNvPr = /<p:cNvPr\b[^>]*>/u.exec(frame)?.[0] ?? '';
		expect(cNvPr).toContain(`descr="${ALT_TEXT}"`);
		expect(cNvPr).toContain(`title="${TITLE}"`);

		await loadDeck(page, savedPath!);
		await selectChart(page);
		await expect(altTextInput(page)).toHaveValue(ALT_TEXT);
		await expect(titleInput(page)).toHaveValue(TITLE);
	});
});
