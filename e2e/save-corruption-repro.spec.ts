/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Reproduction spec: save-corruption when combining specific element types.
 *
 * Steps:
 *   1. Add a rectangle shape
 *   2. Add two SmartArt diagrams
 *   3. Edit both SmartArt node texts
 *   4. Add a GIF image
 *   5. Add a table and type into a cell
 *   6. Save as .pptx
 *
 * The resulting file triggers a "needs repair" prompt when opened in
 * PowerPoint. This spec captures the exact editing sequence for debugging.
 *
 * This historical corruption sequence now runs across all five bindings. Its
 * helpers accept each binding's ribbon and insertion semantics while asserting
 * the same saved-file contract. Focused SmartArt behavior is also covered by
 * `smartart-insert-edit.spec.ts`.
 *
 * Run: bunx playwright test save-corruption-repro
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const gifFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/test-image.gif', import.meta.url)),
);
const deckFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)),
);
const outputDir = fileURLToPath(new URL('../test-results/save-corruption/', import.meta.url));

/** Switch to the Insert ribbon tab. */
async function switchToInsertTab(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const insertTab = toolbar.getByRole('tab', { name: 'Insert', exact: true });
	await insertTab.click();
	await page.waitForTimeout(300);
}

/** Insert the rectangle exposed by the current shape picker state. */
async function addRectangleShape(page: Page): Promise<void> {
	await switchToInsertTab(page);
	let rectangle = page.getByRole('button', { name: /^(?:Shape|Rect|Rectangle)$/iu }).first();
	if (!(await rectangle.isVisible().catch(() => false))) {
		await page.getByRole('button', { name: 'Shapes', exact: true }).click();
		rectangle = page.getByRole('menuitem', { name: /Rectangle/iu }).first();
	}
	await expect(rectangle).toBeVisible();
	await rectangle.click();
	await page.waitForTimeout(500);
}

/** Insert a SmartArt via the dialog. Picks the first preset in 'list' category. */
async function addSmartArt(page: Page): Promise<void> {
	await switchToInsertTab(page);
	await page.getByRole('button', { name: 'SmartArt' }).click();
	const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
	await expect(dialog).toBeVisible();
	const presetButton = dialog.getByRole('option').first();
	await expect(presetButton).toBeVisible();
	await presetButton.click();
	await page.waitForTimeout(200);
	await dialog.getByRole('button', { name: /^Insert$/iu }).click();
	await page.waitForTimeout(500);
}

/** Insert an image by setting the hidden file input. */
async function addGifImage(page: Page): Promise<void> {
	await switchToInsertTab(page);
	const chooserPromise = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: /image/iu }).first().click();
	const chooser = await chooserPromise;
	await chooser.setFiles(gifFixturePath);
	await page.waitForTimeout(500);
}

/** Click the Table button to insert a default 3x3 table. */
async function addTable(page: Page): Promise<void> {
	await switchToInsertTab(page);
	await page.getByRole('button', { name: /Table/iu }).first().click();
	await page.waitForTimeout(500);
}

/** Double-click a table cell and type text into it. */
async function editTableCell(page: Page, text: string): Promise<void> {
	// The table element may be obscured by overlapping elements.
	// First, select the table element by clicking on it with force.
	const tableElement = page
		.locator('[data-pptx-viewport] [data-pptx-element="true"]')
		.filter({ has: page.locator('table') });
	if (await tableElement.isVisible({ timeout: 3000 }).catch(() => false)) {
		await selectElement(tableElement.first());
		await page.waitForTimeout(300);
	}

	// Dispatch directly to the main-canvas cell so overlapping inserted elements
	// cannot redirect the gesture to a thumbnail or a higher z-index sibling.
	const cell = page.locator('[data-pptx-viewport] td').first();
	await cell.waitFor({ timeout: 5000 });
	await cell.dispatchEvent('dblclick', { button: 0, clientX: 1, clientY: 1 });
	await page.waitForTimeout(300);

	// Type into the cell input
	const input = page.locator('[data-pptx-viewport] td input[type="text"]');
	await expect(input).toBeVisible({ timeout: 3000 });
	await input.fill(text);
	await page.keyboard.press('Enter');
	await page.waitForTimeout(300);
}

