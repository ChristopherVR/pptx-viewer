/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Tablet + landscape layout audit (React).
 *
 * The mobile chrome (MobileToolbar / MobileBottomBar) only renders below the
 * 768px breakpoint, so tablet widths fall back to the desktop-style layout.
 * This spec captures how the viewer adapts at 768–1023px (portrait tablet) and
 * in landscape phone orientation, so the screenshots can be eyeballed for
 * cramping / cut-off chrome.
 *
 * Run: bunx playwright test mobile-tablet-landscape --project=react
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
const shotDir = fileURLToPath(new URL('../test-results/mobile-tablet-landscape/', import.meta.url));

// Asserts React's mobile chrome (Editor actions bar, Menu button); other
// frameworks differ, so scope to react.
test.beforeEach((_, testInfo) => {
	test.skip(testInfo.project.name !== 'react', 'React mobile chrome only');
});

async function load(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

test.describe('tablet portrait (820×1180, touch)', () => {
	test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

	test('edit layout adapts without horizontal overflow', async ({ page }) => {
		await load(page);
		await page.screenshot({ path: resolve(shotDir, 'tablet-edit.png') });

		// The page itself must not scroll horizontally (chrome should fit the width).
		const overflow = await page.evaluate(() => {
			const el = document.scrollingElement ?? document.documentElement;
			return { scrollW: el.scrollWidth, clientW: el.clientWidth };
		});
		expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1);

		// Tablet keeps the desktop chrome (no mobile bottom bar) — it's tall
		// enough for the ribbon + panels.
		await expect(page.getByRole('navigation', { name: 'Editor actions' })).toHaveCount(0);
	});

	test('present mode fits and shows touch controls', async ({ page }) => {
		await load(page);
		await page
			.getByRole('button', { name: /present/iu })
			.first()
			.tap();
		await page.waitForTimeout(700);
		await page.screenshot({ path: resolve(shotDir, 'tablet-present.png') });
		await expect(page.getByRole('button', { name: /next slide/iu }).first()).toBeVisible();
	});
});

test.describe('landscape phone (915×412, touch)', () => {
	test.use({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });

	test('edit layout uses mobile chrome in landscape', async ({ page }) => {
		await load(page);
		await page.screenshot({ path: resolve(shotDir, 'landscape-edit.png') });
		const overflow = await page.evaluate(() => {
			const el = document.scrollingElement ?? document.documentElement;
			return { scrollW: el.scrollWidth, clientW: el.clientWidth };
		});
		expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1);

		// A short landscape phone must get the mobile chrome — both the bottom
		// action bar and the compact top toolbar (not the desktop ribbon).
		await expect(page.getByRole('navigation', { name: 'Editor actions' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
	});

	test('present mode fills the landscape viewport', async ({ page }) => {
		await load(page);
		await page
			.getByRole('button', { name: /present/iu })
			.first()
			.tap();
		await page.waitForTimeout(700);
		await page.screenshot({ path: resolve(shotDir, 'landscape-present.png') });
		await expect(page.getByRole('button', { name: /end presentation/iu }).first()).toBeVisible();
	});
});
