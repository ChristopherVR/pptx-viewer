/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Framework-neutral viewer basics, run unchanged against every demo binding.
 *
 * This suite intentionally stays at the shared semantic layer: load/render,
 * visible slide position, thumbnail navigation, zoom, notes editing, element
 * move with undo/redo, save/download, and the SmartArt 3D opt-in path. Deeper
 * resize, inline editing, mobile, and element-specific flows
 * live in focused specs with their own cross-framework contracts.
 *
 * Run: bunx playwright test viewer-basics
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const sampleDeckPath = resolve(
	fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)),
);
const formatPainterPath = resolve(
	fileURLToPath(new URL('./fixtures/format-painter.pptx', import.meta.url)),
);

/** Load a fixture deck and wait for the main canvas to render. */
async function loadDeck(page: Page, fixturePath: string): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-roledescription="slide"]').waitFor();
	await page.locator('[data-pptx-element="true"]').first().waitFor();
}

/** The single main-canvas slide region (never a thumbnail; see file header). */
function slideRegion(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"]');
}

const zoomInButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^zoom in$/iu }).first();
const zoomOutButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^zoom out$/iu }).first();
const zoomFitButton = (page: Page): Locator => page.getByTitle(/^zoom to fit$/iu).last();
const notesToggleButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^toggle notes$/iu }).first();
const undoButton = (page: Page): Locator => page.getByRole('button', { name: /^undo$/iu }).first();
const redoButton = (page: Page): Locator => page.getByRole('button', { name: /^redo$/iu }).first();
const downloadButton = (page: Page): Locator => page.getByRole('button', { name: /save/iu }).last();

/** Count visible exact-text matches without relying on framework CSS classes. */
async function visibleTextCount(page: Page, text: string): Promise<number> {
	return page
		.getByText(text, { exact: true })
		.evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

async function expectSlidePosition(page: Page, current: number, total = 7): Promise<void> {
	await expect.poll(() => visibleTextCount(page, `Slide ${current} of ${total}`)).toBe(1);
}

test.describe('viewer basics', () => {
	test('loads a presentation and renders slide elements', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);
		await expect(slideRegion(page)).toBeVisible();
		await expect(page.locator('[data-pptx-viewport]')).toBeVisible();
		const count = await page.locator('[data-pptx-element="true"]').count();
		expect(count).toBeGreaterThan(0);
	});

	test('keeps demo overlays out of the viewer and shows one slide counter', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);
		await expect(page.locator('.demo-export-bar, .export-bar, .demo-editable-toggle')).toHaveCount(
			0,
		);
		await expectSlidePosition(page, 1);
	});

	test('navigates slides by clicking unique thumbnail content', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);
		await expectSlidePosition(page, 1);
		await page.getByText('Agenda', { exact: true }).first().click();
		await expectSlidePosition(page, 2);
	});

	test('zoom in/out/fit change the rendered slide size', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);
		const region = slideRegion(page);

		const fitBox = await region.boundingBox();
		expect(fitBox).not.toBeNull();

		await zoomInButton(page).click();
		await zoomInButton(page).click();
		await expect
			.poll(async () => (await region.boundingBox())?.width ?? 0)
			.toBeGreaterThan(fitBox!.width);
		const zoomedInWidth = (await region.boundingBox())!.width;

		await zoomOutButton(page).click();
		await zoomOutButton(page).click();
		await zoomOutButton(page).click();
		await expect
			.poll(async () => (await region.boundingBox())?.width ?? Infinity)
			.toBeLessThan(zoomedInWidth);

		await zoomFitButton(page).click();
		// Back near the original fit size (allow a little rounding slack).
		await expect
			.poll(async () => Math.abs(((await region.boundingBox())?.width ?? 0) - fitBox!.width))
			.toBeLessThan(4);
	});

	test('toggles the speaker-notes panel and edits plain-text notes', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);

		const panel = page.locator('#slide-notes-content');
		const editor = panel
			.locator('textarea[name="slide-notes"]:not([hidden]), [contenteditable="true"]')
			.first();
		await expect(panel).toBeHidden();

		await notesToggleButton(page).click();
		await expect(panel).toBeVisible();
		await expect(editor).toBeVisible();

		await editor.fill('Speaker notes from the e2e run.');
		await editor.blur();
		await page.waitForTimeout(400);
		await expect
			.poll(() =>
				editor.evaluate((node) =>
					node instanceof HTMLTextAreaElement ? node.value : (node.textContent ?? ''),
				),
			)
			.toBe('Speaker notes from the e2e run.');
	});

	test('selects and moves an element, then undo/redo it', async ({ page }) => {
		await loadDeck(page, formatPainterPath);
		const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
		await expect(source).toBeVisible();

		// Drag from the element itself so the action uses the public canvas contract.
		const startBox = (await source.boundingBox())!;
		await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
		await page.mouse.down();
		await page.mouse.move(
			startBox.x + startBox.width / 2 + 90,
			startBox.y + startBox.height / 2 + 40,
			{
				steps: 12,
			},
		);
		await page.mouse.up();
		const movedBox = (await source.boundingBox())!;
		expect(movedBox.x).toBeGreaterThan(startBox.x + 40);
		expect(movedBox.y).toBeGreaterThan(startBox.y + 15);

		await expect(undoButton(page)).toBeEnabled();
		await undoButton(page).click();
		await expect
			.poll(async () => Math.abs((await source.boundingBox())!.x - startBox.x))
			.toBeLessThan(4);
		await expect
			.poll(async () => Math.abs((await source.boundingBox())!.y - startBox.y))
			.toBeLessThan(4);

		await expect(redoButton(page)).toBeEnabled();
		await redoButton(page).click();
		await expect
			.poll(async () => Math.abs((await source.boundingBox())!.x - movedBox.x))
			.toBeLessThan(4);
		await expect
			.poll(async () => Math.abs((await source.boundingBox())!.y - movedBox.y))
			.toBeLessThan(4);
	});

	test('saves and downloads the deck as a .pptx file', async ({ page }) => {
		await loadDeck(page, formatPainterPath);

		const downloadPromise = page.waitForEvent('download');
		await downloadButton(page).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.pptx$/u);
	});

	test('the smartArt3D opt-in flag does not break normal rendering', async ({ page }) => {
		await page.goto('/?smartArt3D=1');
		await page.locator('#file-input').setInputFiles(formatPainterPath);
		await page.locator('[aria-roledescription="slide"]').waitFor();

		const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
		const target = page.locator('[data-pptx-element="true"]').filter({ hasText: 'TARGET' });
		await expect(source).toBeVisible();
		await expect(target).toBeVisible();
	});
});
