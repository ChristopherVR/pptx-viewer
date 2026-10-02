/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
/**
 * Selecting an object brings up exactly its contextual tab, with that tab's
 * groups and galleries reachable, in every binding. Selecting something else
 * swaps the tab, and clearing the selection removes it. Media (audio/video) and
 * text boxes without shape properties have no contextual tab by design, so they
 * are not asserted here.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { elementsOfType, elementWithText, fixture, loadDeck, selectElement } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const CASES: readonly {
	tab: string;
	deck: string;
	target: (page: Page) => Locator;
	galleries: readonly string[];
}[] = [
	{
		tab: 'shapeFormat',
		deck: 'ribbon-galleries.pptx',
		target: (page) => elementWithText(page, 'GALLERY SHAPE'),
		galleries: ['shapeStyles'],
	},
	{
		tab: 'pictureFormat',
		deck: 'ribbon-galleries.pptx',
		target: (page) => elementsOfType(page, 'image').first(),
		galleries: ['pictureStyles'],
	},
	{
		tab: 'tableDesign',
		deck: 'ribbon-galleries.pptx',
		target: (page) => elementWithText(page, '2B'),
		galleries: ['tableStyles'],
	},
	{
		tab: 'chartDesign',
		deck: 'ribbon-galleries.pptx',
		target: (page) => elementsOfType(page, 'chart').first(),
		galleries: ['chartColors', 'chartStyles'],
	},
	{
		tab: 'smartArtDesign',
		deck: 'smartart-build-reveal.pptx',
		target: (page) => elementWithText(page, 'Alpha'),
		galleries: ['smartArtColors', 'smartArtStyles'],
	},
];

const anyContextual = (page: Page) => page.locator('[data-ribbon-contextual-tab]');

for (const scenario of CASES) {
	test(`selecting a ${scenario.tab} object shows its tab and galleries`, async ({ page }) => {
		await loadDeck(page, fixture(scenario.deck));
		await expect(anyContextual(page)).toHaveCount(0);
		await selectElement(page, scenario.target(page));
		const tab = page.locator(`[data-ribbon-contextual-tab="${scenario.tab}"]`).first();
		await expect(tab).toBeVisible();
		await tab.click();
		await expect(
			page.locator(`pptx-ui-ribbon-group[data-ribbon-group^="${scenario.tab}."]`).first(),
		).toBeVisible();
		for (const gallery of scenario.galleries) {
			await expect(
				page
					.locator(
						`pptx-ui-ribbon-group[data-ribbon-group^="${scenario.tab}."] [data-ribbon-gallery="${gallery}"]`,
					)
					.first(),
			).toBeVisible();
		}
		await page.keyboard.press('Escape');
		await expect(page.locator(`[data-ribbon-contextual-tab="${scenario.tab}"]`)).toHaveCount(0);
	});
}

test('moving the selection between object types swaps the contextual tab', async ({ page }) => {
	await loadDeck(page, fixture('ribbon-galleries.pptx'));
	await selectElement(page, elementWithText(page, 'GALLERY SHAPE'));
	await expect(page.locator('[data-ribbon-contextual-tab="shapeFormat"]').first()).toBeVisible();
	await selectElement(page, elementsOfType(page, 'chart').first());
	await expect(page.locator('[data-ribbon-contextual-tab="chartDesign"]').first()).toBeVisible();
	await expect(page.locator('[data-ribbon-contextual-tab="shapeFormat"]')).toHaveCount(0);
});
