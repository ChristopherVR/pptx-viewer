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
 * React-only: this is a historical one-off corruption repro whose editing
 * helpers are bound to React's ribbon DOM (`select[title]`, `button[title*=
 * "Shape"]`, the `File` tab, the `Save .pptx` button). It is not a parity test
 * and is skipped on Vue/Angular (see the `test.skip` guard below). Cross-
 * framework SmartArt insertion is covered by `smartart-insert-edit.spec.ts`.
 *
 * Run: bunx playwright test save-corruption-repro --project=react
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const gifFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/test-image.gif', import.meta.url)),
);
const outputDir = fileURLToPath(new URL('../test-results/save-corruption/', import.meta.url));

/** Switch to the Insert ribbon tab. */
async function switchToInsertTab(page: Page): Promise<void> {
	const insertTab = page.locator('button').filter({ hasText: /^Insert$/i });
	await insertTab.click();
	await page.waitForTimeout(300);
}

/** Click the shape dropdown, select rect, then click Shape button. */
async function addRectangleShape(page: Page): Promise<void> {
	await switchToInsertTab(page);
	// Select 'rect' from the shape type dropdown
	await page.locator('select[title]').first().selectOption('rect');
	// Click the Shape button to insert
	await page.locator('button[title*="Shape"], button[title*="shape"]').first().click();
	await page.waitForTimeout(500);
}

/** Insert a SmartArt via the dialog. Picks the first preset in 'list' category. */
async function addSmartArt(page: Page): Promise<void> {
	await switchToInsertTab(page);
	// Click the SmartArt button
	await page.locator('button[title*="SmartArt"], button[title*="smartart"]').first().click();
	await page.waitForTimeout(500);

	// Wait for the SmartArt dialog
	const dialog = page.locator('[role="dialog"][aria-modal="true"]');
	await dialog.waitFor({ timeout: 5000 });

	// Click the first preset thumbnail in the gallery grid
	const presetButton = dialog.locator('.grid button').first();
	await presetButton.click();
	await page.waitForTimeout(200);

	// Click the Insert button in the dialog footer
	const insertBtn = dialog
		.locator('button')
		.filter({ hasText: /^Insert$/i })
		.last();
	await insertBtn.click();
	await page.waitForTimeout(500);
}

/** Insert an image by setting the hidden file input. */
async function addGifImage(page: Page): Promise<void> {
	await switchToInsertTab(page);
	// Set the file on the hidden image input
	const imageInput = page.locator(
		'input[name="image-upload"], input[type="file"][accept*="image"]',
	);
	await imageInput.setInputFiles(gifFixturePath);
	await page.waitForTimeout(500);
}

/** Click the Table button to insert a default 3x3 table. */
async function addTable(page: Page): Promise<void> {
	await switchToInsertTab(page);
	await page.locator('button[title*="Table"], button[title*="table"]').first().click();
	await page.waitForTimeout(500);
}

/** Double-click a table cell and type text into it. */
async function editTableCell(page: Page, text: string): Promise<void> {
	// The table element may be obscured by overlapping elements.
	// First, select the table element by clicking on it with force.
	const tableElement = page
		.locator('[data-pptx-element="true"]')
		.filter({ has: page.locator('table') });
	if (await tableElement.isVisible({ timeout: 3000 }).catch(() => false)) {
		await tableElement.first().click({ force: true });
		await page.waitForTimeout(300);
	}

	// Find the first table cell and double-click with force
	const cell = page.locator('td').first();
	await cell.waitFor({ timeout: 5000 });
	await cell.dblclick({ force: true });
	await page.waitForTimeout(300);

	// Type into the cell input
	const input = page.locator('td input[type="text"]');
	if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
		await input.fill(text);
		await page.keyboard.press('Enter');
	} else {
		// Fallback: type directly
		await page.keyboard.type(text);
		await page.keyboard.press('Tab');
	}
	await page.waitForTimeout(300);
}

test.describe('save corruption reproduction', () => {
	test('rect + 2 smartart + gif + table with cell edit triggers repair in PowerPoint', async ({
		page,
	}, testInfo) => {
		test.skip(
			testInfo.project.name !== 'react',
			'React-only historical repro: the editing helpers target React-specific ribbon selectors (select[title], button[title*="Shape"], File tab, Save .pptx). Cross-framework SmartArt insert is covered by smartart-insert-edit.spec.ts.',
		);
		await page.goto('/');
		// Wait for the viewer to be ready (empty state with drop zone)
		await page.waitForTimeout(1000);

		// We need to start with a blank presentation or create one.
		// The demo app may show a drop zone. We need to trigger "new" if available,
		// or load a minimal fixture. Try clicking a "New" action if present.
		const newBtn = page.locator('button').filter({ hasText: /new/i }).first();
		if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await newBtn.click();
			await page.waitForTimeout(1000);
		}

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
		const smartArtElements = page.locator(
			'[data-pptx-element="true"][aria-roledescription="diagram"]',
		);
		const smartArtCount = await smartArtElements.count();

		if (smartArtCount >= 1) {
			await smartArtElements.first().click({ force: true });
			await page.waitForTimeout(300);
			await smartArtElements.first().dblclick({ force: true });
			await page.waitForTimeout(500);
			const editor = page.locator('[data-inline-editor], [contenteditable="true"]');
			if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
				await page.keyboard.selectAll();
				await page.keyboard.type('SmartArt One');
				await page.keyboard.press('Escape');
			}
			await page.waitForTimeout(300);
		}

		// Deselect
		await canvas.click({ position: { x: 10, y: 10 }, force: true });
		await page.waitForTimeout(200);

		// 5. Edit second SmartArt
		if (smartArtCount >= 2) {
			await smartArtElements.nth(1).click({ force: true });
			await page.waitForTimeout(300);
			await smartArtElements.nth(1).dblclick({ force: true });
			await page.waitForTimeout(500);
			const editor = page.locator('[data-inline-editor], [contenteditable="true"]');
			if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
				await page.keyboard.selectAll();
				await page.keyboard.type('SmartArt Two');
				await page.keyboard.press('Escape');
			}
			await page.waitForTimeout(300);
		}

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
		const fileTab = page.locator('button').filter({ hasText: /^File$/i });
		await fileTab.click();
		await page.waitForTimeout(300);

		const downloadPromise = page.waitForEvent('download');
		const saveBtn = page
			.locator('button')
			.filter({ hasText: /Save \.pptx/i })
			.first();
		await saveBtn.click();

		const download = await downloadPromise;
		const suggestedName = download.suggestedFilename();
		const savePath = resolve(outputDir, suggestedName || 'corruption-repro.pptx');
		await download.saveAs(savePath);

		// Verify the file was saved (non-zero size)
		const fs = await import('node:fs/promises');
		const stats = await fs.stat(savePath);
		expect(stats.size).toBeGreaterThan(100);
	});
});
