/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * SmartArt insert + edit E2E tests.
 *
 * Validates that a SmartArt diagram can be inserted via the Insert tab dialog,
 * then edited through the inspector panel: changing node text, switching the
 * layout type (e.g. pyramid to process), and changing the colour scheme. The
 * spec runs identically across React / Vue / Angular via the neutral DOM
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
 * Navigate to the Insert tab in the ribbon. All three frameworks render the
 * ribbon tab strip as plain `<button>` elements (no `role="tab"`), matching
 * the neutral DOM contract used elsewhere (e.g. ribbon-tab-parity.spec.ts,
 * save-corruption-repro.spec.ts). A previous `role="tab"` locator here never
 * matched anything, so this helper silently no-opped and every test in this
 * file failed downstream trying to find the SmartArt button on the Home tab.
 */
async function switchToInsertTab(page: Page): Promise<void> {
	const insertTab = page.getByRole('button', { name: 'Insert', exact: true });
	await insertTab.click();
	await page.waitForTimeout(200);
}

/**
 * Click the SmartArt button in the Insert section. The button text is "SmartArt"
 * (from `pptx.ribbon.smartArt`) across all three frameworks.
 */
async function clickSmartArtButton(page: Page): Promise<void> {
	const btn = page.getByRole('button', { name: 'SmartArt' });
	await btn.click();
	await page.waitForTimeout(300);
}

/**
 * Open the inspector panel. React/Vue use a toggle button; Angular auto-opens.
 */
async function openInspector(page: Page, project: string): Promise<void> {
	if (project === 'angular') {
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
 * Return the project name from the test info (react / vue / angular).
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
	return 'react';
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('smartart insert and edit', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('inserts SmartArt via dialog and verifies it renders on the slide', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await clickSmartArtButton(page);

		// The Insert SmartArt dialog should be open.
		const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
		await expect(dialog).toBeVisible();

		// Select the "Hierarchy" category in the sidebar.
		const hierarchyCat = dialog.getByRole('button', { name: /Hierarchy/iu });
		if (await hierarchyCat.isVisible()) {
			await hierarchyCat.click();
			await page.waitForTimeout(200);
		}

		// Pick the first available layout in the gallery grid (click to select).
		// The dialog has no role="option" elements; ".grid button" is the reliable
		// selector for a preset thumbnail (see save-corruption-repro.spec.ts).
		// Vue and Angular mark the gallery listbox/options with role="option";
		// React's gallery is a plain button grid with no ARIA role, so fall back
		// to the ".grid button" cell selector there. Angular also has no ".grid"
		// class (its gallery uses BEM classes), so role="option" is required for
		// Angular specifically - hence trying both rather than picking one.
		await dialog.getByRole('option').or(dialog.locator('.grid button')).first().click();
		await page.waitForTimeout(100);

		// Click the Insert button to confirm.
		const insertBtn = dialog.getByRole('button', { name: /^Insert$/iu });
		await insertBtn.click();
		await page.waitForTimeout(500);

		// Verify the SmartArt element was added to the slide.
		// SmartArt renderers emit a data-testid like "smartart-hierarchy",
		// "smartart-list", etc., or the element wrapper has aria-roledescription.
		const smartArtOnSlide = page.locator('[data-testid^="smartart-"]');
		await expect(smartArtOnSlide.first()).toBeVisible({ timeout: 5000 });
	});

	test('edits SmartArt node text via the inspector panel', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await clickSmartArtButton(page);

		// Insert a basic block list (first item in the default "List" category).
		const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
		await expect(dialog).toBeVisible();

		// Select the first preset thumbnail in the gallery grid (the dialog has no
		// role="option" elements; the reliable selector is the ".grid button" cells
		// used elsewhere, e.g. save-corruption-repro.spec.ts).
		// Vue and Angular mark the gallery listbox/options with role="option";
		// React's gallery is a plain button grid with no ARIA role, so fall back
		// to the ".grid button" cell selector there. Angular also has no ".grid"
		// class (its gallery uses BEM classes), so role="option" is required for
		// Angular specifically - hence trying both rather than picking one.
		await dialog.getByRole('option').or(dialog.locator('.grid button')).first().click();
		await page.waitForTimeout(100);

		const insertBtn = dialog.getByRole('button', { name: /^Insert$/iu });
		await insertBtn.click();
		await page.waitForTimeout(600);

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
				.locator('[data-testid^="smartart-"]')
				.filter({ hasText: 'Updated Node' });
			await expect(updatedText).toBeVisible({ timeout: 3000 });

			// CRITICAL: Verify the layout type did NOT change after text edit.
			// This was the bug: editing text caused pyramid to become stacked bars.
			const postEditTestId = await page
				.locator('[data-testid^="smartart-"]')
				.first()
				.getAttribute('data-testid');
			expect(postEditTestId).toBe(initialTestId);
		}
	});

	test('switches SmartArt layout type (shape gets updated)', async ({ page }) => {
		await loadDeck(page);
		await switchToInsertTab(page);
		await clickSmartArtButton(page);

		// Insert a list SmartArt (first in the default category).
		const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
		await expect(dialog).toBeVisible();

		// Select the first preset thumbnail in the gallery grid (see the ".grid
		// button" note above; role="option" never matches in this dialog).
		// Vue and Angular mark the gallery listbox/options with role="option";
		// React's gallery is a plain button grid with no ARIA role, so fall back
		// to the ".grid button" cell selector there. Angular also has no ".grid"
		// class (its gallery uses BEM classes), so role="option" is required for
		// Angular specifically - hence trying both rather than picking one.
		await dialog.getByRole('option').or(dialog.locator('.grid button')).first().click();
		await page.waitForTimeout(100);

		const insertBtn = dialog.getByRole('button', { name: /^Insert$/iu });
		await insertBtn.click();
		await page.waitForTimeout(600);

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
		await clickSmartArtButton(page);

		// Insert SmartArt.
		const dialog = page.getByRole('dialog', { name: /Insert SmartArt/iu });
		await expect(dialog).toBeVisible();

		// Select the first preset thumbnail in the gallery grid (see the ".grid
		// button" note above; role="option" never matches in this dialog).
		// Vue and Angular mark the gallery listbox/options with role="option";
		// React's gallery is a plain button grid with no ARIA role, so fall back
		// to the ".grid button" cell selector there. Angular also has no ".grid"
		// class (its gallery uses BEM classes), so role="option" is required for
		// Angular specifically - hence trying both rather than picking one.
		await dialog.getByRole('option').or(dialog.locator('.grid button')).first().click();
		await page.waitForTimeout(100);

		const insertBtn = dialog.getByRole('button', { name: /^Insert$/iu });
		await insertBtn.click();
		await page.waitForTimeout(600);

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
