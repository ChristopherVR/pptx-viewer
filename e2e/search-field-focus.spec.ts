/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/** Search fields must put one restrained focus treatment on their outer control. */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { loadDeck } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

async function focusStyle(input: Locator): Promise<{
	inputOutline: string;
	restingBorder: string;
	containerBorder: string;
	containerShadow: string;
	containerHeight: number;
}> {
	await input.evaluate((element) => element.blur());
	const restingBorder = await input.evaluate((element) => {
		if (!element.parentElement) {
			throw new Error('Search input has no visual container');
		}
		return getComputedStyle(element.parentElement).borderColor;
	});
	await input.focus();
	await expect(input).toBeFocused();
	return input.evaluate((element, baseBorder) => {
		const container = element.parentElement;
		if (!container) {
			throw new Error('Search input has no visual container');
		}
		const inputStyle = getComputedStyle(element);
		const containerStyle = getComputedStyle(container);
		return {
			inputOutline: inputStyle.outlineStyle,
			restingBorder: baseBorder,
			containerBorder: containerStyle.borderColor,
			containerShadow: containerStyle.boxShadow,
			containerHeight: container.getBoundingClientRect().height,
		};
	}, restingBorder);
}

async function openBackstage(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	await expect(page.getByRole('dialog', { name: 'File' })).toBeVisible();
}

test('title-bar and recent-files search show one restrained focus border', async ({ page }) => {
	await loadDeck(page);
	const titleInput = page.getByPlaceholder('Tell me what you want to do');
	const title = await focusStyle(titleInput);
	await titleInput.fill('save');
	await expect(titleInput).toBeFocused();
	await openBackstage(page);
	const recentInput = page
		.getByRole('dialog', { name: 'File' })
		.getByPlaceholder('Search recent presentations');
	const recent = await focusStyle(recentInput);
	await recentInput.fill('example');
	await expect(recentInput).toBeFocused();

	for (const [name, style] of [
		['title bar', title],
		['recent files', recent],
	] as const) {
		expect(style.inputOutline, `${name}: inner input must not draw a second outline`).toBe('none');
		expect(style.containerBorder, `${name}: outer border must respond to focus`).not.toBe(
			style.restingBorder,
		);
		expect(style.containerShadow, `${name}: ordinary focus should not add a heavy halo`).toBe(
			'none',
		);
	}
	// Distinct sizes match the two chrome locations without binding-specific numbers.
	expect(title.containerHeight).toBeGreaterThan(20);
	expect(recent.containerHeight).toBeGreaterThan(title.containerHeight);
});

test('search focus remains visible in forced-colors mode', async ({ page }) => {
	await page.emulateMedia({ forcedColors: 'active' });
	await loadDeck(page);
	const title = page.getByPlaceholder('Tell me what you want to do');
	await title.focus();
	await expect(title.locator('..')).toHaveCSS('outline-style', 'solid');
	await openBackstage(page);
	const recent = page
		.getByRole('dialog', { name: 'File' })
		.getByPlaceholder('Search recent presentations');
	await recent.focus();
	await expect(recent.locator('..')).toHaveCSS('outline-style', 'solid');
});

test('both search fields stay within a narrow desktop viewport', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 600 });
	await loadDeck(page);
	const title = page.getByPlaceholder('Tell me what you want to do');
	await expect(title).toBeVisible();
	const titleBox = await title.locator('..').boundingBox();
	expect(titleBox).not.toBeNull();
	expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(800);

	await openBackstage(page);
	const recent = page
		.getByRole('dialog', { name: 'File' })
		.getByPlaceholder('Search recent presentations');
	await expect(recent).toBeVisible();
	const recentBox = await recent.locator('..').boundingBox();
	expect(recentBox).not.toBeNull();
	expect(recentBox!.x + recentBox!.width).toBeLessThanOrEqual(800);
});
