/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Table-cell touch editing (React, Angular, Vue).
 *
 * On touch a cell is edited with a double-tap (which mounts a text <input>).
 * Verified end-to-end on the sample deck's "Plans" table (slide 5), reached
 * via the mobile slides sheet.
 *
 * Targeting note: in edit mode the slide can render wider than a phone
 * viewport (the canvas pans), so a cell's box may extend off-screen and
 * `locator.tap()` (which aims at the box centre) misses. We tap the cell's
 * on-screen left portion via `touchscreen` at a clamped point instead.
 *
 * Run: bunx playwright test mobile-table.spec --project=react
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

// React, Angular, and Vue all support table-cell touch editing: a double-tap
// mounts a text input in the slide's `<td>`. (The Angular inspector table
// editor uses a non-<table> grid so it does not collide with this spec's
// `td input[type="text"]` selector.) Vue previously masked this because its
// inline-edit entry opened a whole-element text editor for every element type
// on the second tap; that entry is now gated to text-bearing elements (mirroring
// React's hasTextProperties gate), so the `<td>` double-tap reaches the cell
// editor on Vue too.

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
const shotDir = fileURLToPath(new URL('../test-results/mobile-table/', import.meta.url));

/** On-screen tap point over the cell whose trimmed text equals `label`. */
function cellPoint(page: Page, label: string) {
	return page.evaluate((text) => {
		const td = [...document.querySelectorAll('td')].find((candidate) => {
			if (candidate.textContent?.trim() !== text || !candidate.checkVisibility()) {
				return false;
			}
			const box = candidate.getBoundingClientRect();
			return (
				box.width > 0 &&
				box.height > 0 &&
				box.bottom > 0 &&
				box.top < window.innerHeight &&
				box.right > 0 &&
				box.left < window.innerWidth
			);
		});
		if (!td) {
			return null;
		}
		const r = td.getBoundingClientRect();
		const vw = window.innerWidth;
		// Aim at the cell's on-screen left portion, clamped inside the viewport.
		const x = Math.min(Math.max(r.x + 16, 4), vw - 4);
		const y = r.y + r.height / 2;
		return { x: Math.round(x), y: Math.round(y) };
	}, label);
}

async function navigateToPlans(page: Page): Promise<void> {
	const navigation = page.getByRole('navigation', { name: /Editor actions|Slide controls/iu });
	await navigation.getByRole('button', { name: /^Slides$/u }).tap();
	const sheet = page.getByRole('dialog').filter({ hasText: 'Slides' });
	await expect(sheet).toBeVisible();
	await sheet.getByText('Plans', { exact: true }).tap();
}

test('double-tapping a table cell opens an editor and accepts input', async ({ page }) => {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);

	// Navigate to the "Plans" slide (has a table) via the mobile slides sheet.
	await navigateToPlans(page);
	await page.waitForTimeout(600);

	const pt = await cellPoint(page, 'Starter');
	expect(pt).not.toBeNull();
	// Double-tap to enter cell edit (select, then edit).
	await page.touchscreen.tap(pt!.x, pt!.y);
	await page.touchscreen.tap(pt!.x, pt!.y);

	const input = page.locator('td input[type="text"]');
	await expect(input).toBeVisible();
	await page.screenshot({ path: resolve(shotDir, 'table-cell-edit.png') });

	// The editor auto-selects its text; typing replaces it. Commit with Enter.
	await page.keyboard.type('Free');
	await page.keyboard.press('Enter');
	await page.waitForTimeout(200);

	await expect(input).toBeHidden();
	const hasFree = await page.evaluate(() =>
		[...document.querySelectorAll('td')].some((t) => t.textContent?.includes('Free')),
	);
	expect(hasFree).toBe(true);
});

test('committing a cell edit by tapping away keeps the typed value', async ({ page }) => {
	// Regression: on touch the canvas stage drives selection through a
	// pointerdown handler that captures the pointer and re-delegates to the
	// table element. The cell <input> must stop pointerdown propagation, else
	// tapping away (or repositioning the caret) stole focus and DISCARDED the
	// edit before it was kept ("table cells lose their value" on mobile).
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);

	await navigateToPlans(page);
	await page.waitForTimeout(600);

	const starter = await cellPoint(page, 'Starter');
	expect(starter).not.toBeNull();
	await page.touchscreen.tap(starter!.x, starter!.y);
	await page.touchscreen.tap(starter!.x, starter!.y);

	const input = page.locator('td input[type="text"]');
	await expect(input).toBeVisible();

	await page.keyboard.type('Renamed');
	// Commit by tapping a DIFFERENT cell (the bug path), not Enter. The
	// different-cell pointerdown bubbles to the stage and blurs the input,
	// which must commit rather than discard. Pick any other non-editing cell
	// on-screen rather than hard-coding a label that may not exist in the deck.
	const other = await page.evaluate(() => {
		const vw = window.innerWidth;
		for (const td of document.querySelectorAll('td')) {
			if (td.querySelector('input')) {
				continue; // skip the cell currently being edited
			}
			if (!td.textContent?.trim()) {
				continue;
			}
			const r = td.getBoundingClientRect();
			if (r.width === 0 || r.x > vw - 4) {
				continue;
			}
			const x = Math.min(Math.max(r.x + 16, 4), vw - 4);
			return { x: Math.round(x), y: Math.round(r.y + r.height / 2) };
		}
		return null;
	});
	expect(other).not.toBeNull();
	await page.touchscreen.tap(other!.x, other!.y);
	await page.waitForTimeout(250);

	await expect(input).toBeHidden();
	const kept = await page.evaluate(() =>
		[...document.querySelectorAll('td')].some((t) => t.textContent?.includes('Renamed')),
	);
	expect(kept).toBe(true);
});
