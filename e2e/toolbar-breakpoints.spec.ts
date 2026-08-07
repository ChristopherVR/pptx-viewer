/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Toolbar breakpoint switching tests.
 *
 * Verifies that the correct chrome (mobile vs desktop) renders at each
 * viewport band and that no chrome causes horizontal page-level overflow.
 *
 * Shared DOM/accessibility contract:
 *   Mobile toolbar: role="toolbar" aria-label="Toolbar"
 *   Desktop ribbon: role="toolbar" aria-label="Presentation toolbar"
 *   Bottom bar:     role="navigation" aria-label="Editor actions"
 *
 * Run: bunx playwright test toolbar-breakpoints
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
const shotDir = fileURLToPath(new URL('../test-results/toolbar-breakpoints/', import.meta.url));

async function load(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
	const overflow = await page.evaluate(() => {
		const el = document.scrollingElement ?? document.documentElement;
		return { scrollW: el.scrollWidth, clientW: el.clientWidth };
	});
	expect(overflow.scrollW, 'page must not scroll horizontally').toBeLessThanOrEqual(
		overflow.clientW + 1,
	);
}

function bottomBarNav(page: Page) {
	return page.getByRole('navigation', { name: 'Editor actions' });
}

// ── Mobile portrait ──────────────────────────────────────────────────────────

test.describe('mobile portrait (375x812, touch)', () => {
	test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

	test('mobile toolbar and bottom bar visible; desktop ribbon absent; no overflow', async ({
		page,
	}, testInfo) => {
		await load(page);

		// All frameworks render a compact top bar with role=toolbar aria-label=Toolbar on mobile.
		const mobileToolbar = page.getByRole('toolbar', { name: 'Toolbar', exact: true });
		await expect(mobileToolbar).toBeVisible();

		// CSS-mounted bindings keep the desktop ribbon hidden in the DOM on phones.
		await expect(page.getByRole('toolbar', { name: 'Presentation toolbar' })).not.toBeVisible();

		// Menu (hamburger) button is present in the mobile top bar on all frameworks.
		await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

		await expect(bottomBarNav(page)).toBeVisible();
		for (const name of ['Menu', 'Undo', 'Redo', 'Save', 'Present']) {
			await expect(mobileToolbar.getByRole('button', { name, exact: true })).toBeVisible();
		}
		const bottomBar = bottomBarNav(page);
		for (const name of ['Slides', 'Insert', 'Format', 'Comments', 'Toggle notes']) {
			await expect(bottomBar.getByRole('button', { name, exact: true })).toBeVisible();
		}

		// No horizontal page overflow regardless of which mobile chrome is shown.
		await assertNoHorizontalOverflow(page);

		await page.screenshot({
			path: resolve(shotDir, `mobile-portrait-${testInfo.project.name}.png`),
		});
	});
});

// ── Tablet portrait ──────────────────────────────────────────────────────────

test.describe('tablet portrait (820x1180, touch)', () => {
	test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

	test('desktop chrome renders; no mobile bottom bar; canvas visible; no overflow', async ({
		page,
	}, testInfo) => {
		await load(page);

		// At 820px (> 768px mobile breakpoint) all frameworks switch to desktop chrome.
		await expect(page.getByRole('toolbar', { name: 'Presentation toolbar' })).toBeVisible();

		// The mobile bottom bar must be absent at tablet width.
		await expect(bottomBarNav(page)).not.toBeVisible();

		// Slide canvas/viewport must be visible.
		await expect(page.locator('[data-pptx-viewport]').first()).toBeVisible();

		// No horizontal page overflow.
		await assertNoHorizontalOverflow(page);

		await page.screenshot({
			path: resolve(shotDir, `tablet-portrait-${testInfo.project.name}.png`),
		});
	});
});

// ── Desktop ──────────────────────────────────────────────────────────────────

