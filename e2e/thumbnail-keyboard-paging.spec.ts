/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * With a thumbnail focused, PowerPoint's paging keys move between slides:
 * Down / PageDown go on, Up / PageUp go back (Left / Right did already).
 *
 * The keys resolve through the shared editor keymap
 * (`packages/shared/src/render/editor-keymap-arrows.ts`). React, Vue and
 * Angular only paged on Left / Right there, so ArrowDown on a focused
 * thumbnail did nothing in those three while Svelte and Vanilla moved on.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck } from './support/deck';
import { slidePosition } from './support/keyboard';

async function focusThumbnail(page: Page, slideNumber: number): Promise<void> {
	const byIndex = page.locator(`[data-slide-index="${slideNumber - 1}"]`).first();
	const byLabel = page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first();
	const thumb = (await byIndex.count()) > 0 ? byIndex : byLabel;
	await thumb.click();
	await thumb.focus();
	await expect.poll(() => slidePosition(page)).toMatch(new RegExp(`^Slide ${slideNumber} of`, 'u'));
}

test.describe('paging keys on a focused thumbnail', () => {
	for (const [key, from, to] of [
		['ArrowDown', 2, 3],
		['PageDown', 2, 3],
		['ArrowUp', 3, 2],
		['PageUp', 3, 2],
	] as const) {
		test(`${key} moves from slide ${from} to ${to}`, async ({ page }) => {
			await loadDeck(page);
			await focusThumbnail(page, from);
			await page.keyboard.press(key);
			await expect.poll(() => slidePosition(page)).toMatch(new RegExp(`^Slide ${to} of`, 'u'));
		});
	}
});
