/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Refresh survival: a deck that is open stays open across a page reload.
 *
 * The demos hand the viewer bytes they hold in memory, so before this existed a
 * refresh (or an accidental F5 mid-edit) threw the presentation away and put the
 * user back on the file dropzone. Each demo now remembers the open deck per
 * browser TAB, which is the axis the assertions below pin down:
 *
 *   - the same tab reloads back into the deck,
 *   - a brand-new tab still starts on the dropzone (it must not inherit another
 *     tab's presentation),
 *   - and `?sample=1` - the docs landing embed's auto-open flag - is dropped
 *     from the address bar the moment the user opens a deck of their own, so the
 *     next refresh does not re-seed the bundled sample over their file.
 *
 * Framework-neutral: only the shared contract (`#file-input`,
 * `[data-testid="dropzone"]`, `[aria-roledescription="slide"]`,
 * `[data-pptx-element="true"]`) is used. No ports, no project branching.
 *
 * Run: bunx playwright test session-restore
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

/** 7 slides; the deck every other spec loads. */
const sampleDeck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));
/** 1 slide, so "the viewer swapped decks" is unambiguous. */
const pickedDeck = resolve(fileURLToPath(new URL('./fixtures/master-views.pptx', import.meta.url)));

const backstage = (page: Page): Locator => page.locator('[role="dialog"][aria-label="File"]');

async function waitForDeck(page: Page): Promise<void> {
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 90_000 });
	await page.locator('[data-pptx-element="true"]').first().waitFor({ timeout: 90_000 });
}

/** Open the committed sample deck through the landing dropzone's file input. */
async function openDeck(page: Page, url = './'): Promise<void> {
	await page.goto(url);
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await waitForDeck(page);
}

test.describe('session restore', () => {
	test('a refresh reopens the deck instead of clearing it', async ({ page }) => {
		await openDeck(page);

		await page.reload();

		await waitForDeck(page);
		await expect(page.locator('[data-testid="dropzone"]')).toHaveCount(0);
	});

	test('the restored deck survives repeated refreshes', async ({ page }) => {
		await openDeck(page);

		await page.reload();
		await waitForDeck(page);
		await page.reload();

		await waitForDeck(page);
		await expect(page.locator('[data-testid="dropzone"]')).toHaveCount(0);
	});

	test("a new tab is not handed the other tab's deck", async ({ page, context }) => {
		await openDeck(page);

		// A second tab shares IndexedDB with the first but gets its own
		// sessionStorage, which is what scopes a remembered deck to one tab.
		const second = await context.newPage();
		await second.goto(page.url());

		await expect(second.locator('[data-testid="dropzone"]')).toBeVisible();
		await expect(second.locator('[aria-roledescription="slide"]')).toHaveCount(0);
		await second.close();
	});

	test('a ?sample=1 embed keeps the deck the user opened, not the sample', async ({ page }) => {
		// The docs landing page embeds the demo this way: the bundled sample opens
		// on its own and there is no dropzone left, so the only way to open a deck
		// of your own is the viewer's File > Open, which swaps the deck INSIDE the
		// viewer without telling the demo shell.
		await page.goto('./?sample=1');
		await waitForDeck(page);
		await expect(page.getByText(/\b1 of 7\b/u).first()).toBeVisible();

		await page
			.getByRole('toolbar', { name: 'Presentation toolbar' })
			.getByRole('tab', { name: 'File', exact: true })
			.click();
		await expect(backstage(page)).toBeVisible();
		await backstage(page)
			.getByRole('button', { name: /^open$/iu })
			.first()
			.click();
		const browse = backstage(page)
			.getByRole('button', { name: /browse this device/iu })
			.first();
		const [chooser] = await Promise.all([
			page.waitForEvent('filechooser', { timeout: 15_000 }),
			browse.click(),
		]);
		await chooser.setFiles(pickedDeck);
		await expect(page.getByText(/\b1 of 1\b/u).first()).toBeVisible({ timeout: 60_000 });

		await page.reload();

		// Still the 1-slide deck the user picked: a leftover `?sample=1` must not
		// re-seed the 7-slide sample over it, and the flag is retired on the way.
		await waitForDeck(page);
		await expect(page.getByText(/\b1 of 1\b/u).first()).toBeVisible({ timeout: 60_000 });
		expect(new URL(page.url()).searchParams.has('sample')).toBe(false);
	});
});
