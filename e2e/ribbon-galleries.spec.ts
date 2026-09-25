/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Ribbon style galleries and group/control-level ribbon customisation, end
 * to end and identically in all five bindings.
 *
 * The galleries are decided in `packages/shared/src/render/ribbon-galleries`
 * (what each offers, how a tile looks, what a pick writes); every binding
 * only renders the descriptor and honours one DOM contract:
 * `data-ribbon-contextual-tab`, `data-ribbon-group`, `data-ribbon-control`,
 * `data-ribbon-gallery` (trigger), `data-ribbon-gallery-popup` and
 * `data-gallery-item` (tile, `aria-pressed` when applied). Customisation is a
 * shared stylesheet keyed on the same ids, so a binding that forgets to tag
 * its markup fails here even when its unit suite is green.
 *
 * Run: PPTX_E2E_PORT_OFFSET=500 bunx playwright test ribbon-galleries --project=react
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	elementsOfType,
	elementWithText,
	fixture,
	loadDeck,
	openRibbonTab,
	selectElement,
} from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('ribbon-galleries.pptx');

function contextualTab(page: Page, id: string): Locator {
	return page.locator(`[data-ribbon-contextual-tab="${id}"]`).first();
}

function popup(page: Page, gallery: string): Locator {
	return page.locator(`[data-ribbon-gallery-popup="${gallery}"]`).first();
}

async function openGallery(page: Page, scope: Locator, gallery: string): Promise<Locator> {
	await scope.locator(`[data-ribbon-gallery="${gallery}"]`).first().click();
	const panel = popup(page, gallery);
	await expect(panel).toBeVisible();
	return panel;
}

function withCustomization(customization: object): string {
	return `/?customization=${encodeURIComponent(JSON.stringify(customization))}`;
}

async function fillOf(target: Locator): Promise<string> {
	return target.evaluate((node) => {
		const painted = [node, ...Array.from(node.querySelectorAll('*'))].map((el) => {
			const style = getComputedStyle(el);
			const svgFill = el instanceof SVGElement ? style.fill : '';
			return `${style.backgroundColor}|${style.backgroundImage}|${svgFill}`;
		});
		return painted.join(';');
	});
}

