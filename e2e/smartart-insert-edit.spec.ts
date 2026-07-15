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

const fixturePath = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load the sample deck and wait for the viewer to render at least one element. */
async function loadDeck(page: Page): Promise<void> {
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
	const insertTab = toolbar
		.getByRole('tab', { name: 'Insert', exact: true })
		.or(toolbar.getByRole('button', { name: 'Insert', exact: true }))
		.first();
	await insertTab.click();
	await page.waitForTimeout(200);
}

/**
 * Click the SmartArt button in the Insert section. Its shared accessible name
 * comes from `pptx.ribbon.smartArt`.
 */
async function clickSmartArtButton(page: Page): Promise<void> {
	if (projectName(page) === 'vanilla') {
		return;
	}
	const btn = page.getByRole('button', { name: 'SmartArt' });
	await btn.click();
	await page.waitForTimeout(300);
}

async function insertSmartArtPreset(page: Page, pattern?: RegExp): Promise<void> {
	await clickSmartArtButton(page);
	const project = projectName(page);
	if (project === 'vanilla' || project === 'svelte') {
		const scope =
			project === 'vanilla'
				? page.locator('.pptxv-smartart-grid')
				: page.locator('.pptx-svelte-smartart-grid');
		const items = project === 'svelte' ? scope.getByRole('menuitem') : scope.getByRole('button');
		const matching = items.filter({ hasText: pattern ?? /./u }).first();
		await ((await matching.count()) > 0 ? matching : items.first()).click();
		await page.waitForTimeout(600);
		return;
	}
	const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
	await expect(dialog).toBeVisible();
	if (pattern) {
		const category = dialog.getByRole('button').filter({ hasText: pattern }).first();
		if (await category.isVisible().catch(() => false)) {
			await category.click();
			await page.waitForTimeout(200);
		}
	}
	await dialog
		.locator(
			'[role="option"], .grid > button, .pptx-vue-smartart-tile, .pptx-angular-smartart-tile',
		)
		.first()
		.click();
	await dialog.getByRole('button', { name: /^Insert$/iu }).click();
	await page.waitForTimeout(600);
}

/**
 * Open the inspector panel, accounting for bindings that start it open.
 */
async function openInspector(page: Page, project: string): Promise<void> {
	if (project === 'angular') {
		return;
	}
	// Vue's inspector pane starts open (and stays open after inserting SmartArt,
	// which auto-selects the new element); clicking the toggle would CLOSE it and
	// drop the SmartArt properties/layout controls the tests need. Skip the click
	// when a side panel is already present so the helper is idempotent.
	const alreadyOpen =
		project === 'vue'
			? page.locator('aside[aria-label="Properties"], aside[aria-label="Slide Properties"]')
			: page.getByRole('complementary', { name: 'Properties' });
	if (
		await alreadyOpen
			.first()
			.isVisible()
			.catch(() => false)
	) {
		return;
	}
	const label = project === 'react' ? 'Toggle inspector panel' : 'Toggle inspector';
	const toggleBtn = page.getByRole('button', { name: label });
	if (await toggleBtn.isVisible()) {
		await toggleBtn.click();
		await page.waitForTimeout(200);
	}
}

/**
 * Return the project name inferred from the five configured demo ports.
 */
