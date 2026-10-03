/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright owns the test globals */
import { expect, test } from '@playwright/test';

import { loadDeckAt, SAMPLE_DECK } from './support/deck';

test('sorter range selection, multi-slide clipboard and zoom stay in sync', async ({
	page,
	baseURL,
}) => {
	await loadDeckAt(page, baseURL!, SAMPLE_DECK);
	await page
		.getByRole('button', { name: /slide sorter/iu })
		.last()
		.click();
	const tiles = page.locator('[data-pptx-chrome="sorter-tile"]');
	const count = await tiles.count();
	expect(count).toBeGreaterThan(2);
	await tiles.nth(0).click();
	await tiles.nth(2).click({ modifiers: ['Shift'] });
	await expect(
		page.locator('[data-pptx-chrome="sorter-tile"][data-pptx-selected="true"]'),
	).toHaveCount(3);
	await tiles.nth(1).click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Copy (3)', exact: true }).click();
	await page.keyboard.press('Control+v');
	await expect(tiles).toHaveCount(count + 3);
	const zoom = page.getByRole('slider', { name: /zoom/iu });
	await expect(zoom).toHaveValue('100');
	await page.keyboard.press('Control+=');
	await expect(zoom).toHaveValue('110');
	await page.keyboard.press('Escape');
	await expect(tiles).toHaveCount(count + 3);
	await expect(
		page.locator('[data-pptx-chrome="sorter-tile"][data-pptx-selected="true"]'),
	).toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(tiles).toHaveCount(0);
});
