/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * One treatment per control kind, in every binding: the search field, select
 * and checkbox primitives must read the shared field, focus-ring and checkbox
 * tokens on every surface that uses them (File menu, title bar, Options and the
 * Properties inspector), so a restyle on one surface cannot drift from the rest.
 *
 * Set UI_SHOTS_DIR to also write the before/after evidence screenshots.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { inspector, loadDeck, ribbon, selectElement, slideElements } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.UI_SHOTS_DIR;

interface Look {
	height: number;
	radius: string;
	border: string;
	borderWidth: string;
	background: string;
}

function look(target: Locator): Promise<Look> {
	return target.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			height: Math.round(element.getBoundingClientRect().height * 10) / 10,
			radius: style.borderTopLeftRadius,
			border: style.borderTopColor,
			borderWidth: style.borderTopWidth,
			background: style.backgroundColor,
		};
	});
}

async function openFile(page: Page): Promise<Locator> {
	await ribbon(page).getByRole('tab', { name: 'File', exact: true }).click();
	const backstage = page.locator('[role="dialog"][aria-label="File"]');
	await backstage.waitFor();
	return backstage;
}

async function openOptions(page: Page): Promise<Locator> {
	const backstage = await openFile(page);
	await backstage.locator('aside nav button').last().click();
	const dialog = page.getByRole('dialog', { name: 'Options' }).first();
	await dialog.waitFor();
	return dialog;
}

test('search fields share one field treatment: a single host border, radius and focus colour', async ({
	page,
}) => {
	await loadDeck(page);
	const title = page.locator('pptx-ui-search[variant="titlebar"]');
	await expect(title).toBeVisible();
	const backstage = await openFile(page);
	const recent = backstage.locator('pptx-ui-search');
	await expect(recent).toBeVisible();
	for (const search of [title, recent]) {
		await expect(search.locator('input'), 'search shows its placeholder').toHaveAttribute(
			'placeholder',
			/\S/,
		);
		const resting = await look(search);
		expect(resting.borderWidth).toBe('1px');
		expect(resting.radius).not.toBe('0px');
		const inner = await search.locator('input').evaluate((input) => {
			const style = getComputedStyle(input);
			return {
				border: style.borderTopWidth,
				shadow: style.boxShadow,
				background: style.backgroundColor,
			};
		});
		expect(inner.border, 'inner input draws no second border').toBe('0px');
		expect(inner.shadow).toBe('none');
		expect(inner.background).toBe('rgba(0, 0, 0, 0)');
	}
	const [titleLook, recentLook] = [await look(title), await look(recent)];
	expect(titleLook.height, 'title-bar field height').toBe(28);
	expect(recentLook.height, 'File field height').toBe(40);
	expect(Number.parseFloat(recentLook.radius)).toBeGreaterThanOrEqual(4);
	expect(Number.parseFloat(titleLook.radius)).toBeGreaterThanOrEqual(4);
	await recent.locator('input').focus();
	const focused = await look(recent);
	expect(focused.border, 'focus recolours the one outer border').not.toBe(recentLook.border);
	expect(focused.height, 'focus does not shift layout').toBe(recentLook.height);
});

test('Options and inspector selects and checkboxes share size, shape and accent', async ({
	page,
}) => {
	await loadDeck(page);
	const dialog = await openOptions(page);
	const optionSelect = dialog.locator('pptx-ui-select').first();
	const optionCheckbox = dialog.locator('pptx-ui-checkbox[checked]').first();
	await expect(optionSelect).toBeVisible();
	await expect(optionCheckbox).toBeVisible();
	const optionCheckboxLook = await look(optionCheckbox);
	const optionTrigger = await look(optionSelect.locator('[role="combobox"]'));

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	const panel = inspector(page);
	const inspectorCheckbox = panel.locator('pptx-ui-checkbox[checked]').first();
	await expect(inspectorCheckbox).toBeVisible();
	const inspectorTrigger = panel.locator('pptx-ui-select [role="combobox"]').first();
	await expect(inspectorTrigger).toBeVisible();

	expect(await look(inspectorCheckbox), 'checked checkbox look').toEqual(optionCheckboxLook);
	const inspectorLook = await look(inspectorTrigger);
	expect(inspectorLook.radius, 'select radius').toBe(optionTrigger.radius);
	expect(inspectorLook.border, 'select border').toBe(optionTrigger.border);
	expect(inspectorLook.borderWidth).toBe(optionTrigger.borderWidth);
	expect(inspectorLook.height, 'select trigger height').toBe(optionTrigger.height);
	expect(optionCheckboxLook.height).toBe(16);
	expect(optionCheckboxLook.border).toBe(optionCheckboxLook.background);
});

