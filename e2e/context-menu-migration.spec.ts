/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
/**
 * The shared `pptx-ui-context-menu` behind every binding's context menus.
 *
 * One spec, run once per binding: the element, canvas, slide-thumbnail and
 * slide-show menus are all drawn by the same element, so the keyboard model,
 * focus, dismissal, clamping, touch targets and forced colours are asserted
 * through the same locators everywhere.
 *
 * Run: bunx playwright test context-menu-migration
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { stageElements } from './support/context-menu';
import { loadDeck, slideStage } from './support/deck';
import { emptyCanvasPoint } from './support/empty-canvas';

// Tall enough that the tallest menu opens where it was asked, not flipped under the pointer
// (hovering a row focuses it, like a native menu).
test.use({ viewport: { width: 1440, height: 1300 } });

const menu = (page: Page): Locator => page.locator('pptx-ui-context-menu');
const row = (page: Page, name: string | RegExp): Locator =>
	menu(page).getByRole('menuitem', { name, exact: typeof name === 'string' });

async function openDeck(page: Page): Promise<void> {
	await loadDeck(page);
	await slideStage(page).waitFor();
	await page.waitForTimeout(500);
}

async function rightClickShape(page: Page): Promise<void> {
	const shape = stageElements(page).filter({ hasText: 'Product Overview' }).first();
	const box = (await shape.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
	await expect(menu(page)).toHaveCount(1);
}

test('the element menu is one shared element with menu semantics, markers and a focused first row', async ({
	page,
}) => {
	await openDeck(page);
	await rightClickShape(page);
	await expect(menu(page)).toHaveAttribute('data-pptx-context-menu', 'true');
	const surface = menu(page).getByRole('menu', { name: 'Context menu' });
	await expect(surface).toBeVisible();
	await expect(menu(page).getByRole('separator').first()).toBeAttached();
	await expect(row(page, 'Copy')).toBeFocused();
	// Exactly one row is a tab stop (roving focus).
	await expect(menu(page).locator('button[tabindex="0"]')).toHaveCount(1);
});

test('arrow keys, Home, End and type-ahead move focus, skipping disabled rows', async ({
	page,
}) => {
	await openDeck(page);
	await rightClickShape(page);
	await expect(row(page, 'Copy')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(row(page, 'Cut')).toBeFocused();
	// Paste is offered but greyed on an empty clipboard: the arrows step over it.
	await page.keyboard.press('ArrowDown');
	await expect(row(page, 'Duplicate')).toBeFocused();
	await page.keyboard.press('End');
	await expect(row(page, 'Delete')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(row(page, 'Copy')).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(row(page, 'Delete')).toBeFocused();
	await page.keyboard.press('Home');
	await expect(row(page, 'Copy')).toBeFocused();
	await page.keyboard.type('du');
	await expect(row(page, 'Duplicate')).toBeFocused();
});

test('Enter runs the focused command through the native handler and closes the menu', async ({
	page,
}) => {
	await openDeck(page);
	const before = await stageElements(page).count();
	await rightClickShape(page);
	await page.keyboard.type('du');
	await expect(row(page, 'Duplicate')).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(menu(page)).toHaveCount(0);
	await expect(stageElements(page)).toHaveCount(before + 1);
});

test('Escape and an outside press dismiss the menu and it reopens cleanly', async ({ page }) => {
	await openDeck(page);
	await rightClickShape(page);
	await page.keyboard.press('Escape');
	await expect(menu(page)).toHaveCount(0);
	await rightClickShape(page);
	await page.mouse.click(5, 450);
	await expect(menu(page)).toHaveCount(0);
	// A second right-click elsewhere replaces rather than stacks menus.
	await rightClickShape(page);
	const point = await emptyCanvasPoint(page);
	await page.mouse.click(point.x, point.y, { button: 'right' });
	await expect(menu(page)).toHaveCount(1);
	await expect(menu(page)).toHaveAttribute('data-pptx-canvas-context-menu', 'true');
});

test('the canvas menu keeps its markers and toggles as checkbox rows', async ({ page }) => {
	await openDeck(page);
	const point = await emptyCanvasPoint(page);
	await page.mouse.click(point.x, point.y, { button: 'right' });
	await expect(menu(page)).toHaveAttribute('data-pptx-context-menu', 'true');
	await expect(menu(page)).toHaveAttribute('data-pptx-canvas-context-menu', 'true');
	await expect(menu(page).getByRole('menu', { name: 'Canvas context menu' })).toBeVisible();
	const grid = menu(page).getByRole('menuitemcheckbox', { name: 'Grid and Guides' });
	await expect(grid).toHaveAttribute('aria-checked', 'false');
	await grid.click();
	await expect(menu(page)).toHaveCount(0);
	await page.mouse.click(point.x, point.y, { button: 'right' });
	await expect(
		menu(page).getByRole('menuitemcheckbox', { name: 'Grid and Guides' }),
	).toHaveAttribute('aria-checked', 'true');
});

test('the slide thumbnail menu is named, marked and runs Duplicate Slide', async ({ page }) => {
	await openDeck(page);
	const slides = page.locator('[aria-label^="Go to slide "]');
	const before = await slides.count();
	await page.locator('[aria-label="Go to slide 2"]').first().click({ button: 'right' });
	await expect(menu(page)).toHaveAttribute('data-pptx-slide-pane-context-menu', 'true');
	await expect(menu(page)).toHaveAttribute('data-pptx-context-menu', 'true');
	await expect(menu(page).getByRole('menuitem')).toHaveCount(6);
	await expect(menu(page).getByRole('menu')).toHaveAccessibleName(/\S/u);
	await row(page, /^Duplicate/u).click();
	await expect(menu(page)).toHaveCount(0);
	await expect(slides).toHaveCount(before + 1);
});

test('the slide-show menu opens above the show, groups its sections and Escape only closes it', async ({
	page,
}) => {
	await openDeck(page);
	await page.getByRole('button', { name: 'Slide show', exact: true }).last().click();
	await page.waitForTimeout(1200);
	await page.mouse.click(300, 300, { button: 'right' });
	const presentation = page.locator('pptx-ui-context-menu[data-pptx-presentation-menu]');
	await expect(presentation).toBeVisible();
	await expect(presentation.getByRole('menuitem', { name: 'Next Slide' })).toBeVisible();
	await expect(presentation.getByRole('group')).toHaveCount(2);
	// Nothing of the show may paint over the menu.
	const covered = await presentation.evaluate((host) => {
		const box = host.getBoundingClientRect();
		const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
		return !(hit === host || host.contains(hit));
	});
	expect(covered).toBe(false);
	await page.keyboard.press('Escape');
	await expect(presentation).toHaveCount(0);
	await page.mouse.click(300, 300, { button: 'right' });
	await presentation.getByRole('menuitem', { name: 'End Presentation' }).click();
	await expect(presentation).toHaveCount(0);
});

test('a menu opened near the bottom-right corner is flipped back inside the window', async ({
	page,
}) => {
	await openDeck(page);
	await page.setViewportSize({ width: 1100, height: 620 });
	await page.waitForTimeout(400);
	const stage = (await slideStage(page).boundingBox())!;
	await page.mouse.click(stage.x + stage.width - 4, stage.y + stage.height - 4, {
		button: 'right',
	});
	await expect(menu(page)).toHaveCount(1);
	const box = (await menu(page).boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(1100);
	expect(box.y + box.height).toBeLessThanOrEqual(620);
});

test('theme tokens style the surface and forced colors drop the shadow', async ({ page }) => {
	await openDeck(page);
	await rightClickShape(page);
	await menu(page).evaluate((host) => host.style.setProperty('--pptx-popover', 'rgb(18, 52, 86)'));
	const surface = menu(page).getByRole('menu');
	await expect(surface).toHaveCSS('background-color', 'rgb(18, 52, 86)');
	await expect(surface).not.toHaveCSS('box-shadow', 'none');
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(surface).toHaveCSS('box-shadow', 'none');
	await expect(row(page, 'Copy')).toBeVisible();
});

test.describe('touch menu', () => {
	test.use({ hasTouch: true });
	test('rows are at least 44px tall on a coarse pointer', async ({ page }) => {
		await openDeck(page);
		// Dispatched, not clicked: the touch layout of some bindings overlays the rail with
		// an inspector backdrop, which is unrelated to the menu under test.
		await page
			.locator('[aria-label="Go to slide 2"]')
			.first()
			.dispatchEvent('contextmenu', { clientX: 80, clientY: 200 });
		await expect(menu(page)).toHaveCount(1);
		const rows = menu(page).getByRole('menuitem');
		await expect(rows).toHaveCount(6);
		for (const box of await rows.evaluateAll((nodes) =>
			nodes.map((node) => node.getBoundingClientRect().height),
		)) {
			expect(box).toBeGreaterThanOrEqual(44);
		}
	});
});
