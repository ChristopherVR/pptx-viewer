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
	await checkbox.click();
	if (before) {
		await expect(checkbox).not.toHaveAttribute('checked');
	} else {
		await expect(checkbox).toHaveAttribute('checked', '');
	}
});
