/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/** The same control behavior must work in every viewer binding. */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';

test('select fits the viewport without scrolling and dismisses on Tab or disable', async ({
	page,
}) => {
	await loadDeck(page);
	await page.evaluate(() => {
		const select = document.createElement('pptx-ui-select');
		select.id = 'edge-select';
		select.style.cssText = 'position:fixed;bottom:12px;right:8px;width:160px;z-index:99999';
		select.innerHTML = Array.from(
			{ length: 20 },
			(_, index) =>
				`<option value="${index}">Choice ${index} with a long descriptive label</option>`,
		).join('');
		const next = document.createElement('button');
		next.id = 'after-edge-select';
		next.textContent = 'Next control';
		next.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999';
		document.body.append(select, next);
	});
	const select = page.locator('#edge-select');
	const trigger = select.locator('[role="combobox"]');
	const menu = select.locator('[role="listbox"]');
	const before = await trigger.boundingBox();
	await trigger.click();
	await expect(menu).toBeVisible();
	expect(await trigger.boundingBox()).toEqual(before);
	const popup = (await menu.boundingBox())!;
	expect(popup.y + popup.height).toBeLessThanOrEqual(before!.y - 4);
	expect(popup.x).toBeGreaterThanOrEqual(8);
	expect(popup.x + popup.width).toBeLessThanOrEqual(page.viewportSize()!.width - 8);
	await page.keyboard.press('Tab');
	await expect(menu).not.toBeVisible();
	await expect(page.locator('#after-edge-select')).toBeFocused();
	await trigger.click();
	await expect(menu).toBeVisible();
	await select.evaluate((element) => element.setAttribute('disabled', ''));
	await expect(menu).not.toBeVisible();
});

test('Properties select opens below its trigger and checkbox updates', async ({ page }) => {
	await loadDeck(page);
	const select = page.locator('pptx-ui-select:visible:not([disabled])').first();
	const trigger = select.locator('[role="combobox"]');
	await expect(trigger).toBeVisible();
	await trigger.click();
	const menu = select.locator('[role="listbox"]');
	await expect(menu).toBeVisible();
	const triggerBox = await trigger.boundingBox();
	const menuBox = await menu.boundingBox();
	expect(triggerBox).not.toBeNull();
	expect(menuBox).not.toBeNull();
	expect(menuBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height);
	await page.keyboard.press('Escape');
	await expect(menu).not.toBeVisible();

	const checkbox = page.locator('pptx-ui-checkbox:visible:not([disabled])').first();
	await expect(checkbox).toBeVisible();
	const before = await checkbox.evaluate((element) => element.hasAttribute('checked'));
	const beforeBackground = await checkbox.evaluate(
		(element) => getComputedStyle(element).backgroundColor,
	);
	await checkbox.click();
	if (before) {
		await expect(checkbox).not.toHaveAttribute('checked');
	} else {
		await expect(checkbox).toHaveAttribute('checked', '');
	}
	const afterBackground = await checkbox.evaluate(
		(element) => getComputedStyle(element).backgroundColor,
	);
	expect(afterBackground).not.toBe(beforeBackground);
});

test('control instances reuse one parsed stylesheet per type', async ({ page }) => {
	await loadDeck(page);
	const shared = await page.evaluate(() =>
		(['pptx-ui-search', 'pptx-ui-select', 'pptx-ui-checkbox'] as const).map((name) => {
			const first = document.createElement(name);
			const second = document.createElement(name);
			document.body.append(first, second);
			const firstRoot = first.shadowRoot!;
			const secondRoot = second.shadowRoot!;
			const reused =
				firstRoot.adoptedStyleSheets.length === 1 &&
				firstRoot.adoptedStyleSheets[0] === secondRoot.adoptedStyleSheets[0] &&
				!firstRoot.querySelector('style') &&
				!secondRoot.querySelector('style');
			first.remove();
			second.remove();
			return { name, reused };
		}),
	);
	for (const control of shared) {
		expect(control.reused, `${control.name} should share its stylesheet`).toBeTruthy();
	}
});

test('select refreshes its label after options change', async ({ page }) => {
	await loadDeck(page);
	await page.evaluate(() => {
		const select = document.createElement('pptx-ui-select');
		select.id = 'dynamic-web-control-select';
		select.value = 'a';
		const option = document.createElement('option');
		option.value = 'a';
		option.textContent = 'Alpha';
		select.append(option);
		document.body.append(select);
	});
	const select = page.locator('#dynamic-web-control-select');
	await expect(select.locator('[part="value"]')).toHaveText('Alpha');
	await select.locator('option').evaluate((option) => {
		option.textContent = 'Beta';
	});
	await expect(select.locator('[part="value"]')).toHaveText('Beta');
	await select.evaluate((element) => element.remove());
});
