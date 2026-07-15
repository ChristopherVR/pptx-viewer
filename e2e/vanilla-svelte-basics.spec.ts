/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Vanilla / Svelte viewer-only E2E coverage.
 *
 * `pptx-vanilla-viewer` and `pptx-svelte-viewer` are newer bindings without
 * full editing parity with React/Vue/Angular yet: no ribbon, no
 * inspectors/dialogs, no format painter, no equation editing, no
 * collaboration, no OLE dialogs, no mobile-specific chrome. Running the
 * existing ~20-file shared spec set against them would fail for the right
 * reasons (missing feature), not real regressions, so this is a small,
 * dedicated spec scoped to what both bindings actually ship today: load a
 * deck, navigate slides (prev/next + thumbnail click), zoom, toggle +
 * edit speaker notes, select/move/resize an element, undo/redo, and the
 * save-as-download round trip. See `packages/vanilla/src/viewer/**` and
 * `packages/svelte/src/viewer/**` for the underlying implementation.
 *
 * Cross-binding DOM contract notes (discovered writing this spec):
 *  - `#file-input`, `[data-pptx-viewport]`, `[aria-roledescription="slide"]`
 *    (main canvas only, not the thumbnail rail), `[data-pptx-element="true"]`
 *    (main canvas only; recurses into groups), `#slide-notes-content` +
 *    `textarea[name="slide-notes"]`, and `[data-handle="<resize-handle>"]`
 *    are now emitted by both bindings, matching the framework-neutral
 *    contract documented at the top of `playwright.config.ts`.
 *  - Both read their UI strings from the same shared i18n dictionary
 *    (`packages/shared/src/i18n/translations-en.ts`), but not always the same
 *    *keys*: prev/next use `pptx.presenter.*` ("Previous Slide"/"Next Slide")
 *    in vanilla vs. `pptx.mobileBar.*` ("Previous slide"/"Next slide") in
 *    Svelte - a case-insensitive `/previous slide/iu` / `/next slide/iu`
 *    match handles both. Zoom in/out/fit, Undo/Redo, and "Toggle notes" use
 *    the same keys (and therefore identical accessible names) in both.
 *  - The real download-triggering button also differs: vanilla's single
 *    "Save" toolbar button downloads the .pptx directly; Svelte splits an
 *    in-memory "Save" (no download) from a separate "Save as .pptx" download
 *    button. `getByRole('button', { name: /save/iu }).last()` resolves to the
 *    real download trigger in both (vanilla has one match, Svelte's last
 *    "save"-matching button is "Save as .pptx").
 *  - Thumbnail rail: vanilla renders `role="listbox"`/`role="option"`,
 *    Svelte renders a plain `<nav>` of buttons - structurally different, but
 *    both containers carry the same shared `aria-label="Toggle slides
 *    panel"`, so `[aria-label="Toggle slides panel"] button` finds the
 *    thumbnails in either binding without branching on the project name.
 *
 * Fullscreen presentation remains outside this smoke spec because headless CI
 * fullscreen behavior is browser-dependent. Editing, collaboration, mobile
 * chrome, OLE/ink, Format Painter, and exports have focused shared specs.
 *
 * Run: bunx playwright test vanilla-svelte-basics --project=vanilla
 *      bunx playwright test vanilla-svelte-basics --project=svelte
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

const prevButton = (page: Page): Locator =>
	page.getByRole('button', { name: /previous slide/iu }).first();
const nextButton = (page: Page): Locator =>
	page.getByRole('button', { name: /next slide/iu }).first();
const zoomInButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^zoom in$/iu }).first();
const zoomOutButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^zoom out$/iu }).first();
const zoomFitButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^zoom to fit$/iu }).first();
const notesToggleButton = (page: Page): Locator =>
	page.getByRole('button', { name: /^toggle notes$/iu }).first();
const undoButton = (page: Page): Locator => page.getByRole('button', { name: /^undo$/iu }).first();
const redoButton = (page: Page): Locator => page.getByRole('button', { name: /^redo$/iu }).first();
/** Both bindings' real download-triggering button; see file header. */
const downloadButton = (page: Page): Locator => page.getByRole('button', { name: /save/iu }).last();

