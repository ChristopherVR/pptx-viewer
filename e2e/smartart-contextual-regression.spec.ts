/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
/**
 * Regression guard for the two SmartArt interactions a user reached for first:
 * double-clicking a node to type into it, and selecting the graphic to restyle
 * it from the contextual SmartArt Design tab (Change Colors, SmartArt Styles).
 * Both are asserted against the SAVED package, not just the canvas, so a binding
 * cannot satisfy the spec by painting something the document never received.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { elementWithText, fixture, loadDeck, slideStage } from './support/deck';
import { downloadBytes } from './support/exports';
import { readZipPartText } from './support/pptx-xml';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('smartart-build-reveal.pptx');

/** The centre of a SmartArt node that the browser really hits, so a click lands on it. */
async function hittableNodePoint(page: Page): Promise<{ x: number; y: number }> {
	await expect(slideStage(page).locator('[data-smartart-node-id]').first()).toBeAttached();
	const point = await slideStage(page).evaluate((stage) => {
		for (const node of stage.querySelectorAll('[data-smartart-node-id]')) {
			const box = node.getBoundingClientRect();
			const x = box.left + box.width / 2;
			const y = box.top + box.height / 2;
			if (box.width > 10 && node.contains(document.elementFromPoint(x, y))) {
				return { x, y };
			}
		}
		return null;
	});
	if (!point) {
		throw new Error('no SmartArt node takes a pointer');
	}
	return point;
}

async function savedPart(page: Page, part: string): Promise<string> {
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	return readZipPartText(bytes, part);
}

test('double-clicking a SmartArt node edits it inline and the text is saved', async ({ page }) => {
	await loadDeck(page, DECK);
	const point = await hittableNodePoint(page);
	await page.mouse.dblclick(point.x, point.y);
	const editor = page.locator('[data-pptx-viewport] textarea:visible');
	await expect(editor).toHaveCount(1);
	await expect(editor).toBeFocused();
	await editor.fill('Typed in place');
	await editor.press('Enter');
	await expect(editor).toHaveCount(0);
	await expect(elementWithText(page, 'Typed in place')).toBeVisible();
	const data = await savedPart(page, 'ppt/diagrams/data1.xml');
	expect(data).toContain('Typed in place');
});

test('a selected SmartArt shows its contextual tab and Change Colors applies a scheme', async ({
	page,
}) => {
	await loadDeck(page, DECK);
	const before = await savedPart(page, 'ppt/diagrams/colors1.xml');
	const point = await hittableNodePoint(page);
	await page.mouse.click(point.x, point.y);
	const tab = page.locator('[data-ribbon-contextual-tab="smartArtDesign"]').first();
	await expect(tab).toBeVisible();
	await tab.click();
	const colors = page.locator('[data-ribbon-gallery="smartArtColors"]').first();
	const styles = page.locator('[data-ribbon-gallery="smartArtStyles"]').first();
	await expect(colors).toBeVisible();
	await expect(styles).toBeVisible();

	await colors.click();
	const popup = page.locator('[data-ribbon-gallery-popup="smartArtColors"]');
	await expect(popup).toBeVisible();
	await popup.locator('[data-gallery-item="monochromatic2"]').click();
	await expect(popup).toHaveCount(0);

	await expect
		.poll(async () => savedPart(page, 'ppt/diagrams/colors1.xml'), { timeout: 20_000 })
		.not.toBe(before);
});

test('deselecting the SmartArt removes its contextual tab', async ({ page }) => {
	await loadDeck(page, DECK);
	const point = await hittableNodePoint(page);
	await page.mouse.click(point.x, point.y);
	await expect(page.locator('[data-ribbon-contextual-tab="smartArtDesign"]').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-ribbon-contextual-tab="smartArtDesign"]')).toHaveCount(0);
});
