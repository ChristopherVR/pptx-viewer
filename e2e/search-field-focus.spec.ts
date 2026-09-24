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
		const root = element.getRootNode();
		const container = root instanceof ShadowRoot ? root.host : element.parentElement;
		if (!container) {
			throw new Error('Search input has no visual container');
		}
		return getComputedStyle(container).borderColor;
	});
	await input.focus();
	await expect(input).toBeFocused();
	return input.evaluate((element, baseBorder) => {
		const root = element.getRootNode();
		const container = root instanceof ShadowRoot ? root.host : element.parentElement;
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

async function visualStyle(input: Locator, property: 'outlineStyle'): Promise<string> {
	return input.evaluate((element, name) => {
		const root = element.getRootNode();
		const container = root instanceof ShadowRoot ? root.host : element.parentElement;
		if (!container) {
			throw new Error('Search input has no visual container');
		}
		return getComputedStyle(container)[name];
	}, property);
}

async function visualBounds(input: Locator): Promise<{ x: number; width: number }> {
	return input.evaluate((element) => {
		const root = element.getRootNode();
		const container = root instanceof ShadowRoot ? root.host : element.parentElement;
		if (!container) {
			throw new Error('Search input has no visual container');
		}
		const { x, width } = container.getBoundingClientRect();
		return { x, width };
	});
}

async function openBackstage(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	await expect(page.getByRole('dialog', { name: 'File' })).toBeVisible();
}

function titleSearch(page: Page): Locator {
	return page.locator('pptx-ui-search[variant="titlebar"] input[part="input"]');
}

function recentSearch(page: Page): Locator {
	return page.getByRole('dialog', { name: 'File' }).locator('pptx-ui-search input[part="input"]');
}

test('title-bar and recent-files search show one restrained focus border', async ({ page }) => {
	await loadDeck(page);
	const titleInput = titleSearch(page);
	const title = await focusStyle(titleInput);
	await titleInput.fill('save');
	await expect(titleInput).toBeFocused();
	await openBackstage(page);
	const recentInput = recentSearch(page);
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
	const title = titleSearch(page);
	await title.focus();
	expect(await visualStyle(title, 'outlineStyle')).toBe('solid');
	await openBackstage(page);
	const recent = recentSearch(page);
	await recent.focus();
	expect(await visualStyle(recent, 'outlineStyle')).toBe('solid');
});

test('both search fields stay within a narrow desktop viewport', async ({ page }) => {
	await page.setViewportSize({ width: 800, height: 600 });
	await loadDeck(page);
	const title = titleSearch(page);
	await expect(title).toBeVisible();
	const titleBox = await visualBounds(title);
	expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(800);

	await openBackstage(page);
	const recent = recentSearch(page);
	await expect(recent).toBeVisible();
	const recentBox = await visualBounds(recent);
	expect(recentBox.x + recentBox.width).toBeLessThanOrEqual(800);
});
