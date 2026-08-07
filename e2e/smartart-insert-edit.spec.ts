/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * SmartArt insert + edit E2E tests.
 *
 * Validates that a SmartArt diagram can be inserted via the Insert tab dialog,
 * then edited through the inspector panel: changing node text, switching the
 * layout type (e.g. pyramid to process), and changing the colour scheme. The
 * spec runs across React, Vue, Angular, Vanilla, and Svelte via the neutral DOM
 * contract (aria-labels, roles, `data-testid`, `data-pptx-element`).
 *
 * Run: bunx playwright test smartart-insert-edit
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load the sample deck and wait for the viewer to render at least one element. */
async function loadDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/**
 * Navigate to the Insert tab through the shared toolbar contract. Bindings may
 * expose ribbon entries as tabs or buttons, so the locator accepts either role.
 */
async function switchToInsertTab(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const insertTab = toolbar.getByRole('tab', { name: 'Insert', exact: true });
	await insertTab.click();
	await page.waitForTimeout(200);
}

/**
 * Click the SmartArt button in the Insert section. Its shared accessible name
 * comes from `pptx.ribbon.smartArt`.
 */
async function clickSmartArtButton(page: Page): Promise<void> {
	const btn = page.getByRole('button', { name: 'SmartArt' });
	await btn.click();
	await page.waitForTimeout(300);
}

async function insertSmartArtPreset(page: Page, pattern?: RegExp): Promise<void> {
	await clickSmartArtButton(page);
	const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
	await expect(dialog).toBeVisible();
	if (pattern) {
		const category = dialog.getByRole('button').filter({ hasText: pattern }).first();
		await expect(category).toBeVisible();
		await category.click();
		await page.waitForTimeout(200);
	}
	await dialog.getByRole('option').first().click();
	await dialog.getByRole('button', { name: /^Insert$/iu }).click();
	await page.waitForTimeout(600);
}

/**
 * Open the inspector panel, accounting for bindings that start it open.
 */
async function openInspector(page: Page): Promise<void> {
	const inspector = page.locator('[data-pptx-inspector]:visible').first();
	if (!(await inspector.isVisible().catch(() => false))) {
		const toggleBtn = page.getByRole('button', { name: 'Toggle inspector panel', exact: true });
		await expect(toggleBtn).toBeVisible();
		await toggleBtn.click();
		await page.waitForTimeout(200);
	}
	await expect(inspector).toBeVisible();
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('smartart insert and edit', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('inserts SmartArt via dialog and verifies it renders on the slide', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page, /Hierarchy/iu);

		// Verify the SmartArt element was added to the slide.
		// SmartArt renderers emit a data-testid like "smartart-hierarchy",
		// "smartart-list", etc., or the element wrapper has aria-roledescription.
		const smartArtOnSlide = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]');
		await expect(smartArtOnSlide.first()).toBeVisible({ timeout: 5000 });
	});

	test('edits SmartArt node text via the inspector panel', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the newly inserted SmartArt element on the canvas.
		const smartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		// Click on the element wrapper (the one with data-pptx-element) to select it.
		const elementWrapper = smartArt
			.locator('xpath=ancestor-or-self::*[@data-pptx-element="true"]')
			.first();
		await expect(elementWrapper).toBeVisible();
		await elementWrapper.click();
		await page.waitForTimeout(300);

		// Open the inspector panel.
		await openInspector(page);
		await page.waitForTimeout(300);

		// Record the initial layout data-testid before editing.
		const initialTestId = await smartArt.getAttribute('data-testid');

		const targetInput = page.locator('[data-testid="smartart-node-text"]').first();
		await expect(targetInput).toBeVisible();
		await targetInput.fill('Updated Node');
		await targetInput.press('Tab');
		await page.waitForTimeout(300);

		const updatedText = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.filter({ hasText: 'Updated Node' })
			.first();
		await expect(updatedText).toBeVisible({ timeout: 3000 });

		const postEditTestId = await page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first()
			.getAttribute('data-testid');
		expect(postEditTestId).toBe(initialTestId);
	});

	test('switches SmartArt layout type (shape gets updated)', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the SmartArt element.
		const smartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		const elementWrapper = smartArt
			.locator('xpath=ancestor-or-self::*[@data-pptx-element="true"]')
			.first();
		await expect(elementWrapper).toBeVisible();
		await elementWrapper.click();
		await page.waitForTimeout(300);

		// Open inspector.
		await openInspector(page);
		await page.waitForTimeout(300);

		// Record the initial layout's data-testid (e.g. "smartart-list").
		const initialTestId = await smartArt.getAttribute('data-testid');

		// Switch layout via the layout switcher in the inspector.
		// The layout buttons have title text matching category names (Pyramid, Process, etc.)
		// or data-testid like "smartart-layout-pyramid".
		const switchTarget = page.locator('[data-testid="smartart-layout-pyramid"]');
		await expect(switchTarget).toBeVisible();
		await switchTarget.click();
		await page.waitForTimeout(500);

		// Verify the shape changed: the data-testid on the SVG should now differ.
		const newSmartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(newSmartArt).toBeVisible({ timeout: 5000 });
		const newTestId = await newSmartArt.getAttribute('data-testid');

		// The layout should have changed (e.g. "smartart-list" -> "smartart-pyramid").
		expect(newTestId).not.toBe(initialTestId);
	});

	test('changes SmartArt colour scheme via inspector', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the SmartArt element.
		const smartArt = page
			.locator('[data-pptx-viewport]')
			.locator('[data-testid^="smartart-"]')
			.first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		const elementWrapper = smartArt
			.locator('xpath=ancestor-or-self::*[@data-pptx-element="true"]')
			.first();
		await expect(elementWrapper).toBeVisible();
		await elementWrapper.click();
		await page.waitForTimeout(300);

		// Open inspector.
		await openInspector(page);
		await page.waitForTimeout(300);

		// Capture colours before the scheme change.
		const fillsBefore = await smartArt
			.locator('[fill]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).filter(Boolean));

		// Change the colour scheme via the select dropdown.
		// React: <select> with aria-label "Colour scheme"
		// Vue: data-testid="smartart-color-scheme"
		const targetSelect = page.locator('[data-testid="smartart-color-scheme"]');
		await expect(targetSelect).toBeVisible();
		await targetSelect.selectOption('monochromatic1');
		await page.waitForTimeout(400);

		const fillsAfter = await smartArt
			.locator('[fill]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).filter(Boolean));

		const changed =
			fillsBefore.some((f, i) => fillsAfter[i] !== f) || fillsBefore.length !== fillsAfter.length;
		expect(changed).toBe(true);
	});
});
