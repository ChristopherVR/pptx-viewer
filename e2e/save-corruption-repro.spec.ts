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
import type { Page } from '@playwright/test';

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
	const insertTab = toolbar
		.getByRole('tab', { name: 'Insert', exact: true })
		.or(toolbar.getByRole('button', { name: 'Insert', exact: true }))
		.first();
	await insertTab.click();
	await page.waitForTimeout(300);
}

function projectName(page: Page): string {
	const url = page.url();
	if (url.includes('4173')) {
		return 'react';
	}
	if (url.includes('4175')) {
		return 'vue';
	}
	if (url.includes('4174')) {
		return 'angular';
	}
	if (url.includes('4176')) {
		return 'vanilla';
	}
	if (url.includes('4177')) {
		return 'svelte';
	}
	return 'react';
}

/** Click the shape dropdown, select rect, then click Shape button. */
async function addRectangleShape(page: Page): Promise<void> {
	await switchToInsertTab(page);
	const project = projectName(page);
	if (project === 'vanilla') {
		await page
			.locator('.pptxv-shape-grid')
			.getByRole('button', { name: /Rectangle/iu })
			.first()
			.click();
		await page.waitForTimeout(500);
		return;
	}
	if (project === 'svelte') {
		await page.getByRole('button', { name: 'Shapes', exact: true }).click();
		await page
			.getByRole('menuitem', { name: /Rectangle/iu })
			.first()
			.click();
		await page.waitForTimeout(500);
		return;
	}
	if (project === 'angular') {
		await page.getByRole('button', { name: 'Rect', exact: true }).click();
		await page.waitForTimeout(500);
		return;
	}
	// Select 'rect' from the shape type dropdown
	await page.locator('select[title]').first().selectOption('rect');
	// Click the Shape button to insert
	await page.locator('button[title*="Shape"], button[title*="shape"]').first().click();
	await page.waitForTimeout(500);
}

/** Insert a SmartArt via the dialog. Picks the first preset in 'list' category. */
async function addSmartArt(page: Page): Promise<void> {
	await switchToInsertTab(page);
	const project = projectName(page);
	if (project === 'vanilla') {
		await page.locator('.pptxv-smartart-grid').getByRole('button').first().click();
		await page.waitForTimeout(500);
		return;
	}
	// Click the SmartArt button
	await page.locator('button[title*="SmartArt"], button[title*="smartart"]').first().click();
	await page.waitForTimeout(500);
	if (project === 'svelte') {
		await page.locator('.pptx-svelte-smartart-grid').getByRole('menuitem').first().click();
		await page.waitForTimeout(500);
		return;
	}

	// Wait for the SmartArt dialog
	const dialog = page.locator('[role="dialog"][aria-modal="true"]');
	await dialog.waitFor({ timeout: 5000 });

	// Click the first preset thumbnail in the gallery grid
	const presetButton = dialog
		.locator(
			'[role="option"], .grid > button, .pptx-vue-smartart-tile, .pptx-angular-smartart-tile',
		)
		.first();
	await presetButton.click();
	await page.waitForTimeout(200);

	// Click the Insert button in the dialog footer
	const insertBtn = dialog.getByRole('button', { name: /^Insert$/iu });
	await insertBtn.click();
	await page.waitForTimeout(500);
}

/** Insert an image by setting the hidden file input. */
async function addGifImage(page: Page): Promise<void> {
	await switchToInsertTab(page);
	const project = projectName(page);
	if (project === 'vanilla') {
		const chooserPromise = page.waitForEvent('filechooser');
		await page
			.locator('.pptxv-ribbon-tab-content:not([hidden])')
			.getByRole('button', { name: /Image/iu })
			.first()
			.click();
		const chooser = await chooserPromise;
		await chooser.setFiles(gifFixturePath);
		await page.waitForTimeout(500);
		return;
	}
	if (project === 'svelte') {
		await page
			.locator('.pptx-svelte-inserttab-file[accept="image/*"]')
			.setInputFiles(gifFixturePath);
		await page.waitForTimeout(500);
		return;
	}
	const chooserPromise = page.waitForEvent('filechooser');
	await page
		.getByRole('button', { name: /^(?:Insert )?Image$/iu })
		.first()
		.click();
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
		const smartArtElements = page.locator('[data-element-id][data-testid^="smartart-"]');
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
		const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
		const fileTab = toolbar
			.getByRole('tab', { name: 'File', exact: true })
			.or(toolbar.getByRole('button', { name: 'File', exact: true }))
			.first();
		await fileTab.click();
		await page.waitForTimeout(300);

		const downloadPromise = page.waitForEvent('download');
		const saveBtn = page.getByRole('button', { name: /Save/iu }).last();
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
