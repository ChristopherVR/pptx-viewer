/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/** The same control behavior must work in every viewer binding. */
import { expect, test } from '@playwright/test';

import { loadDeck } from './support/deck';

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