test.describe('ribbon galleries', () => {
	test('a shape brings up Shape Format, whose Shape Styles pick restyles it', async ({ page }) => {
		await loadDeck(page, DECK);
		const shape = elementWithText(page, 'GALLERY SHAPE');
		await expect(contextualTab(page, 'shapeFormat')).toHaveCount(0);
		await selectElement(page, shape);
		await expect(contextualTab(page, 'shapeFormat')).toBeVisible();
		await contextualTab(page, 'shapeFormat').click();

		const group = page.locator('[data-ribbon-group="shapeFormat.shapeStyles"]').first();
		await expect(group).toBeVisible();
		await expect(group.locator('[data-gallery-item]').first()).toBeVisible();
		await expect(
			page.locator('[data-ribbon-group="shapeFormat.wordArtStyles"]').first(),
		).toBeVisible();

		const before = await fillOf(shape);
		const panel = await openGallery(page, group, 'shapeStyles');
		await expect(panel.locator('[data-gallery-item]')).toHaveCount(77);
		await panel.locator('[data-gallery-item="theme-1-1"]').click();
		await expect(popup(page, 'shapeStyles')).toBeHidden();
		await expect.poll(() => fillOf(shape)).not.toBe(before);

		const reopened = await openGallery(page, group, 'shapeStyles');
		await expect(reopened.locator('[data-gallery-item="theme-1-1"]')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
	});

	test('Home > Drawing offers Quick Styles and a working Shape Effects gallery', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await selectElement(page, elementWithText(page, 'GALLERY SHAPE'));
		await openRibbonTab(page, 'Home');
		const drawing = page.locator('[data-ribbon-group="home.drawing"]').first();
		await expect(drawing.locator('[data-ribbon-control="home.drawing.quickStyles"]')).toBeVisible();
		const effects = drawing.locator('[data-ribbon-control="home.drawing.shapeEffects"]');
		await expect(effects).toBeVisible();
		await expect(effects.locator('[data-ribbon-gallery="shapeEffects"]').first()).toBeEnabled();
	});

	test('Home > Paragraph offers the Bullets and Numbering libraries', async ({ page }) => {
		await loadDeck(page, DECK);
		await selectElement(page, elementWithText(page, 'GALLERY SHAPE'));
		await openRibbonTab(page, 'Home');
		for (const gallery of ['bullets', 'numbering']) {
			const trigger = page.locator(`[data-ribbon-gallery="${gallery}"]`).first();
			await expect(trigger).toBeVisible();
		}
	});

	test('a table brings up Table Design with the built-in table styles', async ({ page }) => {
		await loadDeck(page, DECK);
		await selectElement(page, elementWithText(page, '2B'));
		await expect(contextualTab(page, 'tableDesign')).toBeVisible();
		await expect(contextualTab(page, 'shapeFormat')).toHaveCount(0);
		await contextualTab(page, 'tableDesign').click();
		const group = page.locator('[data-ribbon-group="tableDesign.tableStyles"]').first();
		const panel = await openGallery(page, group, 'tableStyles');
		expect(await panel.locator('[data-gallery-item]').count()).toBeGreaterThan(60);
	});

	test('a picture brings up Picture Format, whose Picture Styles pick sticks', async ({ page }) => {
		await loadDeck(page, DECK);
		const picture = elementsOfType(page, 'image').first();
		await expect(contextualTab(page, 'pictureFormat')).toHaveCount(0);
		await selectElement(page, picture);
		await expect(contextualTab(page, 'pictureFormat')).toBeVisible();
		await expect(contextualTab(page, 'shapeFormat')).toHaveCount(0);
		await contextualTab(page, 'pictureFormat').click();

		const group = page.locator('[data-ribbon-group="pictureFormat.pictureStyles"]').first();
		await expect(group).toBeVisible();
		const panel = await openGallery(page, group, 'pictureStyles');
		await expect(panel.locator('[data-gallery-item]')).toHaveCount(28);
		await panel.locator('[data-gallery-item="metalOval"]').click();
		await expect(popup(page, 'pictureStyles')).toBeHidden();

		const reopened = await openGallery(page, group, 'pictureStyles');
		await expect(reopened.locator('[data-gallery-item="metalOval"]')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect(reopened.locator('[data-gallery-item="simpleFrameWhite"]')).not.toHaveAttribute(
			'aria-pressed',
			'true',
		);
	});

	test('the contextual tab goes away when the selection does', async ({ page }) => {
		await loadDeck(page, DECK);
		await selectElement(page, elementWithText(page, 'GALLERY SHAPE'));
		await contextualTab(page, 'shapeFormat').click();
		await page.keyboard.press('Escape');
		await expect(contextualTab(page, 'shapeFormat')).toHaveCount(0);
		await expect(page.locator('[data-ribbon-group="shapeFormat.shapeStyles"]')).toHaveCount(0);
	});

	test('Design shows the Variants colour and font galleries', async ({ page }) => {
		await loadDeck(page, DECK);
		await openRibbonTab(page, 'Design');
		const variants = page.locator('[data-ribbon-group="design.variants"]').first();
		await expect(variants).toBeVisible();
		await expect(variants.locator('[data-ribbon-gallery="themeColors"]').first()).toBeVisible();
		await expect(variants.locator('[data-ribbon-gallery="themeFonts"]').first()).toBeVisible();
	});
});

test.describe('ribbon group and control customisation', () => {
	test('hidden groups and controls never show; the rest of the tab does', async ({ page }) => {
		await loadDeck(
			page,
			DECK,
			withCustomization({
				ribbon: {
					hiddenGroups: ['home.font'],
					hiddenButtons: ['home.paragraph.bullets'],
					hiddenTabs: ['tableDesign'],
				},
			}),
		);
		await openRibbonTab(page, 'Home');
		await expect(page.locator('[data-ribbon-group="home.clipboard"]').first()).toBeVisible();
		await expect(page.locator('[data-ribbon-group="home.font"]').first()).toBeHidden();
		await expect(
			page.locator('[data-ribbon-control="home.paragraph.bullets"]').first(),
		).toBeHidden();
		await expect(
			page.locator('[data-ribbon-control="home.paragraph.numbering"]').first(),
		).toBeVisible();
		await selectElement(page, elementWithText(page, '2B'));
		await expect(contextualTab(page, 'tableDesign')).toHaveCount(0);
	});

	test('every binding tags the Home groups with the shared catalogue ids', async ({ page }) => {
		await loadDeck(page, DECK);
		await openRibbonTab(page, 'Home');
		const ids = await page
			.locator('[data-ribbon-group^="home."]')
			.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-ribbon-group')));
		for (const id of [
			'home.clipboard',
			'home.slides',
			'home.font',
			'home.paragraph',
			'home.drawing',
			'home.editing',
		]) {
			expect(ids).toContain(id);
		}
	});

	test('the imperative helpers hide and restore a group live', async ({ page }) => {
		await loadDeck(page, DECK);
		await openRibbonTab(page, 'Home');
		const editing = page.locator('[data-ribbon-group="home.editing"]').first();
		await expect(editing).toBeVisible();
		type HandleWindow = { __pptxViewer?: Record<string, (...args: unknown[]) => void> };
		await page.waitForFunction(
			() => typeof (window as HandleWindow).__pptxViewer?.hideRibbonGroup === 'function',
		);
		await page.evaluate(() =>
			(window as HandleWindow).__pptxViewer?.hideRibbonGroup?.('home.editing'),
		);
		await openRibbonTab(page, 'Home');
		await expect(page.locator('[data-ribbon-group="home.editing"]').first()).toBeHidden();
		await page.evaluate(() =>
			(window as HandleWindow).__pptxViewer?.showRibbonGroup?.('home.editing'),
		);
		await openRibbonTab(page, 'Home');
		await expect(page.locator('[data-ribbon-group="home.editing"]').first()).toBeVisible();
	});
});