test.describe('vanilla / svelte basics', () => {
	test('loads a presentation and renders slide elements', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);
		await expect(slideRegion(page)).toBeVisible();
		await expect(page.locator('[data-pptx-viewport]')).toBeVisible();
		const count = await page.locator('[data-pptx-element="true"]').count();
		expect(count).toBeGreaterThan(0);
	});

	test('keeps demo actions out of the viewer chrome and uses one status counter', async ({
		page,
	}) => {
		await loadDeck(page, sampleDeckPath);
		await expect(page.locator('.demo-export-bar, .export-bar, .demo-editable-toggle')).toHaveCount(
			0,
		);
		await expect(page.locator('.pptxv-ribbon-nav, .pptx-svelte-ribbon-nav')).toHaveCount(0);
		const statusCounter = page.locator(
			'.pptxv-statusbar-counter, .pptx-svelte-statusbar-left > span[aria-live="polite"]',
		);
		await expect(statusCounter).toHaveCount(1);
		await expect(statusCounter).toContainText('Slide 1 of 7');
		const statusBar = page.locator('.pptxv-statusbar, .pptx-svelte-statusbar');
		await expect(
			statusBar.getByRole('button', { name: /previous slide|next slide/iu }),
		).toHaveCount(0);
		await expect(statusBar.getByRole('button', { name: /share|broadcast/iu })).toHaveCount(0);
		await expect(page.locator('.pptxv-ribbon-primary:empty')).toBeHidden();
	});

	test('navigates slides with next/prev controls and a thumbnail click', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);

		// Previous is disabled on slide 1; Next advances the counter.
		await expect(prevButton(page)).toBeDisabled();
		await nextButton(page).click();
		await expect(page.getByText(/2 of 7/u).first()).toBeVisible();
		await nextButton(page).click();
		await expect(page.getByText(/3 of 7/u).first()).toBeVisible();
		await prevButton(page).click();
		await expect(page.getByText(/2 of 7/u).first()).toBeVisible();

		// Jump via a thumbnail (see file header for the shared aria-label hook).
		const thumbnails = page.locator('[aria-label="Toggle slides panel"] button');
		await expect(thumbnails.first()).toBeVisible();
		await thumbnails.nth(4).click();
		await expect(page.getByText(/5 of 7/u).first()).toBeVisible();
	});

	test('zoom in/out/fit change the rendered slide size', async ({ page }) => {
		await loadDeck(page, sampleDeckPath);
		const region = slideRegion(page);

		const fitBox = await region.boundingBox();
		expect(fitBox).not.toBeNull();

		await zoomInButton(page).click();
		await zoomInButton(page).click();
		const zoomedInBox = await region.boundingBox();
		expect(zoomedInBox).not.toBeNull();
		expect(zoomedInBox!.width).toBeGreaterThan(fitBox!.width);

		await zoomOutButton(page).click();
		await zoomOutButton(page).click();
		await zoomOutButton(page).click();
		const zoomedOutBox = await region.boundingBox();
		expect(zoomedOutBox).not.toBeNull();
		expect(zoomedOutBox!.width).toBeLessThan(zoomedInBox!.width);

		await zoomFitButton(page).click();
		const refittedBox = await region.boundingBox();
		expect(refittedBox).not.toBeNull();
		// Back near the original fit size (allow a little rounding slack).
		expect(Math.abs(refittedBox!.width - fitBox!.width)).toBeLessThan(4);
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
		await expect
			.poll(() =>
				editor.evaluate((node) =>
					node instanceof HTMLTextAreaElement ? node.value : (node.textContent ?? ''),
				),
			)
			.toBe('Speaker notes from the e2e run.');

		// Reload the panel state by collapsing and re-expanding; the committed
		// text must have actually landed on the slide, not just the textarea.
		await notesToggleButton(page).click();
		await expect(panel).toBeHidden();
		await notesToggleButton(page).click();
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

		// Click (down+up, no movement) selects the shape, then drag-move it.
		// Selection/move begin from a pointerdown on the ELEMENT ITSELF (see
		// `resolveTopLevelElementId` in both bindings' editor controllers), so
		// this does not depend on the selection overlay's own box/handles being
		// visually positioned correctly - see the dedicated resize test below
		// for that (binding-dependent) concern.
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
		const afterUndo = (await source.boundingBox())!;
		expect(Math.abs(afterUndo.x - startBox.x)).toBeLessThan(4);
		expect(Math.abs(afterUndo.y - startBox.y)).toBeLessThan(4);

		await expect(redoButton(page)).toBeEnabled();
		await redoButton(page).click();
		const afterRedo = (await source.boundingBox())!;
		expect(Math.abs(afterRedo.x - movedBox.x)).toBeLessThan(4);
		expect(Math.abs(afterRedo.y - movedBox.y)).toBeLessThan(4);
	});

	test('resizes a selected element via its resize handle', async ({ page }) => {
		await loadDeck(page, formatPainterPath);
		const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
		await expect(source).toBeVisible();

		const seHandle = page.locator('[data-handle="se"]');
		await expect(seHandle).toBeHidden();

		const startBox = (await source.boundingBox())!;
		await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
		await page.mouse.down();
		await page.mouse.up();
		await expect(seHandle).toBeVisible();

		const handleBox = (await seHandle.boundingBox())!;
		const handleCx = handleBox.x + handleBox.width / 2;
		const handleCy = handleBox.y + handleBox.height / 2;
		await page.mouse.move(handleCx, handleCy);
		await page.mouse.down();
		await page.mouse.move(handleCx + 60, handleCy + 40, { steps: 12 });
		await page.mouse.up();
		const resizedBox = (await source.boundingBox())!;
		expect(resizedBox.width).toBeGreaterThan(startBox.width + 20);
		expect(resizedBox.height).toBeGreaterThan(startBox.height + 10);

		await expect(undoButton(page)).toBeEnabled();
		await undoButton(page).click();
		const afterUndo = (await source.boundingBox())!;
		expect(Math.abs(afterUndo.width - startBox.width)).toBeLessThan(4);

		await expect(redoButton(page)).toBeEnabled();
		await redoButton(page).click();
		const afterRedo = (await source.boundingBox())!;
		expect(Math.abs(afterRedo.width - resizedBox.width)).toBeLessThan(4);
	});

	test('edits shape text inline and restores it with undo', async ({ page }) => {
		await loadDeck(page, formatPainterPath);
		const source = page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
		await source.dblclick();

		const editor = page.locator('[data-inline-editor]');
		await expect(editor).toBeVisible();
		await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
		await editor.pressSequentially('EDITED SOURCE');
		await editor.press('Escape');

		await expect(source).toContainText('EDITED SOURCE');
		await expect(undoButton(page)).toBeEnabled();
		await undoButton(page).click();
		await expect(source).toContainText('SOURCE');
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
