/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The table STYLE DEFINITION editor ("Edit style...", distinct from the
 * style-picker gallery), run identically against every framework demo.
 *
 * Reuses `table-styling.pptx` (COM-authored; see `table-styling.spec.ts`'s own
 * doc) rather than a new fixture: slide 4 carries "No Style, Table Grid",
 * whose Whole-Table fill has no PRE-EXISTING header/band cross-precedence to
 * confuse the "did the fill actually change" reading.
 *
 * The editor panel is located by its i18n contract only (`pptx.tableStyleEditor.*`
 * from `packages/shared/src/i18n/translations-en.ts`), not by a `data-testid`:
 * that attribute exists on four of the five bindings' root panel but not all
 * (see the "needs:" report), so this spec finds the colour input via the
 * nearest ancestor of the "Table Style Editor" heading that also contains one,
 * which works regardless of markup depth.
 *
 * Save/reload uses the existing `savePptxViaBackstage` + `downloadBytes`
 * helpers. Per the brief: if the persistence half fails in a binding, the
 * render half stays a SEPARATE test so it is reported precisely rather than
 * masked.
 *
 * Run: bunx playwright test table-style-editor
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { fixture, inspector, resetTabSession } from './support/deck';
import { downloadBytes } from './support/exports';

const TABLE_FIXTURE = fixture('table-styling.pptx');
/** Slide 4: "No Style, Table Grid" + one mixed-format cell (see table-styling.spec.ts). */
const SLIDE_NUMBER = 4;
/** A cell whose text is stable across slide 4's table, to measure the whole-table fill. */
const SAMPLE_CELL_TEXT = 'R2C1';
const NEW_FILL_HEX = '#FF00FF';
const NEW_FILL_RGB = 'rgb(255, 0, 255)';

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

async function cellBackground(cell: Locator): Promise<string> {
	return cell.evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** Select the TABLE (not a cell): the first press on a cell selects its table. */
async function selectTable(page: Page, cell: Locator): Promise<void> {
	const box = await cell.boundingBox();
	if (!box) {
		throw new Error('sample cell has no layout box');
	}
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(400);
}

/** Open "Edit style..." and return the whole-table fill colour `<input type="color">`. */
async function openWholeTableFillInput(page: Page): Promise<Locator> {
	const editButton = inspector(page).getByRole('button', { name: 'Edit style...', exact: true });
	await expect(editButton).toBeVisible();
	await editButton.click();
	await page.waitForTimeout(300);

	const heading = page.getByText('Table Style Editor', { exact: true });
	await expect(heading).toBeVisible();
	// Nearest ancestor of the heading that also contains a colour input: works
	// regardless of how deeply each binding nests the panel's own markup.
	const panel = heading.locator('xpath=ancestor::*[.//input[@type="color"]][1]');
	const fillInput = panel.locator('input[type="color"]').first();
	await expect(fillInput).toBeVisible();
	return fillInput;
}

/**
 * Set a `<input type="color">`'s value through the native setter and dispatch
 * real events, the same way `theme-color-picker.spec.ts` does: React installs
 * a property descriptor over a controlled input's `.value`, so a plain
 * assignment reads back as a no-op change.
 */
async function setColorInput(input: Locator, hex: string): Promise<void> {
	await input.evaluate((el: HTMLInputElement, value: string) => {
		const nativeSetter = Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			'value',
		)?.set;
		if (nativeSetter) {
			nativeSetter.call(el, value);
		} else {
			el.value = value;
		}
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.dispatchEvent(new Event('change', { bubbles: true }));
	}, hex);
}

async function loadAt(page: Page, deck: string): Promise<void> {
	await resetTabSession(page);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[aria-label="Go to slide 1"]').first().waitFor({ timeout: 60_000 });
	await page.waitForTimeout(800);
}

test.describe('table style editor: whole-table fill', () => {
	test('changing the whole-table fill repaints the table', async ({ page }) => {
		await loadAt(page, TABLE_FIXTURE);
		await gotoSlide(page, SLIDE_NUMBER);

		const cell = canvasCell(page, SAMPLE_CELL_TEXT);
		await cell.waitFor();
		const before = await cellBackground(cell);

		await selectTable(page, cell);
		await expect(inspector(page)).toBeVisible();
		const fillInput = await openWholeTableFillInput(page);
		await setColorInput(fillInput, NEW_FILL_HEX);

		await expect.poll(() => cellBackground(canvasCell(page, SAMPLE_CELL_TEXT))).toBe(NEW_FILL_RGB);
		expect(await cellBackground(canvasCell(page, SAMPLE_CELL_TEXT))).not.toBe(before);
	});

	test('the changed fill survives an export/reload round trip', async ({ page }) => {
		await loadAt(page, TABLE_FIXTURE);
		await gotoSlide(page, SLIDE_NUMBER);

		const cell = canvasCell(page, SAMPLE_CELL_TEXT);
		await cell.waitFor();
		await selectTable(page, cell);
		await expect(inspector(page)).toBeVisible();
		const fillInput = await openWholeTableFillInput(page);
		await setColorInput(fillInput, NEW_FILL_HEX);
		await expect.poll(() => cellBackground(canvasCell(page, SAMPLE_CELL_TEXT))).toBe(NEW_FILL_RGB);

		const download = await savePptxViaBackstage(page);
		const bytes = await downloadBytes(download);
		const savedPath = await download.path();
		expect(bytes.length, 'the saved .pptx must not be empty').toBeGreaterThan(0);
		expect(savedPath, 'the browser must retain the downloaded file').not.toBeNull();

		await loadAt(page, savedPath!);
		await gotoSlide(page, SLIDE_NUMBER);
		const reloadedCell = canvasCell(page, SAMPLE_CELL_TEXT);
		await reloadedCell.waitFor();
		expect(await cellBackground(reloadedCell)).toBe(NEW_FILL_RGB);
	});
});
