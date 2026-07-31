/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * File backstage: the viewer's own Open pane, run unchanged against every demo.
 *
 * WHY THIS EXISTS (and why `dropzone-browse.spec.ts` was not enough): that spec
 * drives the *demo shell's* landing dropzone, which is host app chrome. The
 * control users actually reach once a deck is open - and the one that was dead
 * in Svelte - is the *viewer's* File > Open > "Browse this device" button. The
 * demos autosave and restore the last deck, so the landing dropzone is often
 * never seen at all; a suite that only covered it reported a clean green while
 * the real browse affordance did nothing. Svelte's `PowerPointViewer` simply
 * forwarded the optional `onopenfile` host prop straight through to the
 * backstage, so with no host handler the button had no behaviour at all, while
 * React/Vue/Angular/Vanilla all fall back to the built-in `openPptxFile()`
 * picker.
 *
 * Two things make a false green much harder here:
 *   - the click is a REAL mouse click at real coordinates, and the point is
 *     hit-tested first, so an overlay swallowing pointer events fails;
 *   - opening the chooser is not the assertion. The test feeds a *different*
 *     deck through the chooser and asserts the viewer actually swapped to it
 *     (7 slides -> 1 slide), so a picker that opens but is wired to nothing
 *     still fails.
 *
 * It also pins the backstage nav rail geometry, which is where the second
 * user-reported Svelte bug lived: the rail is a full-height column with its
 * Account / Options group pinned to the bottom in every binding. In Svelte the
 * backstage was mounted inside the ribbon's content row, whose
 * `> * { align-items: flex-start }` rule stopped the rail stretching, leaving a
 * 352px stub floating at the top of a 1080px window.
 *
 * Run: bunx playwright test file-backstage-open
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const VIEWPORT = { width: 1920, height: 1080 };
test.use({ viewport: VIEWPORT });
test.describe.configure({ timeout: 120_000 });

// Loaded first (7 slides), then replaced through the backstage picker with a
// 1-slide deck so "the deck actually changed" is unambiguous.
const initialDeck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));
const pickedDeck = resolve(fileURLToPath(new URL('./fixtures/master-views.pptx', import.meta.url)));

const backstage = (page: Page): Locator => page.locator('[role="dialog"][aria-label="File"]');
const rail = (page: Page): Locator => backstage(page).locator('aside').first();

async function loadInitialDeck(page: Page): Promise<void> {
	// `./` rather than `/`: it resolves to the demo root for a bare-origin
	// baseURL AND for a sub-path deployment (GitHub Pages serves the demos under
	// /pptx-viewer/demo-<framework>/), so the same spec can be pointed at a
	// deployed build to reproduce a user report.
	await page.goto('./');
	await page.locator('#file-input').setInputFiles(initialDeck);
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 90_000 });
	await expect(page.getByText(/\b1 of 7\b/u).first()).toBeVisible();
}

/** Open the File tab through the shared toolbar/tablist contract. */
async function openBackstage(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	await expect(backstage(page)).toBeVisible();
}

/**
 * Click the centre of `locator` with a real mouse press at real page
 * coordinates, after checking that the point actually hit-tests to that element.
 * `locator.click()` alone can pass where a human fails: it scrolls, retries, and
 * an element that only *appears* clickable still receives the synthetic press.
 */
async function realMouseClick(page: Page, locator: Locator): Promise<{ x: number; y: number }> {
	const box = await locator.boundingBox();
	expect(box, 'control has no layout box').not.toBeNull();
	const x = box!.x + box!.width / 2;
	const y = box!.y + box!.height / 2;
	const hitsControl = await page.evaluate(
		([px, py]) => {
			const el = document.elementFromPoint(px, py);
			return Boolean(el?.closest('button, [role="button"], label, a'));
		},
		[x, y],
	);
	expect(hitsControl, `nothing clickable at (${x}, ${y}); an overlay is intercepting`).toBe(true);
	await page.mouse.click(x, y);
	return { x, y };
}

test.describe('File backstage Open pane', () => {
	test('the nav rail fills the window and bottom-pins its Account/Options group', async ({
		page,
	}) => {
		await loadInitialDeck(page);
		await openBackstage(page);

		const box = (await rail(page).boundingBox())!;
		expect(box.y).toBeLessThanOrEqual(2);
		// A rail that only grows to its own content height (the Svelte bug) came
		// out at 352px in a 1080px window; a correct one spans the whole side.
		expect(box.height).toBeGreaterThanOrEqual(VIEWPORT.height * 0.95);

		// PowerPoint pins Account/Options to the bottom of the rail; every binding
		// does this with a flex spacer, which silently collapses when the rail is
		// not stretched.
		const navButtons = rail(page).locator('nav button');
		const last = navButtons.last();
		await expect(last).toHaveText(/options/iu);
		const lastBox = (await last.boundingBox())!;
		expect(lastBox.y).toBeGreaterThanOrEqual(VIEWPORT.height * 0.75);
	});

	test('"Browse this device" opens a native file chooser on a real mouse click', async ({
		page,
	}) => {
		await loadInitialDeck(page);
		await openBackstage(page);
		await backstage(page)
			.getByRole('button', { name: /^open$/iu })
			.first()
			.click();

		const browse = backstage(page)
			.getByRole('button', { name: /browse this device/iu })
			.first();
		await expect(browse).toBeVisible();
		await expect(browse).toBeEnabled();

		const [chooser] = await Promise.all([
			page.waitForEvent('filechooser', { timeout: 15_000 }),
			realMouseClick(page, browse),
		]);
		expect(chooser.isMultiple()).toBe(false);
	});

	test('a deck picked through "Browse this device" replaces the open presentation', async ({
		page,
	}) => {
		await loadInitialDeck(page);
		await openBackstage(page);
		await backstage(page)
			.getByRole('button', { name: /^open$/iu })
			.first()
			.click();

		const browse = backstage(page)
			.getByRole('button', { name: /browse this device/iu })
			.first();
		const [chooser] = await Promise.all([
			page.waitForEvent('filechooser', { timeout: 15_000 }),
			realMouseClick(page, browse),
		]);
		await chooser.setFiles(pickedDeck);

		// The backstage closes and the viewer swaps decks: 7 slides -> 1 slide.
		// `toBeHidden` rather than `toHaveCount(0)`: Vanilla keeps its backstage
		// pane in the DOM and toggles `hidden`, the others unmount it.
		await expect(backstage(page)).toBeHidden({ timeout: 30_000 });
		await expect(page.getByText(/\b1 of 1\b/u).first()).toBeVisible({ timeout: 60_000 });
		expect(await page.locator('[data-pptx-viewport] [data-element-id]').count()).toBeGreaterThan(0);
	});
});
