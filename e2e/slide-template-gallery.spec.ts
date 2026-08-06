/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Slide template gallery E2E tests.
 *
 * Validates that the New Slide flow's template gallery opens from the Home
 * tab, lists the shared catalogue of starter slides, and that inserting a
 * template adds a new slide directly after the current one with the
 * template's starter content rendered on the canvas. Runs across React, Vue,
 * Angular, Vanilla, and Svelte via the neutral DOM contract (roles and
 * accessible names only; no framework selectors, ports, or project branching).
 *
 * Run: bunx playwright test slide-template-gallery
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load the sample deck and wait for the viewer to render at least one element. */
async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/** Switch to the Home ribbon tab (some bindings may already start there). */
async function switchToHomeTab(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const homeTab = toolbar.getByRole('tab', { name: 'Home', exact: true });
	await homeTab.click();
	await page.waitForTimeout(200);
}

/** Sidebar slide-navigation thumbnails, shared across bindings. */
function slideThumbnails(page: Page): Locator {
	return page.getByRole('button', { name: /^Go to slide \d+$/u });
}

/** Open the template gallery dialog from the Home tab's Slides group. */
async function openTemplateGallery(page: Page): Promise<Locator> {
	await switchToHomeTab(page);
	const btn = page.getByRole('button', { name: 'Slide Templates' }).first();
	await expect(btn).toBeVisible();
	await btn.click();
	const dialog = page.getByRole('dialog', { name: /Slide Templates/iu });
	await expect(dialog).toBeVisible();
	return dialog;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('slide template gallery', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('opens the gallery and lists the template catalogue', async ({ page }) => {
		await loadDeck(page);
		const dialog = await openTemplateGallery(page);

		// The shared catalogue ships 12 starter slides; every binding renders
		// one option per template with its accessible name.
		await expect(dialog.getByRole('option')).toHaveCount(12);
		await expect(dialog.getByRole('option', { name: 'Title Slide' })).toBeVisible();
		await expect(dialog.getByRole('option', { name: 'Agenda' })).toBeVisible();
		await expect(dialog.getByRole('option', { name: 'Comparison' })).toBeVisible();
		await expect(dialog.getByRole('option', { name: 'Blank' })).toBeVisible();

		// Cancel closes without inserting.
		const before = await slideThumbnails(page).count();
		await dialog.getByRole('button', { name: /^Cancel$/iu }).click();
		await expect(dialog).toBeHidden();
		await expect(slideThumbnails(page)).toHaveCount(before);
	});

	test('inserts a template slide after the current slide', async ({ page }) => {
		await loadDeck(page);
		const before = await slideThumbnails(page).count();

		const dialog = await openTemplateGallery(page);
		await dialog.getByRole('option', { name: 'Agenda' }).click();
		await dialog.getByRole('button', { name: /^Insert$/iu }).click();
		await expect(dialog).toBeHidden();
		await page.waitForTimeout(500);

		// Slide count grew by one.
		await expect(slideThumbnails(page)).toHaveCount(before + 1);

		// The inserted starter content renders on the active slide: the agenda
		// template carries an "Agenda" title and numbered agenda rows.
		const viewport = page.locator('[data-pptx-viewport]');
		await expect(viewport.getByText('Agenda', { exact: true }).first()).toBeVisible({
			timeout: 5000,
		});
		await expect(viewport.getByText(/Agenda item 1/u).first()).toBeVisible();
	});

	test('double-clicking a tile inserts immediately', async ({ page }) => {
		await loadDeck(page);
		const before = await slideThumbnails(page).count();

		const dialog = await openTemplateGallery(page);
		await dialog.getByRole('option', { name: 'Quote' }).dblclick();
		await expect(dialog).toBeHidden();
		await page.waitForTimeout(500);

		await expect(slideThumbnails(page)).toHaveCount(before + 1);
		const viewport = page.locator('[data-pptx-viewport]');
		await expect(viewport.getByText(/Speaker Name, Role/u).first()).toBeVisible({
			timeout: 5000,
		});
	});
});
