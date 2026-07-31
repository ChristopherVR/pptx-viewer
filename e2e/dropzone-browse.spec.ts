/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Landing dropzone: the REAL browse controls, run unchanged against every demo.
 *
 * Every other spec loads a deck with `#file-input`.setInputFiles(), which pokes
 * the hidden input directly and never touches the visible chrome. That made a
 * dead browse affordance completely invisible to the suite: the dashed zone
 * painted `cursor: pointer` over 900x214 px while only the ~278x24 px hint text
 * was wired to the input, so clicking anywhere else did nothing.
 *
 * This spec therefore drives the picker exclusively through what a user can
 * see and click, and asserts a native file chooser actually opens:
 *   - `[data-testid="browse-files"]`  the explicit Browse button
 *   - `[data-testid="dropzone"]`      the dashed zone body (empty area)
 *   - the "click to browse" `<label for="file-input">` hint
 *
 * Run: bunx playwright test dropzone-browse
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

const sampleDeckPath = resolve(
	fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)),
);

const dropzone = (page: Page): Locator => page.locator('[data-testid="dropzone"]').first();
const browseButton = (page: Page): Locator => page.locator('[data-testid="browse-files"]').first();
const hintLabel = (page: Page): Locator => page.locator('label[for="file-input"]').first();

async function gotoLanding(page: Page): Promise<void> {
	await page.goto('/');
	await expect(dropzone(page)).toBeVisible();
	await expect(page.locator('#file-input')).toBeAttached();
}

/**
 * Run `action` and assert the browser opened a native file chooser for the
 * demo's `#file-input`. Returns the chooser so a caller can feed it a deck.
 */
async function expectFileChooser(page: Page, action: () => Promise<void>) {
	const [chooser] = await Promise.all([page.waitForEvent('filechooser'), action()]);
	expect(chooser.isMultiple()).toBe(false);
	expect(await chooser.element().getAttribute('id')).toBe('file-input');
	expect(await chooser.element().getAttribute('accept')).toBe('.pptx');
	return chooser;
}

test.describe('landing dropzone browse controls', () => {
	test('shows a visible, enabled Browse control next to New Presentation', async ({ page }) => {
		await gotoLanding(page);
		await expect(browseButton(page)).toBeVisible();
		await expect(browseButton(page)).toBeEnabled();
		await expect(page.getByRole('button', { name: /new presentation/iu }).first()).toBeVisible();

		// The Browse control has to sit inside the dashed zone, not float loose in
		// the page: a mis-parented button is exactly the "styling issue with where
		// the browse button is" this spec exists to catch.
		const zoneBox = (await dropzone(page).boundingBox())!;
		const buttonBox = (await browseButton(page).boundingBox())!;
		expect(buttonBox.x).toBeGreaterThanOrEqual(zoneBox.x);
		expect(buttonBox.y).toBeGreaterThanOrEqual(zoneBox.y);
		expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(zoneBox.x + zoneBox.width);
		expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(zoneBox.y + zoneBox.height);

		// ...and be horizontally centred in it, like the rest of the landing chrome.
		const zoneCentre = zoneBox.x + zoneBox.width / 2;
		const buttonCentre = buttonBox.x + buttonBox.width / 2;
		expect(Math.abs(buttonCentre - zoneCentre)).toBeLessThan(zoneBox.width / 4);
	});

	test('the Browse button opens the native file chooser', async ({ page }) => {
		await gotoLanding(page);
		await expectFileChooser(page, () => browseButton(page).click());
	});

	test('clicking empty dropzone space opens the native file chooser', async ({ page }) => {
		await gotoLanding(page);
		const box = (await dropzone(page).boundingBox())!;
		// Inside the dashed border, well clear of the hint text and the buttons.
		await expectFileChooser(page, () => page.mouse.click(box.x + 24, box.y + 16));
	});

	test('the "click to browse" hint label opens the native file chooser', async ({ page }) => {
		await gotoLanding(page);
		await expect(hintLabel(page)).toBeVisible();
		await expectFileChooser(page, () => hintLabel(page).click());
	});

	test('a deck picked through the Browse button renders', async ({ page }) => {
		await gotoLanding(page);
		const chooser = await expectFileChooser(page, () => browseButton(page).click());
		await chooser.setFiles(sampleDeckPath);

		await page.locator('[aria-roledescription="slide"]').first().waitFor();
		await page.locator('[data-pptx-element="true"]').first().waitFor();
		await expect(dropzone(page)).toHaveCount(0);
	});
});
