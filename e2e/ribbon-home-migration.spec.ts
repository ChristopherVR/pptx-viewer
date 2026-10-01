/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementWithText, loadDeck, ribbonTab, selectElement, slideElements } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const control = (page: Page, id: string) => page.locator(`[data-ribbon-control="${id}"]`).first();

async function openHome(page: Page, path?: string) {
	await loadDeck(page, undefined, path);
	await ribbonTab(page, 'Home').click();
}

async function selectSubtitle(page: Page) {
	await selectElement(page, elementWithText(page, 'Product Overview'));
}

const CLIPBOARD = [
	'home.clipboard.paste',
	'home.clipboard.cut',
	'home.clipboard.copy',
	'home.clipboard.formatPainter',
];

test.describe('Home clipboard', () => {
	test('exposes the canonical group and control ids once', async ({ page }, info) => {
		await openHome(page);
		await expect(page.locator('[data-ribbon-group="home.clipboard"]')).toHaveCount(1);
		const group = page.locator('[data-ribbon-group="home.clipboard"]');
		for (const id of CLIPBOARD) {
			await expect(group.locator(`[data-ribbon-control="${id}"]`)).toHaveCount(1);
		}
		await page.screenshot({ path: info.outputPath('home.png') });
	});

	test('gates actions on the selection and the clipboard', async ({ page }) => {
		await openHome(page);
		await expect(control(page, 'home.clipboard.copy')).toBeDisabled();
		await expect(control(page, 'home.clipboard.cut')).toBeDisabled();
		await expect(control(page, 'home.clipboard.paste')).toBeDisabled();
		await selectSubtitle(page);
		await expect(control(page, 'home.clipboard.copy')).toBeEnabled();
		await expect(control(page, 'home.clipboard.cut')).toBeEnabled();
		await expect(control(page, 'home.clipboard.paste')).toBeDisabled();
		await control(page, 'home.clipboard.copy').click();
		await expect(control(page, 'home.clipboard.paste')).toBeEnabled();
	});

	test('copy, paste, cut and undo change the slide', async ({ page }) => {
		await openHome(page);
		const count = () => slideElements(page).count();
		const before = await count();
		await selectSubtitle(page);
		// Keyboard activation reaches the native clipboard action.
		await expect(control(page, 'home.clipboard.copy')).toBeEnabled();
		await control(page, 'home.clipboard.copy').focus();
		await expect(control(page, 'home.clipboard.copy')).toBeFocused();
		await page.keyboard.press('Space');
		await expect(control(page, 'home.clipboard.paste')).toBeEnabled();
		await control(page, 'home.clipboard.paste').click();
		await expect.poll(count).toBe(before + 1);
		await page.keyboard.press('Control+z');
		await expect.poll(count).toBe(before);
		await page.getByRole('button', { name: 'Redo', exact: true }).first().click();
		await expect.poll(count).toBe(before + 1);
		await selectSubtitle(page);
		await control(page, 'home.clipboard.cut').click();
		await expect.poll(count).toBe(before);
		await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
		await expect.poll(count).toBe(before + 1);
	});

	test('arms and cancels the Format Painter', async ({ page }) => {
		await openHome(page);
		const painter = page.getByTestId('format-painter-toggle').first();
		await expect(painter).toBeDisabled();
		await selectSubtitle(page);
		await expect(painter).toBeEnabled();
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'true');
		await expect(painter).toHaveAttribute('aria-pressed', 'true');
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'false');
	});

	test('retains public customization ids', async ({ page }) => {
		const customization = {
			ribbon: { hiddenButtons: ['home.clipboard.paste', 'home.clipboard.formatPainter'] },
		};
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(control(page, 'home.clipboard.paste')).toBeHidden();
		await expect(control(page, 'home.clipboard.formatPainter')).toBeHidden();
		await expect(control(page, 'home.clipboard.copy')).toBeVisible();
		const groups = { ribbon: { hiddenGroups: ['home.clipboard'] } };
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(groups))}`);
		await expect(page.locator('[data-ribbon-group="home.clipboard"]')).toBeHidden();
	});
});

test.describe('touch Home controls', () => {
	test.use({ hasTouch: true });
	test('targets, theme tokens and forced colors remain usable', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Home').tap();
		await page.setViewportSize({ width: 900, height: 900 });
		const copy = control(page, 'home.clipboard.copy');
		await copy.evaluate((button) => {
			(button.closest('pptx-ui-ribbon-home-clipboard') as HTMLElement).style.setProperty(
				'--pptx-foreground',
				'#123456',
			);
		});
		await expect(copy).toHaveCSS('color', 'rgb(18, 52, 86)');
		const box = await copy.boundingBox();
		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(copy).toBeVisible();
	});
});
