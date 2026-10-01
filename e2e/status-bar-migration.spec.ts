/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';

import { zoomInButton, zoomOutButton, stageWidth } from './support/chrome';
import { loadDeck, slideStage, zoomFitButton } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const bar = (page: import('@playwright/test').Page) => page.locator('pptx-ui-status-bar');

test('the shared status bar exposes the counter, save state and named controls', async ({
	page,
}, info) => {
	await loadDeck(page);
	await slideStage(page).waitFor();
	await expect(bar(page)).toHaveCount(1);
	await page.screenshot({ path: info.outputPath('status-bar.png') });
	await expect(bar(page).getByText(/^Slide 1 of \d+$/u)).toBeVisible();
	await expect(bar(page).getByText(/saved|unsaved/iu)).toBeVisible();
	for (const name of ['Normal view', 'Slide sorter', 'Slide show', 'Zoom out', 'Zoom in']) {
		await expect(bar(page).getByRole('button', { name, exact: true })).toBeVisible();
	}
	await expect(bar(page).getByRole('button', { name: 'Zoom to fit', exact: true })).toHaveText(
		/^\d+%$/u,
	);
	// Normal is the active view on load; the bar is not a landmark.
	await expect(bar(page).getByRole('button', { name: 'Normal view', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
	await expect(bar(page).getByRole('toolbar')).toHaveCount(0);
});

test('zoom controls resize the stage and zoom-to-fit restores it', async ({ page }) => {
	await loadDeck(page);
	await slideStage(page).waitFor();
	const fitted = await stageWidth(page);
	await zoomInButton(page).click();
	await expect.poll(() => stageWidth(page)).toBeGreaterThan(fitted);
	await zoomOutButton(page).click();
	await zoomFitButton(page).click();
	await expect.poll(() => stageWidth(page)).toBeCloseTo(fitted, -1);
});

test('keyboard activation of the notes toggle reflects pressed state', async ({ page }) => {
	await loadDeck(page);
	await slideStage(page).waitFor();
	const notes = bar(page).getByRole('button', { name: 'Toggle notes', exact: true });
	const before = await notes.getAttribute('aria-pressed');
	await notes.focus();
	await expect(notes).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(notes).not.toHaveAttribute('aria-pressed', before ?? 'false');
	await page.keyboard.press('Space');
	await expect(notes).toHaveAttribute('aria-pressed', before ?? 'false');
});

test('the slide sorter opens from the status bar with the keyboard', async ({ page }) => {
	await loadDeck(page);
	await slideStage(page).waitFor();
	const sorter = bar(page).getByRole('button', { name: 'Slide sorter', exact: true });
	await sorter.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { name: /slide sorter/iu }).first()).toBeVisible();
});

test('the statusBar panel customization removes the shared element', async ({ page }) => {
	const customization = { hiddenPanels: ['statusBar'] };
	await loadDeck(
		page,
		undefined,
		`/?customization=${encodeURIComponent(JSON.stringify(customization))}`,
	);
	await slideStage(page).waitFor();
	await expect(bar(page)).toHaveCount(0);
});

test.describe('touch status bar', () => {
	test.use({ hasTouch: true });
	test('targets, theme tokens, focus and forced colors remain usable', async ({ page }) => {
		await loadDeck(page);
		await slideStage(page).waitFor();
		await page.setViewportSize({ width: 900, height: 900 });
		await bar(page).evaluate((host) => host.style.setProperty('--pptx-primary', '#123456'));
		const normal = bar(page).getByRole('button', { name: 'Normal view', exact: true });
		const box = await normal.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.width).toBeGreaterThanOrEqual(44);
		// Pressed state takes its colour from the inherited theme token.
		await expect(normal).toHaveCSS('color', 'rgb(18, 52, 86)');
		await normal.focus();
		await expect(normal).toBeFocused();
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(normal).toBeVisible();
	});
});