test('select is a keyboard-operable listbox whose popup is owned by the app', async ({ page }) => {
	await loadDeck(page);
	const dialog = await openOptions(page);
	const select = dialog.locator('pptx-ui-select').first();
	const trigger = select.locator('[role="combobox"]');
	await trigger.focus();
	await page.keyboard.press('ArrowDown');
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	const menu = select.locator('[role="listbox"]');
	await expect(menu).toBeVisible();
	expect(await menu.locator('[role="option"]').count()).toBeGreaterThan(1);
	await expect(menu.locator('[aria-selected="true"]')).toHaveCount(1);
	// The popup is an element in the page, not an OS-drawn native list.
	expect(await menu.evaluate((element) => element.tagName)).toBe('DIV');
	const radius = await menu.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
	expect(radius).not.toBe('0px');
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('select pages through long lists with PageDown and PageUp', async ({ page }) => {
	await loadDeck(page);
	await page.evaluate(() => {
		const select = document.createElement('pptx-ui-select');
		select.id = 'paged-select';
		select.setAttribute('aria-label', 'Paged');
		select.style.cssText = 'position:fixed;top:120px;left:40px;width:200px;z-index:99999';
		select.innerHTML = Array.from(
			{ length: 30 },
			(_, index) => `<option value="${index}">Item ${index}</option>`,
		).join('');
		document.body.append(select);
	});
	const trigger = page.locator('#paged-select [role="combobox"]');
	const active = page.locator('#paged-select [role="option"][data-active]');
	await trigger.focus();
	await page.keyboard.press('PageDown');
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	await expect(active).toHaveText('Item 8');
	await page.keyboard.press('PageDown');
	await expect(active).toHaveText('Item 16');
	await page.keyboard.press('PageUp');
	await expect(active).toHaveText('Item 8');
	await page.keyboard.press('Enter');
	await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	await expect(page.locator('#paged-select')).toHaveJSProperty('value', '8');
});

test('checkbox keyboard focus uses the shared ring, including forced colors', async ({ page }) => {
	await loadDeck(page);
	const dialog = await openOptions(page);
	const checkbox = dialog.locator('pptx-ui-checkbox').first();
	await checkbox.focus();
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('Tab');
	await expect(checkbox).toBeFocused();
	await expect(checkbox).toHaveCSS('outline-width', '2px');
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(checkbox).toHaveCSS('outline-style', 'solid');
});

test('evidence screenshots', async ({ page }, info) => {
	test.skip(!SHOTS, 'UI_SHOTS_DIR not set');
	const name = info.project.name;
	await loadDeck(page);
	await page.screenshot({
		path: `${SHOTS}/${name}-titlebar.png`,
		clip: { x: 0, y: 0, width: 1440, height: 80 },
	});
	const backstage = await openFile(page);
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${SHOTS}/${name}-file-menu.png` });
	await backstage.locator('aside nav button').last().click();
	await page.getByRole('dialog', { name: 'Options' }).first().waitFor();
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${SHOTS}/${name}-options.png` });
	await page.keyboard.press('Escape');
	await selectElement(page, slideElements(page).first());
	await page.waitForTimeout(500);
	await inspector(page).screenshot({ path: `${SHOTS}/${name}-inspector.png` });
});
