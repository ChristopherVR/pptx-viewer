import { writeFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { savePptxViaBackstage } from './save-pptx';
import { fixture, loadDeck, ribbonTab, selectElement, slideElements } from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1440, height: 900 } });

const GROUPS = [
	'insert.tables',
	'insert.images',
	'insert.illustrations',
	'insert.links',
	'insert.text',
	'insert.symbols',
	'insert.media',
];
const CONTROLS = [
	'insert.tables.table',
	'insert.images.pictures',
	'insert.illustrations.shapes',
	'insert.illustrations.smartArt',
	'insert.illustrations.chart',
	'insert.links.link',
	'insert.links.action',
	'insert.text.textBox',
	'insert.text.field',
	'insert.symbols.equation',
	'insert.media.media',
];

async function openInsert(page: Page, customization?: unknown) {
	await loadDeck(
		page,
		undefined,
		customization ? `/?customization=${encodeURIComponent(JSON.stringify(customization))}` : '/',
	);
	await ribbonTab(page, 'Insert').click();
	return page.locator('pptx-ui-ribbon-insert');
}

test('shared Insert ribbon exposes every canonical group and control id once', async ({
	page,
}, info) => {
	const insert = await openInsert(page);
	await page.screenshot({ path: info.outputPath('insert.png') });
	for (const id of GROUPS) {
		await expect(insert.locator(`[data-ribbon-group="${id}"]`)).toHaveCount(1);
	}
	for (const id of CONTROLS) {
		await expect(insert.locator(`[data-ribbon-control="${id}"]`)).toHaveCount(1);
	}
	await expect(insert.getByRole('button', { name: 'Shapes', exact: true })).toBeVisible();
	await expect(insert.getByRole('button', { name: 'Chart', exact: true })).toBeVisible();
});

test('Text Box, Shape and Table insert into the deck, undo and survive save and reload', async ({
	page,
}, info) => {
	const insert = await openInsert(page);
	const before = await slideElements(page).count();
	// Keyboard activation, not only pointer.
	await insert.getByRole('button', { name: 'Text Box', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(slideElements(page)).toHaveCount(before + 1);
	await insert.getByRole('button', { name: 'Shapes', exact: true }).click();
	await insert
		.locator('[data-ribbon-control="insert.illustrations.shapes"] [data-insert-item="star5"]')
		.click();
	await expect(slideElements(page)).toHaveCount(before + 2);
	await insert.getByRole('button', { name: 'Table', exact: true }).click();
	await expect(slideElements(page)).toHaveCount(before + 3);
	await page.keyboard.press('Control+z');
	await expect(slideElements(page)).toHaveCount(before + 2);
	await page.keyboard.press('Control+y');
	await expect(slideElements(page)).toHaveCount(before + 3);
	const saved = info.outputPath('insert-edit.pptx');
	await writeFile(saved, await downloadBytes(await savePptxViaBackstage(page)));
	await loadDeck(page, saved);
	await expect(slideElements(page)).toHaveCount(before + 3);
});

test('Chart, Action and Field menus insert native elements and dismiss from the keyboard', async ({
	page,
}) => {
	const insert = await openInsert(page);
	const before = await slideElements(page).count();
	await insert.getByRole('button', { name: 'Chart', exact: true }).click();
	await insert
		.locator('[data-ribbon-control="insert.illustrations.chart"] [data-insert-item="pie"]')
		.click();
	await expect(slideElements(page)).toHaveCount(before + 1);

	const action = insert.getByRole('button', { name: 'Action', exact: true });
	await action.focus();
	await page.keyboard.press('ArrowDown');
	await expect(action).toHaveAttribute('aria-expanded', 'true');
	await expect(insert.getByRole('menuitem').first()).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(action).toHaveAttribute('aria-expanded', 'false');
	await expect(action).toBeFocused();
	await action.click();
	await insert.getByRole('menuitem').first().click();
	await expect(slideElements(page)).toHaveCount(before + 2);

	const field = insert.getByRole('button', { name: 'Field', exact: true });
	await field.click();
	await insert.getByRole('menuitem', { name: 'Slide Number', exact: true }).click();
	await expect(slideElements(page)).toHaveCount(before + 3);
	await field.click();
	await page.mouse.click(5, 5);
	await expect(field).toHaveAttribute('aria-expanded', 'false');
});

test('Freeform tools keep pressed state, and Link follows the selection', async ({ page }) => {
	const insert = await openInsert(page);
	const curve = insert.getByRole('button', { name: 'Curve', exact: true });
	await expect(curve).toHaveAttribute('aria-pressed', 'false');
	await curve.click();
	await expect(curve).toHaveAttribute('aria-pressed', 'true');
	await curve.click();
	await expect(curve).toHaveAttribute('aria-pressed', 'false');
	const link = insert.getByRole('button', { name: 'Hyperlink', exact: true });
	await expect(link).toBeDisabled();
	await selectElement(page, slideElements(page).first());
	await expect(link).toBeEnabled();
});

test('native dialogs and pickers stay with the host', async ({ page }) => {
	const insert = await openInsert(page);
	const before = await slideElements(page).count();
	await insert.getByRole('button', { name: 'SmartArt', exact: true }).click();
	const smartArt = page.getByRole('dialog', { name: /Insert SmartArt/iu });
	await expect(smartArt).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(smartArt).toBeHidden();
	await insert.getByRole('button', { name: 'Equation', exact: true }).click();
	await expect(page.getByRole('dialog', { name: /^Insert Equation$/iu })).toBeVisible();
	await page.keyboard.press('Escape');
	const chooser = page.waitForEvent('filechooser');
	await insert.getByRole('button', { name: 'Image', exact: true }).click();
	await (await chooser).setFiles(fixture('test-image.gif'));
	await expect(slideElements(page)).toHaveCount(before + 1);
});

test('Insert groups and controls retain public customization IDs', async ({ page }) => {
	const customization = {
		ribbon: {
			hiddenButtons: ['insert.illustrations.chart', 'insert.links.action', 'insert.text.field'],
			hiddenGroups: ['insert.media'],
		},
	};
	await openInsert(page, customization);
	for (const id of customization.ribbon.hiddenButtons) {
		await expect(page.locator(`[data-ribbon-control="${id}"]`)).toBeHidden();
	}
	await expect(page.locator('[data-ribbon-group="insert.media"]')).toBeHidden();
	await expect(page.locator('[data-ribbon-control="insert.tables.table"]')).toBeVisible();
});

test.describe('touch Insert controls', () => {
	test.use({ hasTouch: true });
	test('targets, theme tokens, focus and forced colors remain usable', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Insert').tap();
		const insert = page.locator('pptx-ui-ribbon-insert');
		await insert.evaluate((host) => host.style.setProperty('--pptx-primary', '#123456'));
		await page.setViewportSize({ width: 900, height: 900 });
		const table = insert.getByRole('button', { name: 'Table', exact: true });
		expect((await table.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		const shape = insert.getByRole('button', { name: 'Shapes', exact: true });
		expect((await shape.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await table.focus();
		await expect(table).toBeFocused();
		await insert.getByRole('button', { name: 'Field', exact: true }).tap();
		const item = insert.getByRole('menuitem', { name: 'Slide Number', exact: true });
		expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(item).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(insert.getByRole('button', { name: 'Field', exact: true })).toBeFocused();
	});
});
