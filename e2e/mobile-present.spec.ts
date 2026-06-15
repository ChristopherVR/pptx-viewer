/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));

test('entering presentation mode with a selection does not leak edit chrome', async ({ page }) => {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(400);

	// Select an adjustable shape — in edit mode it shows the "Adjust shape" handle
	// (the amber diamond) plus resize handles.
	await page.locator('[data-pptx-element="true"]').last().tap();
	await expect(page.getByLabel('Adjust shape')).toBeVisible();

	// Enter presentation mode.
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.tap();
	await page.waitForTimeout(700);

	// Presentation controls are up...
	await expect(page.getByRole('button', { name: /next slide/iu }).first()).toBeVisible();
	// ...and NO edit chrome (resize/rotate/adjust handles) is rendered over the slide.
	await expect(page.getByLabel('Adjust shape')).toHaveCount(0);

	// The presentation also starts at the slide origin rather than wherever the
	// edit canvas had been scrolled/zoomed.
	const scrollLeft = await page.evaluate(() => {
		const vp = document.querySelector('.overflow-auto') as HTMLElement | null;
		return vp ? vp.scrollLeft : 0;
	});
	expect(scrollLeft).toBe(0);
});