test.describe('desktop (1280x800, no touch)', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('desktop ribbon visible; no mobile chrome; no overflow', async ({ page }, testInfo) => {
		await load(page);

		// Desktop ribbon present on all frameworks.
		await expect(page.getByRole('toolbar', { name: 'Presentation toolbar' })).toBeVisible();

		// Neither flavour of mobile bottom bar should be present.
		await expect(bottomBarNav(page)).not.toBeVisible();

		// The mobile compact top toolbar must also be absent. `exact` is required:
		// the desktop ribbon's accessible name is "Presentation toolbar", and a
		// default (substring) name match for "Toolbar" would match the ribbon too.
		await expect(page.getByRole('toolbar', { name: 'Toolbar', exact: true })).not.toBeVisible();

		// No horizontal page overflow.
		await assertNoHorizontalOverflow(page);

		await page.screenshot({
			path: resolve(shotDir, `desktop-${testInfo.project.name}.png`),
		});
	});
});

// ── Narrow viewport (EditorToolbar overflow-scroll fix) ──────────────────────

test.describe('narrow viewport (640x900, no touch)', () => {
	// NOTE: 640px is below the 768px mobile breakpoint, so mobile chrome renders on all
	// frameworks at this width. The primary assertion is the EditorToolbar overflow-scroll
	// fix: the PAGE must not gain a horizontal scrollbar even though toolbar content may
	// be cramped. Mobile chrome may scroll internally, but document.scrollingElement.scrollWidth
	// must not exceed clientWidth.
	test.use({ viewport: { width: 640, height: 900 } });

	test('page does not scroll horizontally; toolbar may scroll internally', async ({
		page,
	}, testInfo) => {
		await load(page);

		// Key assertion: no horizontal page-level overflow.
		// This is the EditorToolbar overflow-scroll regression check.
		await assertNoHorizontalOverflow(page);

		// At 640px (< 768px) all frameworks are in mobile mode; the mobile compact
		// toolbar should be present and visible.
		const mobileToolbar = page.getByRole('toolbar', { name: 'Toolbar', exact: true });
		await expect(mobileToolbar).toBeVisible();

		// The toolbar element itself must not extend beyond the viewport width.
		const toolbarBox = await mobileToolbar.boundingBox();
		if (toolbarBox) {
			const vp = page.viewportSize()!;
			expect(
				toolbarBox.x + toolbarBox.width,
				'toolbar right edge must not exceed viewport width',
			).toBeLessThanOrEqual(vp.width + 1);
		}

		await page.screenshot({
			path: resolve(shotDir, `narrow-640-${testInfo.project.name}.png`),
		});
	});
});

// ── Dynamic resize: desktop to mobile ────────────────────────────────────────

test.describe('dynamic resize: desktop to mobile', () => {
	// Start at full desktop width, then shrink to a phone width and verify that
	// the toolbar switches chrome without a page reload.
	test.use({ viewport: { width: 1280, height: 800 } });

	test('toolbar switches from desktop to mobile chrome on resize', async ({ page }) => {
		await load(page);
		const bottomBar = bottomBarNav(page);

		// Confirm desktop ribbon at the starting width.
		await expect(page.getByRole('toolbar', { name: 'Presentation toolbar' })).toBeVisible();
		await expect(bottomBar).not.toBeVisible();

		// Shrink the viewport to a phone width.
		await page.setViewportSize({ width: 360, height: 812 });
		// Allow one React re-render cycle after the ResizeObserver fires.
		await page.waitForTimeout(300);

		// Mobile chrome must now be present without a page reload.
		await expect(page.getByRole('toolbar', { name: 'Toolbar', exact: true })).toBeVisible();
		await expect(bottomBar).toBeVisible();
		await expect(page.getByRole('toolbar', { name: 'Presentation toolbar' })).not.toBeVisible();

		// The page must still not overflow horizontally after the resize.
		await assertNoHorizontalOverflow(page);

		await page.screenshot({
			path: resolve(shotDir, 'dynamic-resize-after.png'),
		});
	});
});
