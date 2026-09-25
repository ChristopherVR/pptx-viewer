/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Edit Points (right-click a shape > Edit Points) and the Insert > Shapes
 * Freeform: Shape / Curve tools, in whichever binding the project points at.
 *
 * Every assertion goes through the framework-neutral contract the five
 * bindings share: the shared context-menu command labels, and the
 * `data-pptx-edit-points-*` / `data-pptx-drawing-tool` /
 * `data-pptx-freeform-tool-overlay` attributes each binding stamps on the view
 * it draws from the shared `EditPointsSession` / `FreeformToolSession`.
 *
 * Fixture: `edit-points.pptx` ("EP Star" is a plain star5 preset; "EP Locked"
 * carries `a:spLocks noEditPoints="1"`).
 *
 * Run: PPTX_E2E_PORT_OFFSET=200 bunx playwright test edit-points --project=react
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { chooseCommand, commandNamed, openMenuOn } from './support/context-menu';
import { fixture, loadDeck, openRibbonTab, slideElements, slideStage } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('edit-points.pptx');
const OVERLAY = '[data-pptx-edit-points-overlay]';
const NODES = '[data-pptx-edit-points-target^="node:"]';

function shape(page: Page, label: string): Locator {
	return slideElements(page).filter({ hasText: label }).first();
}

async function openDeck(page: Page): Promise<void> {
	await loadDeck(page, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(400);
}

async function startEditPoints(page: Page): Promise<void> {
	await openMenuOn(page, shape(page, 'EP Star'));
	await chooseCommand(page, 'Edit Points');
	await expect(page.locator(OVERLAY)).toHaveCount(1);
}

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
	const box = await locator.boundingBox();
	if (!box) {
		throw new Error('element has no box');
	}
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A slide-pixel point as a viewport point over `stage`. */
async function slidePoint(stage: Locator, x: number, y: number): Promise<[number, number]> {
	const box = await stage.boundingBox();
	if (!box) {
		throw new Error('stage has no box');
	}
	return [box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720];
}

test.describe('edit points', () => {
	test('the context menu offers Edit Points, greyed for a noEditPoints lock', async ({ page }) => {
		await openDeck(page);
		const star = await openMenuOn(page, shape(page, 'EP Star'));
		expect(commandNamed(star, 'edit points')?.disabled).toBe(false);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
		const locked = await openMenuOn(page, shape(page, 'EP Locked'));
		expect(commandNamed(locked, 'edit points')?.disabled).toBe(true);
	});

	test('dragging a vertex reshapes the star and Escape leaves the mode', async ({ page }) => {
		await openDeck(page);
		const before = await shape(page, 'EP Star').boundingBox();
		await startEditPoints(page);
		// A converted star5 has ten vertices, the first on its left arm.
		await expect(page.locator(NODES)).toHaveCount(10);
		const arm = await centre(page.locator(NODES).first());
		await page.mouse.move(arm.x, arm.y);
		await page.mouse.down();
		await page.mouse.move(arm.x - 60, arm.y - 20, { steps: 6 });
		await page.mouse.up();
		await page.waitForTimeout(300);
		await page.keyboard.press('Escape');
		await expect(page.locator(OVERLAY)).toHaveCount(0);
		const after = await shape(page, 'EP Star').boundingBox();
		expect(before && after).toBeTruthy();
		// The box grew to the left to follow the dragged arm.
		expect(after!.x).toBeLessThan(before!.x - 30);
		expect(after!.width).toBeGreaterThan(before!.width + 30);
	});

	test('right-clicking a vertex opens the point menu and its commands run', async ({ page }) => {
		await openDeck(page);
		await startEditPoints(page);
		const node = await centre(page.locator(NODES).nth(2));
		await page.mouse.click(node.x, node.y, { button: 'right' });
		const menu = page.locator('[data-pptx-edit-points-menu]');
		await expect(menu).toBeVisible();
		await expect(menu).toHaveAttribute('role', 'menu');
		const ids = await menu
			.locator('[data-pptx-edit-points-command]')
			.evaluateAll((els) => els.map((el) => el.getAttribute('data-pptx-edit-points-command')));
		expect(ids).toEqual(
			expect.arrayContaining(['add-point', 'delete-point', 'smooth-point', 'corner-point', 'exit']),
		);
		await menu.getByRole('menuitem', { name: 'Delete Point' }).click();
		await expect(menu).toHaveCount(0);
		await expect(page.locator(NODES)).toHaveCount(9);
		await page.keyboard.press('Escape');
		await expect(page.locator(OVERLAY)).toHaveCount(0);
	});
});

test.describe('freeform drawing tools', () => {
	test('Freeform: Shape closes on its start point and Curve finishes on double-click', async ({
		page,
	}) => {
		await openDeck(page);
		const stage = slideStage(page);
		const count = await slideElements(page).count();

		await openRibbonTab(page, 'Insert');
		await page.locator('[data-pptx-drawing-tool="freeformShape"]').first().click();
		await expect(page.locator('[data-pptx-freeform-tool-overlay="freeformShape"]')).toHaveCount(1);
		for (const [x, y] of [
			[600, 150],
			[900, 180],
			[800, 400],
			[601, 151],
		]) {
			const [cx, cy] = await slidePoint(stage, x, y);
			await page.mouse.click(cx, cy);
		}
		await expect(page.locator('[data-pptx-freeform-tool-overlay]')).toHaveCount(0);
		await expect(slideElements(page)).toHaveCount(count + 1);

		await page.locator('[data-pptx-drawing-tool="curve"]').first().click();
		await expect(page.locator('[data-pptx-freeform-tool-overlay="curve"]')).toHaveCount(1);
		for (const [x, y] of [
			[650, 500],
			[800, 450],
			[950, 600],
		]) {
			const [cx, cy] = await slidePoint(stage, x, y);
			await page.mouse.click(cx, cy);
		}
		const [ex, ey] = await slidePoint(stage, 1100, 480);
		await page.mouse.dblclick(ex, ey);
		await expect(page.locator('[data-pptx-freeform-tool-overlay]')).toHaveCount(0);
		await expect(slideElements(page)).toHaveCount(count + 2);
	});
});
