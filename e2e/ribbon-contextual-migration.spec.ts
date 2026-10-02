/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';

import { elementsOfType, elementWithText, fixture, loadDeck, selectElement } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });
test('every contextual tab uses shared groups and gallery views', async ({ page }, info) => {
	for (const [type, tab] of [
		['shape', 'shapeFormat'],
		['image', 'pictureFormat'],
		['table', 'tableDesign'],
		['chart', 'chartDesign'],
		['smartArt', 'smartArtDesign'],
	] as const) {
		await loadDeck(
			page,
			fixture(type === 'smartArt' ? 'smartart-build-reveal.pptx' : 'ribbon-galleries.pptx'),
		);
		const element =
			type === 'shape'
				? elementWithText(page, 'GALLERY SHAPE')
				: type === 'table'
					? elementWithText(page, '2B')
					: type === 'smartArt'
						? elementWithText(page, 'Alpha')
						: elementsOfType(page, type).first();
		await selectElement(page, element);
		const button = page.locator(`[data-ribbon-contextual-tab="${tab}"]`).first();
		await expect(button).toBeVisible();
		await button.click();
		const groups = page.locator(`pptx-ui-ribbon-group[data-ribbon-group^="${tab}."]`);
		// Rendering the tab's groups can lag the click by a frame (Angular), so wait for them.
		await expect(groups.first()).toBeAttached();
		const galleries = groups.locator('pptx-ui-ribbon-gallery');
		await expect(galleries.first()).toBeAttached();
		for (const group of await groups.all()) {
			await expect(group).toHaveAttribute('role', 'group');
			await expect(group).toHaveAttribute('aria-label', /.+/u);
		}
		for (const gallery of await galleries.all()) {
			await expect(gallery.locator('[data-ribbon-gallery]')).toBeVisible();
		}
		await page.screenshot({ path: info.outputPath(`${tab}.png`) });
	}
});
