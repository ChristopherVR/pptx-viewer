/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * PowerPoint's start-a-show keys, F5 and Shift+F5, in every binding.
 *
 * All five bindings shipped "From Beginning" and "From Current Slide" buttons
 * and none of them the keys a PowerPoint user reaches for first, because the
 * browser owns F5 (reload). The decision now lives in the shared
 * `mapSlideShowStartKey`, and each binding only has to `preventDefault()` and
 * call the same entry point its button calls. This spec pins three things a
 * unit test on the map cannot see:
 *
 *  1. the key actually reaches the handler (a binding that listens on its own
 *     root instead of `window` needs focus inside the viewer);
 *  2. the key's default is prevented, or the browser reloads the page
 *     underneath the show (Playwright's synthetic F5 never reloads, so this is
 *     asserted on `defaultPrevented` rather than on the page surviving);
 *  3. F5 opens the SHOW's first slide, not the deck's, and Shift+F5 the slide
 *     the editor is parked on, so the keys agree with the buttons about custom
 *     shows.
 *
 * The deck is `header-footer-shows.pptx`: three titled slides whose
 * `p:showPr` selects the custom show "Short Show" (slides 1 and 3), so "from
 * beginning" and "from current" land on different, nameable slides.
 *
 * Run: bunx playwright test start-show-shortcuts
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, thumbnail } from './support/deck';
import { pressShortcut } from './support/keyboard';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('header-footer-shows.pptx');

const TITLES = ['Alpha Slide', 'Beta Slide', 'Gamma Slide'] as const;

/** The running show's toolbar; absent until a show is on. */
function showToolbar(page: Page): Locator {
	return page.locator('[data-pptx-present-toolbar]').first();
}

/** Whether a slide's title text is on screen anywhere right now. */
async function titleVisible(page: Page, title: string): Promise<boolean> {
	const nodes = page.locator('[data-element-id]').filter({ hasText: title });
	const count = await nodes.count();
	for (let index = 0; index < count; index += 1) {
		if (await nodes.nth(index).isVisible()) {
			return true;
		}
	}
	return false;
}

/**
 * Load the deck and park the editor on Gamma (slide 3, the show's LAST slide),
 * so that "from beginning" and "from current" are distinguishable.
 */
async function openOnGamma(page: Page): Promise<void> {
	await loadDeck(page, DECK);
	await thumbnail(page, 3).first().click();
	await page.waitForTimeout(600);
	expect(await titleVisible(page, TITLES[2]), 'the editor must be parked on Gamma').toBe(true);
	// Registered on `window` in the bubble phase AFTER the viewer mounted, so it
	// runs behind every binding's own listener (root or window) and sees what
	// they left of the event.
	await page.evaluate(() => {
		const probe = window as unknown as { __pptxF5?: { prevented: boolean } };
		window.addEventListener('keydown', (event) => {
			if (event.key === 'F5') {
				probe.__pptxF5 = { prevented: event.defaultPrevented };
			}
		});
	});
}

/** Fails unless the last F5 keydown reached the probe with its default prevented. */
async function expectReloadPrevented(page: Page, what: string): Promise<void> {
	const seen = await page.evaluate(
		() => (window as unknown as { __pptxF5?: { prevented: boolean } }).__pptxF5,
	);
	expect(seen, `${what} never reached the window probe (was propagation stopped?)`).toBeDefined();
	expect(
		seen?.prevented,
		`${what} must call preventDefault(), or a real browser reloads the page under the show`,
	).toBe(true);
}

test.describe('start-show keyboard shortcuts', () => {
	test('F5 starts the show from its first slide', async ({ page }) => {
		await openOnGamma(page);
		// `toBeHidden`, not a zero count: one binding keeps the show toolbar in the
		// DOM and hides it until a show starts.
		await expect(showToolbar(page), 'no show must be running yet').toBeHidden();

		await pressShortcut(page, 'F5', 900);

		await expectReloadPrevented(page, 'F5');
		await expect(showToolbar(page), 'F5 must start a slide show').toBeVisible();
		expect(
			await titleVisible(page, TITLES[0]),
			'F5 is "From Beginning": the show opens on ITS first slide (Alpha), not on the slide the editor was parked on',
		).toBe(true);
	});

	test('Shift+F5 starts the show from the current slide', async ({ page }) => {
		await openOnGamma(page);

		await pressShortcut(page, 'Shift+F5', 900);

		await expectReloadPrevented(page, 'Shift+F5');
		await expect(showToolbar(page), 'Shift+F5 must start a slide show').toBeVisible();
		expect(
			await titleVisible(page, TITLES[0]),
			'Shift+F5 is "From Current Slide": the show must not rewind to Alpha',
		).toBe(false);
		expect(await titleVisible(page, TITLES[2]), 'the show must open on Gamma').toBe(true);
	});

	test('F5 during a running show does not restart it', async ({ page }) => {
		await openOnGamma(page);
		await pressShortcut(page, 'Shift+F5', 900);
		await expect(showToolbar(page)).toBeVisible();

		await pressShortcut(page, 'F5', 900);

		await expect(showToolbar(page), 'the show must still be running').toBeVisible();
		expect(
			await titleVisible(page, TITLES[2]),
			'the show keymap owns F5 while presenting; PowerPoint does not rewind',
		).toBe(true);
	});
});
