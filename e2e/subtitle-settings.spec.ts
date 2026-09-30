/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';
import { collectRibbonInventory } from './support/ribbon-controls';

test('Subtitle Settings owns language without toggling captions, preserves drafts and returns keyboard focus', async ({
	page,
}, testInfo) => {
	await loadDeck(page);
	await collectRibbonInventory(page, ['Slide Show']);
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const captions = toolbar.getByRole('checkbox', { name: 'Subtitles', exact: true });
	const settings = toolbar.getByRole('button', { name: 'Subtitle Settings', exact: true });
	await expect(captions).not.toBeChecked();
	await settings.focus();
	await page.keyboard.press('Enter');
	const dialog = page.getByRole('dialog', { name: 'Subtitle Settings', exact: true });
	await expect(dialog).toBeVisible();
	const screenshot = testInfo.outputPath('subtitle-settings.png');
	await dialog.screenshot({ path: screenshot });
	await testInfo.attach('subtitle-settings', { path: screenshot, contentType: 'image/png' });
	await expect(captions).not.toBeChecked();
	const language = dialog.getByRole('combobox', { name: 'Spoken language', exact: true });
	await expect(language).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(language).toBeFocused();
	await language.click();
	await page.getByRole('option', { name: 'French (France)', exact: true }).click();
	await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(settings).toBeFocused();
	await expect(captions).not.toBeChecked();
	await captions.focus();
	await page.keyboard.press('Space');
	await expect(captions).toBeChecked();
	await settings.click();
	await expect(language).toHaveText('French (France)');
	await expect(captions).toBeChecked();
	await language.click();
	await page.getByRole('option', { name: 'German (Germany)', exact: true }).click();
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await settings.focus();
	await page.keyboard.press('Space');
	await expect(language).toHaveText('French (France)');
	await page.keyboard.press('Escape');
	await expect(dialog).not.toBeVisible();
	await expect(settings).toBeFocused();
	await toolbar.getByRole('tab', { name: 'Home', exact: true }).click();
	await toolbar.getByRole('tab', { name: 'Slide Show', exact: true }).click();
	await settings.click();
	await expect(language).toHaveText('French (France)');
	await expect(captions).toBeChecked();
	await page.keyboard.press('Escape');
	await loadDeck(page);
	await collectRibbonInventory(page, ['Slide Show']);
	await settings.click();
	await expect(language).toHaveText('French (France)');
});

test('Subtitle Settings fits a narrow viewport and inherits accessible dialog tokens', async ({
	page,
}) => {
	await loadDeck(page);
	await collectRibbonInventory(page, ['Slide Show']);
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	await toolbar.evaluate((element) =>
		(element as HTMLElement).style.setProperty('--pptx-background', '#f0f3f8'),
	);
	await toolbar.getByRole('button', { name: 'Subtitle Settings', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Subtitle Settings', exact: true });
	await expect(dialog).toHaveCSS('background-color', 'rgb(240, 243, 248)');
	await page.keyboard.press('Escape');
	await page.setViewportSize({ width: 390, height: 700 });
	// Ribbon collapse disposes its controls. Exercise the same shared dialog independently.
	await page.evaluate(() => {
		const control = document.createElement('pptx-ui-subtitle-settings');
		control.dataset.testid = 'narrow-subtitle-settings';
		control.style.cssText = 'position:fixed;top:200px;left:20px;z-index:99999';
		document.body.append(control);
	});
	const narrow = page.getByTestId('narrow-subtitle-settings');
	await narrow.getByRole('button', { name: 'Subtitle Settings', exact: true }).click();
	const narrowDialog = narrow.getByRole('dialog', { name: 'Subtitle Settings', exact: true });
	const box = await narrowDialog.boundingBox();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(390);
	for (const name of ['Apply', 'Cancel']) {
		const button = await narrowDialog.getByRole('button', { name, exact: true }).boundingBox();
		expect(button!.height).toBeGreaterThanOrEqual(44);
	}
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(narrowDialog).toHaveCSS('border-top-width', '1px');
	await narrow.evaluate((element) => element.remove());
	await expect(narrowDialog).not.toBeVisible();
});