/** Ensure the shared properties inspector is visible. */
async function openInspector(page: Page): Promise<Locator> {
	const inspector = page.locator('[data-pptx-inspector]:visible').first();
	if (!(await inspector.isVisible().catch(() => false))) {
		const toggle = page.getByRole('button', { name: 'Toggle inspector panel', exact: true });
		await expect(toggle).toBeVisible();
		await toggle.click();
	}
	await expect(inspector).toBeVisible();
	return inspector;
}

async function selectElement(element: Locator): Promise<void> {
	const pointer = { button: 0, clientX: 1, clientY: 1, pointerId: 1, pointerType: 'mouse' };
	await element.dispatchEvent('pointerdown', pointer);
	await element.dispatchEvent('pointerup', pointer);
	await element.dispatchEvent('click', { button: 0, clientX: 1, clientY: 1 });
}

test.describe('save corruption reproduction', () => {
	test('rect + 2 smartart + gif + table with cell edit triggers repair in PowerPoint', async ({
		page,
	}, testInfo) => {
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(deckFixturePath);

		// Wait for the editing canvas to appear
		const canvas = page.locator('[aria-roledescription="slide"]');
		await canvas.waitFor({ timeout: 10000 });

		// 1. Add a rectangle shape
		await addRectangleShape(page);

		// Deselect by pressing Escape
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);

		// 2. Add first SmartArt
		await addSmartArt(page);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);

		// 3. Add second SmartArt
		await addSmartArt(page);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);

		// 4. Edit first SmartArt (select then double-click to inline-edit)
		// SmartArt elements stack at the same position, so we use force: true
		// to bypass pointer-event interception from overlapping siblings.
		const smartArtElements = page
			.locator('[data-pptx-viewport]')
			.locator(
				'[data-pptx-element="true"]:is([data-testid^="smartart-"], :has([data-testid^="smartart-"]))',
			);
		await expect(smartArtElements).toHaveCount(2);

		await selectElement(smartArtElements.first());
		await page.waitForTimeout(300);
		const inspector = await openInspector(page);
		const firstNode = inspector.locator('[data-testid="smartart-node-text"]').first();
		await expect(firstNode).toBeVisible();
		await firstNode.fill('SmartArt One');
		await firstNode.press('Tab');
		await expect(smartArtElements.first()).toContainText('SmartArt One');

		// Deselect
		await canvas.click({ position: { x: 10, y: 10 }, force: true });
		await page.waitForTimeout(200);

		// 5. Edit second SmartArt
		await selectElement(smartArtElements.nth(1));
		await page.waitForTimeout(300);
		const secondNode = inspector.locator('[data-testid="smartart-node-text"]').first();
		await expect(secondNode).toBeVisible();
		await secondNode.fill('SmartArt Two');
		await secondNode.press('Tab');
		await expect(smartArtElements.nth(1)).toContainText('SmartArt Two');

		// Deselect
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);

		// 6. Add a GIF image
		await addGifImage(page);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);

		// 7. Add a table
		await addTable(page);
		await page.waitForTimeout(300);

		// 8. Edit a table cell
		await editTableCell(page, 'Test Content');
		await page.waitForTimeout(200);

		// 9. Save the file
		// Switch to File tab and click Save
		const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
		const fileTab = toolbar.getByRole('tab', { name: 'File', exact: true });
		await fileTab.click();
		await page.waitForTimeout(300);

		const downloadPromise = page.waitForEvent('download');
		const saveBtn = page.getByRole('button', { name: 'Save .pptx', exact: true });
		await saveBtn.click();

		const download = await downloadPromise;
		const suggestedName = download.suggestedFilename();
		const projectOutputDir = resolve(outputDir, testInfo.project.name);
		const fs = await import('node:fs/promises');
		await fs.mkdir(projectOutputDir, { recursive: true });
		const savePath = resolve(projectOutputDir, suggestedName || 'corruption-repro.pptx');
		await download.saveAs(savePath);

		// Verify the file was saved (non-zero size)
		const stats = await fs.stat(savePath);
		expect(stats.size).toBeGreaterThan(100);
	});
});
