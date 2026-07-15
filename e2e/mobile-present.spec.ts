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

	// Select a shape and verify its shared rotate handle is visible in edit mode.
	await page.locator('[data-pptx-element="true"]').last().tap();
	const editHandle = page
		.getByLabel(/rotate/iu)
		.filter({ visible: true })
		.last();
	await expect(editHandle).toBeVisible();

	// Enter presentation mode.
	await page
		.getByRole('button', { name: /present|slide show/iu })
		.first()
		.tap();
	await page.waitForTimeout(700);

	// Presentation controls are up...
	await expect(page.getByRole('button', { name: /next slide/iu }).first()).toBeVisible();
	// ...and no visible edit handle is rendered over the slide.
	await expect(page.getByLabel(/rotate/iu).filter({ visible: true })).toHaveCount(0);

	// The presentation also starts at the slide origin rather than wherever the
	// edit canvas had been scrolled/zoomed.
	const scrollLeft = await page.evaluate(() => {
		const vp = document.querySelector('[data-pptx-viewport]') as HTMLElement | null;
		return vp ? vp.scrollLeft : 0;
	});
	expect(scrollLeft).toBe(0);
});