function projectName(page: Page): string {
	// testInfo not accessible here; fall back to URL port.
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
		const smartArtOnSlide = page.locator('[data-testid^="smartart-"]');
		await expect(smartArtOnSlide.first()).toBeVisible({ timeout: 5000 });
	});

	test('edits SmartArt node text via the inspector panel', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the newly inserted SmartArt element on the canvas.
		const smartArt = page.locator('[data-testid^="smartart-"]').first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		// Click on the element wrapper (the one with data-pptx-element) to select it.
		const elementWrapper = smartArt.locator('xpath=ancestor::*[@data-pptx-element="true"]');
		if (await elementWrapper.first().isVisible()) {
			await elementWrapper.first().click();
		} else {
			await smartArt.click();
		}
		await page.waitForTimeout(300);

		// Open the inspector panel.
		const project = projectName(page);
		await openInspector(page, project);
		await page.waitForTimeout(300);

		// Record the initial layout data-testid before editing.
		const initialTestId = await smartArt.getAttribute('data-testid');

		// The SmartArt properties panel should appear with node text inputs.
		// Look for text inputs containing default node text ("Item 1", "Item 2", etc.).
		const nodeTextInput = page
			.locator('input[type="text"], input:not([type])')
			.filter({ hasText: /Item|Step|Phase|Manager|Set|Start/iu })
			.first();

		// Alternative: find the node text by its data-testid (Vue) or role.
		const nodeInput = page.locator('[data-testid="smartart-node-text"]').first();
		const targetInput = (await nodeInput.isVisible()) ? nodeInput : nodeTextInput;

		if (await targetInput.isVisible()) {
			await targetInput.fill('Updated Node');
			await targetInput.press('Tab');
			await page.waitForTimeout(300);

			// Verify the text was updated on the canvas.
			const updatedText = page
				.locator('[data-pptx-viewport]')
				.locator('[data-testid^="smartart-"]')
				.filter({ hasText: 'Updated Node' })
				.first();
			await expect(updatedText).toBeVisible({ timeout: 3000 });

			// CRITICAL: Verify the layout type did NOT change after text edit.
			// This was the bug: editing text caused pyramid to become stacked bars.
			const postEditTestId = await page
				.locator('[data-pptx-viewport]')
				.locator('[data-testid^="smartart-"]')
				.first()
				.getAttribute('data-testid');
			expect(postEditTestId).toBe(initialTestId);
		}
	});

	test('switches SmartArt layout type (shape gets updated)', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await insertSmartArtPreset(page);

		// Select the SmartArt element.
		const smartArt = page.locator('[data-testid^="smartart-"]').first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		const elementWrapper = smartArt.locator('xpath=ancestor::*[@data-pptx-element="true"]');
		if (await elementWrapper.first().isVisible()) {
			await elementWrapper.first().click();
		} else {
			await smartArt.click();
		}
		await page.waitForTimeout(300);

		// Open inspector.
		const project = projectName(page);
		await openInspector(page, project);
		await page.waitForTimeout(300);

		// Record the initial layout's data-testid (e.g. "smartart-list").
		const initialTestId = await smartArt.getAttribute('data-testid');

		// Switch layout via the layout switcher in the inspector.
		// The layout buttons have title text matching category names (Pyramid, Process, etc.)
		// or data-testid like "smartart-layout-pyramid".
		const pyramidBtn = page.locator('[data-testid="smartart-layout-pyramid"]');
		const pyramidByTitle = page.getByRole('button', { name: /Pyramid/iu });

		let switchTarget: typeof pyramidBtn;
		if (await pyramidBtn.isVisible()) {
			switchTarget = pyramidBtn;
		} else if (await pyramidByTitle.isVisible()) {
			switchTarget = pyramidByTitle;
		} else {
			// Fallback: try a different layout (process)
			const processBtn = page.locator('[data-testid="smartart-layout-process"]');
			const processByTitle = page.getByRole('button', { name: /Process/iu });
			switchTarget = (await processBtn.isVisible()) ? processBtn : processByTitle;
		}

		await switchTarget.click();
		await page.waitForTimeout(500);

		// Verify the shape changed: the data-testid on the SVG should now differ.
		const newSmartArt = page.locator('[data-testid^="smartart-"]').first();
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
		const smartArt = page.locator('[data-testid^="smartart-"]').first();
		await expect(smartArt).toBeVisible({ timeout: 5000 });

		const elementWrapper = smartArt.locator('xpath=ancestor::*[@data-pptx-element="true"]');
		if (await elementWrapper.first().isVisible()) {
			await elementWrapper.first().click();
		} else {
			await smartArt.click();
		}
		await page.waitForTimeout(300);

		// Open inspector.
		const project = projectName(page);
		await openInspector(page, project);
		await page.waitForTimeout(300);

		// Capture colours before the scheme change.
		const fillsBefore = await smartArt
			.locator('[fill]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).filter(Boolean));

		// Change the colour scheme via the select dropdown.
		// React: <select> with aria-label "Colour scheme"
		// Vue: data-testid="smartart-color-scheme"
		const colourSelect = page.locator('[data-testid="smartart-color-scheme"]');
		const colourByLabel = page
			.locator('select')
			.filter({ has: page.locator('option[value="monochromatic1"]') });

		const targetSelect = (await colourSelect.isVisible()) ? colourSelect : colourByLabel.first();
		if (await targetSelect.isVisible()) {
			await targetSelect.selectOption('monochromatic1');
			await page.waitForTimeout(400);

			// Verify colours changed on the canvas SVG.
			const fillsAfter = await smartArt
				.locator('[fill]')
				.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).filter(Boolean));

			// At least one fill should have changed.
			const changed =
				fillsBefore.some((f, i) => fillsAfter[i] !== f) || fillsBefore.length !== fillsAfter.length;
			expect(changed).toBe(true);
		}
	});
});
