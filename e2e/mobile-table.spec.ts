/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Table-cell touch editing (React).
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

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
const shotDir = fileURLToPath(new URL('../test-results/mobile-table/', import.meta.url));

/** On-screen tap point over the cell whose trimmed text equals `label`. */
function cellPoint(page: Page, label: string) {
	return page.evaluate((text) => {
		const td = [...document.querySelectorAll('td')].find((t) => t.textContent?.trim() === text);
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

test('double-tapping a table cell opens an editor and accepts input', async ({ page }) => {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);

	// Navigate to the "Plans" slide (has a table) via the mobile slides sheet.
	await page.getByRole('button', { name: 'Slides' }).tap();
	await page.waitForTimeout(300);
	await page.getByText('Plans', { exact: true }).first().tap();
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
