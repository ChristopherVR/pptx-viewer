/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { loadDeck, slideStage } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const bar = (page: Page): Locator => page.locator('pptx-ui-title-bar[data-pptx-title-bar]');
const strip = (page: Page): Locator =>
	bar(page).getByRole('toolbar', { name: 'Quick Access Toolbar' });
const button = (page: Page, name: string): Locator =>
	strip(page).getByRole('button', { name, exact: true });
const search = (page: Page): Locator => bar(page).locator('pptx-ui-search input[part="input"]');

async function open(page: Page, path?: string): Promise<void> {
	await loadDeck(page, undefined, path);
	await slideStage(page).waitFor();
	await expect(bar(page)).toHaveCount(1);
}

test('the shared title bar shows the file, AutoSave, the strip and the search', async ({
	page,
}, info) => {
	await open(page);
	await page.screenshot({
		path: info.outputPath('title-bar.png'),
		clip: { x: 0, y: 0, width: 1440, height: 80 },
	});
	await expect(bar(page).getByText(/\.pptx$/u)).toBeVisible();
	await expect(bar(page).getByRole('switch', { name: 'Toggle AutoSave' })).toBeVisible();
	// Save, Undo and Redo lead; the options-driven extras follow in configured order.
	const names = await strip(page)
		.getByRole('button')
		.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
	expect(names.slice(0, 3)).toStrictEqual(['Save', 'Undo', 'Redo']);
	expect(names).toContain('From Beginning');
	await expect(search(page)).toBeVisible();
	// Nothing to undo yet.
	await expect(button(page, 'Undo')).toBeDisabled();
});

test('the AutoSave switch is a labelled switch that flips', async ({ page }) => {
	await open(page);
	const toggle = bar(page).getByRole('switch', { name: 'Toggle AutoSave' });
	const before = await toggle.getAttribute('aria-checked');
	await toggle.click();
	await expect(toggle).not.toHaveAttribute('aria-checked', before ?? 'true');
});

test('the strip is one tab stop with roving arrow, Home and End focus', async ({ page }) => {
	await open(page);
	const toggle = bar(page).getByRole('switch', { name: 'Toggle AutoSave' });
	const save = button(page, 'Save');
	await toggle.focus();
	await page.keyboard.press('Tab');
	await expect(save).toBeFocused();
	await page.keyboard.press('End');
	const buttons = strip(page).getByRole('button');
	await expect(buttons.last()).toBeFocused();
	await page.keyboard.press('Home');
	await expect(save).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(save).not.toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(save).toBeFocused();
	// Tab leaves the strip for the search field, skipping every other button.
	await page.keyboard.press('Tab');
	await expect(search(page)).toBeFocused();
});

test('typing in the command search shows a result list, Escape clears it', async ({ page }) => {
	await open(page);
	await search(page).fill('zzzzqq');
	await expect(
		bar(page).getByRole('listbox').getByText('No results', { exact: true }),
	).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(bar(page).getByRole('listbox')).toHaveCount(0);
	await expect(search(page)).toHaveValue('');
});

test('the quickAccessToolbar panel customization removes the strip', async ({ page }) => {
	const customization = { hiddenPanels: ['quickAccessToolbar'] };
	await open(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
	await expect(strip(page)).toHaveCount(0);
	await expect(bar(page).getByRole('switch', { name: 'Toggle AutoSave' })).toBeVisible();
});

test('the row hides on a phone-width viewport', async ({ page }) => {
	await open(page);
	await page.setViewportSize({ width: 700, height: 900 });
	await expect(bar(page)).toBeHidden();
});

test('theme tokens, targets and forced colours stay usable', async ({ page }) => {
	await open(page);
	await bar(page).evaluate((host) => host.style.setProperty('--pptx-primary', '#123456'));
	const toggle = bar(page).getByRole('switch', { name: 'Toggle AutoSave' });
	if ((await toggle.getAttribute('aria-checked')) !== 'true') {
		await toggle.click();
	}
	await expect(toggle).toHaveCSS('background-color', 'rgb(18, 52, 86)');
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(button(page, 'Save')).toBeVisible();
	await expect(toggle).toBeVisible();
});

test.describe('touch title bar', () => {
	test.use({ hasTouch: true });
	test('strip buttons grow to 44px targets', async ({ page }) => {
		await open(page);
		const box = await button(page, 'Save').boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.width).toBeGreaterThanOrEqual(44);
	});
});
