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

import { resetTabSession } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const sampleDeckPath = resolve(
	fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)),
);

const dropzone = (page: Page): Locator => page.locator('[data-testid="dropzone"]').first();
const browseButton = (page: Page): Locator => page.locator('[data-testid="browse-files"]').first();
const hintLabel = (page: Page): Locator => page.locator('label[for="file-input"]').first();

async function gotoLanding(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
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
	// The accept list is now the binding's exported `PPTX_OPEN_ACCEPT`, not a
	// per-demo literal. The literal was `.pptx,.ppt,.json`, which silently
	// dropped `.pptm`, `.ppsx` and `.potx` even though the loader has always
	// read them: the picker offered less than the product supports.
	expect(await chooser.element().getAttribute('accept')).toBe('.pptx,.ppsx,.pptm,.potx,.ppt,.json');
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

	/**
	 * The reported symptom was "the browse button styling is wrong at
	 * 1920x1080", so the layout is pinned at exactly that viewport. Everything
	 * asserted here is something a person looking at the landing page would
	 * notice: the two controls sit on one row, that row is centred in the dashed
	 * card with real breathing room, and the primary control is actually painted
	 * (not a default UA button, and not identical to the secondary one).
	 */
	test.describe('at 1920x1080', () => {
		test.use({ viewport: { width: 1920, height: 1080 } });

		test('the Browse control is a painted primary button, centred on one row', async ({ page }) => {
			await gotoLanding(page);
			const zoneBox = (await dropzone(page).boundingBox())!;
			const browseBox = (await browseButton(page).boundingBox())!;
			const newBox = (await page
				.getByRole('button', { name: /new presentation/iu })
				.first()
				.boundingBox())!;

			// One row: a wrapped action row is the classic wide-viewport styling bug.
			expect(Math.abs(browseBox.y - newBox.y)).toBeLessThanOrEqual(2);
			expect(browseBox.x + browseBox.width).toBeLessThanOrEqual(newBox.x);

			// The row (not just the first button) is centred in the dashed card.
			const rowCentre = (browseBox.x + newBox.x + newBox.width) / 2;
			expect(Math.abs(rowCentre - (zoneBox.x + zoneBox.width / 2))).toBeLessThanOrEqual(2);

			// Well inside the dashed border, never flush against it or spilling out.
			expect(browseBox.x - zoneBox.x).toBeGreaterThanOrEqual(24);
			expect(zoneBox.y + zoneBox.height - (browseBox.y + browseBox.height)).toBeGreaterThanOrEqual(
				24,
			);

			// A real, comfortable hit target.
			expect(browseBox.height).toBeGreaterThanOrEqual(32);
			expect(browseBox.height).toBeLessThanOrEqual(48);
			expect(browseBox.width).toBeGreaterThanOrEqual(80);

			const paint = await browseButton(page).evaluate((node) => {
				const own = getComputedStyle(node);
				const sibling = [...node.parentElement!.querySelectorAll('button')].find(
					(other) => other !== node,
				);
				return {
					background: own.backgroundColor,
					radius: Number.parseFloat(own.borderRadius),
					fontSize: Number.parseFloat(own.fontSize),
					cursor: own.cursor,
					siblingBackground: sibling ? getComputedStyle(sibling).backgroundColor : null,
				};
			});
			// Styled, not the browser's default grey box.
			expect(paint.background).not.toBe('rgba(0, 0, 0, 0)');
			expect(paint.radius).toBeGreaterThan(0);
			expect(paint.fontSize).toBeGreaterThanOrEqual(13);
			// Visibly the primary of the two.
			expect(paint.background).not.toBe(paint.siblingBackground);
		});
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
