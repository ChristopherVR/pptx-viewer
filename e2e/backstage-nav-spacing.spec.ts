/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/** The File navigation keeps the same readable geometry in every binding. */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';

const LABELS = [
	'Home',
	'New',
	'Open',
	'Info',
	'Save',
	'Save As',
	'Print',
	'Share',
	'Export',
	'Close',
	'Account',
	'Options',
];

test('main and footer rows share readable height, icon alignment, and states', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await loadDeck(page);
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File' })
		.click();
	const backstage = page.getByRole('dialog', { name: 'File' });
	const backButton = backstage.getByRole('button', { name: 'Back to presentation' });
	const backGeometry = await backButton.evaluate((element) => {
		const button = element.getBoundingClientRect();
		const rail = element.closest('aside')!.getBoundingClientRect();
		return {
			width: button.width,
			height: button.height,
			centerOffset: button.left + button.width / 2 - (rail.left + rail.width / 2),
		};
	});
	expect(Math.abs(backGeometry.width - 148)).toBeLessThanOrEqual(1);
	expect(backGeometry.height).toBe(40);
	expect(Math.abs(backGeometry.centerOffset)).toBeLessThanOrEqual(0.5);
	const rows = backstage.locator('[data-pptx-backstage-nav-item]');
	await expect(rows).toHaveCount(LABELS.length);
	await expect(rows).toHaveText(LABELS);
	await expect(rows.first()).toHaveAttribute('aria-current', 'page');

	const geometry = await rows.evaluateAll((elements) =>
		elements.map((element) => {
			const row = element.getBoundingClientRect();
			const icon = element.querySelector('svg')?.getBoundingClientRect();
			return {
				height: row.height,
				gap: getComputedStyle(element).columnGap,
				iconWidth: icon?.width,
				iconOffset: icon ? icon.y + icon.height / 2 - (row.y + row.height / 2) : null,
				y: row.y,
			};
		}),
	);
	for (const item of geometry) {
		expect(item.height).toBe(40);
		expect(item.gap).toBe('12px');
		expect(item.iconWidth).toBe(17);
		expect(Math.abs(item.iconOffset ?? Infinity)).toBeLessThanOrEqual(0.5);
	}
	expect(geometry[10]!.y).toBeGreaterThan(geometry[9]!.y + geometry[9]!.height);

	await page.mouse.move(800, 800);
	const inactive = await rows
		.nth(1)
		.evaluate((element) => getComputedStyle(element).backgroundColor);
	await rows.nth(1).hover();
	const hovered = await rows
		.nth(1)
		.evaluate((element) => getComputedStyle(element).backgroundColor);
	expect(hovered).not.toBe(inactive);
	await rows.nth(1).press('Tab');
	await expect(rows.nth(2)).toBeFocused();
	await expect(rows.nth(2)).toHaveCSS('outline-style', 'solid');
	await rows.nth(2).click();
	await expect(rows.nth(2)).toHaveAttribute('aria-current', 'page');
	await expect(rows.first()).not.toHaveAttribute('aria-current', 'page');
	await backButton.click({ position: { x: Math.floor(backGeometry.width) - 5, y: 20 } });
	await expect(backstage).toBeHidden();
});

test('File navigation keeps its spacing in a narrow desktop window', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 700 });
	await loadDeck(page);
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File' })
		.click();
	const backstage = page.getByRole('dialog', { name: 'File' });
	const aside = backstage.locator('aside');
	const rows = aside.locator('[data-pptx-backstage-nav-item]');
	await expect(aside).toHaveCSS('width', '148px');
	await expect(rows).toHaveCount(LABELS.length);
	await expect(rows.first()).toHaveCSS('min-height', '40px');
	await expect(rows.last()).toBeInViewport();
	const content = backstage.locator('main');
	expect(
		await content.evaluate((element) => element.getBoundingClientRect().width),
	).toBeGreaterThan(500);
});

test('all rows remain reachable in a short desktop window', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 450 });
	await loadDeck(page);
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File' })
		.click();
	const rows = page.getByRole('dialog', { name: 'File' }).locator('[data-pptx-backstage-nav-item]');
	await rows.last().scrollIntoViewIfNeeded();
	await expect(rows.last()).toBeInViewport();
});
