/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright uses its own test API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	openMenuAt,
	openMenuOn,
	stageElements,
	VISIBLE_MENU_SELECTOR,
} from './support/context-menu';
import { loadDeck, slideStage, thumbnail } from './support/deck';

type HostWindow = Window & {
	__pptxViewer?: { setCustomization: (value: object) => void };
	__hostCalls?: { slideIndex: number; elementIds?: readonly string[] }[];
};

test.use({ viewport: { width: 1440, height: 900 } });

async function installCommands(page: Page, replacement = false): Promise<void> {
	await page.waitForFunction(
		() => typeof (window as HostWindow).__pptxViewer?.setCustomization === 'function',
	);
	await page.evaluate((replace) => {
		const host = window as HostWindow;
		host.__hostCalls ??= [];
		const onSelect = (context: { slideIndex: number; elementIds?: readonly string[] }) =>
			host.__hostCalls!.push(context);
		host.__pptxViewer!.setCustomization({
			contextMenu: {
				extraElementCommands: [
					{ id: 'copy', label: replace ? 'Updated command' : 'Send to chat', onSelect },
					{
						id: 'disabled',
						label: 'Unavailable command',
						disabled: (ctx: { elementIds: readonly string[] }) => ctx.elementIds.length > 0,
						onSelect,
					},
				],
				extraCanvasCommands: [{ id: 'slide', label: 'Send slide', group: 'bottom', onSelect }],
			},
		});
	}, replacement);
}

async function emptyCanvasPoint(page: Page): Promise<{ x: number; y: number }> {
	const box = await slideStage(page).boundingBox();
	if (!box) {
		throw new Error('slide has no bounding box');
	}
	const points = [0.95, 0.8, 0.5, 0.1].flatMap((fy) =>
		[0.95, 0.8, 0.5, 0.1].map((fx) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy })),
	);
	const point = await page.evaluate(
		(candidates) =>
			candidates.find(({ x, y }) => {
				const hit = document.elementFromPoint(x, y);
				return hit?.closest('[aria-roledescription="slide"]') && !hit.closest('[data-element-id]');
			}) ?? null,
		points,
	);
	if (!point) {
		throw new Error('no empty canvas point');
	}
	return point;
}

test('host element and canvas commands preserve built-ins and receive live slide context', async ({
	page,
}) => {
	await loadDeck(page);
	await installCommands(page);
	// The last element is above the deck's background panel at its center.
	const element = stageElements(page).last();
	const id = await element.getAttribute('data-element-id');
	const menu = await openMenuOn(page, element);
	expect(menu.labels[0]).toBe('send to chat');
	expect(menu.labels).toContain('copy');
	expect(
		menu.commands.find((command) => command.label === 'Unavailable command')?.disabled,
	).toBeTruthy();
	await page
		.locator(VISIBLE_MENU_SELECTOR)
		.last()
		.getByRole('menuitem', { name: 'Send to chat', exact: true })
		.click();
	await expect(page.locator(VISIBLE_MENU_SELECTOR)).toHaveCount(0);
	expect(await page.evaluate(() => (window as HostWindow).__hostCalls)).toStrictEqual([
		{ slideIndex: 0, elementIds: [id] },
	]);

	await installCommands(page, true);
	const updated = await openMenuOn(page, element);
	expect(updated.labels).not.toContain('send to chat');
	expect(updated.labels[0]).toBe('updated command');
	await page.keyboard.press('Escape');
	await thumbnail(page, 2).click();
	await expect(stageElements(page).first()).toBeVisible();
	const canvas = await openMenuAt(page, await emptyCanvasPoint(page));
	expect(canvas.labels.at(-1)).toBe('send slide');
	expect(canvas.labels).toContain('reset slide');
	await page
		.locator(VISIBLE_MENU_SELECTOR)
		.last()
		.getByRole('menuitem', { name: 'Send slide', exact: true })
		.click();
	await expect(page.locator(VISIBLE_MENU_SELECTOR)).toHaveCount(0);
	expect(await page.evaluate(() => (window as HostWindow).__hostCalls?.at(-1))).toStrictEqual({
		slideIndex: 1,
	});
});
