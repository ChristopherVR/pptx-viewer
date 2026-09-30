/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import {
	elementsOfType,
	elementWithText,
	fixture,
	loadDeck,
	ribbonTab,
	selectElement,
} from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1440, height: 900 } });

for (const scenario of [
	{ tab: 'chartDesign', gallery: 'chartStyles', deck: 'ribbon-galleries.pptx', item: 'monochrome' },
	{
		tab: 'smartArtDesign',
		gallery: 'smartArtStyles',
		deck: 'smartart-build-reveal.pptx',
		item: 'intense',
	},
	{
		tab: 'smartArtDesign',
		gallery: 'smartArtColors',
		deck: 'smartart-build-reveal.pptx',
		item: 'monochromatic2',
	},
]) {
	test(`${scenario.tab}/${scenario.gallery} uses shared galleries and retains picks across save and reload`, async ({
		page,
	}, info) => {
		await loadDeck(page, fixture(scenario.deck));
		const element =
			scenario.tab === 'chartDesign'
				? elementsOfType(page, 'chart').first()
				: elementWithText(page, 'Alpha');
		await selectElement(page, element);
		await page.locator(`[data-ribbon-contextual-tab="${scenario.tab}"]`).click();
		const gallery = page
			.locator(`pptx-ui-ribbon-gallery:has([data-ribbon-gallery="${scenario.gallery}"])`)
			.first();
		const trigger = gallery.locator('[data-ribbon-gallery]');
		await trigger.click();
		const popup = gallery.locator('[data-ribbon-gallery-popup]');
		await expect(popup).toBeVisible();
		await popup.locator(`[data-gallery-item="${scenario.item}"]`).click();
		await expect(popup).toHaveCount(0);
		await trigger.click();
		await expect(popup.locator(`[data-gallery-item="${scenario.item}"]`)).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await page.screenshot({ path: info.outputPath(`${scenario.tab}-after.png`) });
		await trigger.press('Escape');
		await expect(trigger).toBeFocused();
		const bytes = await downloadBytes(await savePptxViaBackstage(page));
		const savedPath = info.outputPath('gallery-edit.pptx');
		await writeFile(savedPath, bytes);
		await loadDeck(page, savedPath);
		await selectElement(
			page,
			scenario.tab === 'chartDesign'
				? elementsOfType(page, 'chart').first()
				: elementWithText(page, 'Alpha'),
		);
		await page.locator(`[data-ribbon-contextual-tab="${scenario.tab}"]`).click();
		await page.locator(`[data-ribbon-gallery="${scenario.gallery}"]`).first().click();
		await expect(
			page.locator(`[data-ribbon-gallery-popup] [data-gallery-item="${scenario.item}"]`),
		).toHaveAttribute('aria-pressed', 'true');
	});
}

test('shared gallery preserves keyboard focus, tokens and reachable touch choices', async ({
	page,
}) => {
	await loadDeck(page, fixture('ribbon-galleries.pptx'));
	await selectElement(page, elementWithText(page, 'GALLERY SHAPE'));
	await page.locator('[data-ribbon-contextual-tab="shapeFormat"]').click();
	const gallery = page.locator(
		'pptx-ui-ribbon-gallery[data-ribbon-control="shapeFormat.shapeStyles.gallery"]',
	);
	const trigger = gallery.locator('[data-ribbon-gallery]');
	await trigger.focus();
	await trigger.press('ArrowDown');
	await expect(
		gallery.locator('[data-ribbon-gallery-popup] [data-gallery-item]').first(),
	).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(trigger).toBeFocused();
	await page.setViewportSize({ width: 900, height: 900 });
	await trigger.click();
	const popup = gallery.locator('[data-ribbon-gallery-popup]');
	const box = await popup.boundingBox();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(900);
	const tile = await popup.locator('[data-gallery-item]').first().boundingBox();
	expect(tile!.width).toBeGreaterThanOrEqual(44);
	expect(tile!.height).toBeGreaterThanOrEqual(44);
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(popup.locator('[data-gallery-item]').first()).toBeVisible();
});

test.describe('coarse pointer galleries', () => {
	test.use({ hasTouch: true });

	test('theme choices are reachable with touch and meet the target size', async ({ page }) => {
		await loadDeck(page, fixture('ribbon-galleries.pptx'));
		await ribbonTab(page, 'Design').tap();
		const trigger = page.locator('[data-ribbon-gallery="themeColors"]').first();
		await trigger.tap();
		const popup = page.locator('[data-ribbon-gallery-popup="themeColors"]');
		const tile = popup.locator('[data-gallery-item]').first();
		const box = await tile.boundingBox();

		expect(box!.width).toBeGreaterThanOrEqual(44);
		expect(box!.height).toBeGreaterThanOrEqual(44);
		await tile.tap();
		await expect(popup).toHaveCount(0);
	});
});
