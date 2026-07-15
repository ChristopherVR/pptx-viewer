/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Inspector panel responsiveness tests.
 *
 * Verifies that the properties inspector adapts correctly to viewport size:
 *   - Mobile:  bottom-sheet overlay (Format button in the bottom bar)
 *   - Tablet:  desktop-style side panel visible without tapping Format
 *   - Desktop: fixed-width side panel always accessible via toggle
 *
 * Every binding exposes the same `[data-pptx-inspector]` properties surface.
 *
 * Run: bunx playwright test inspector-responsiveness
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const deck = resolve(fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)));
const shotDir = fileURLToPath(
	new URL('../test-results/inspector-responsiveness/', import.meta.url),
);

async function load(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/**
 * Open the inspector side panel via the toolbar toggle button.
 * Bindings with an already-open or selection-driven inspector need no toggle.
 */
async function openInspector(page: Page): Promise<void> {
	const alreadyOpen = page.locator('[data-pptx-inspector]:visible');
	if (
		await alreadyOpen
			.first()
			.isVisible()
			.catch(() => false)
	) {
		return;
	}
	const toggleBtn = page.getByRole('button', { name: 'Toggle inspector panel' });
	// Only click if the inspector is not already open (button may be hidden on mobile).
	if (await toggleBtn.isVisible()) {
		await toggleBtn.click();
		await page.waitForTimeout(200);
	}
}

/** Return the inspector side panel locator for the given framework. */
function inspectorLocator(page: Page) {
	return page.locator('[data-pptx-inspector]:visible');
}

// ── Mobile (375x812, touch) ──────────────────────────────────────────────────

test.describe('mobile inspector (375x812, touch)', () => {
	test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

	test('Format button visible in bottom bar after selecting an element', async ({
		page,
	}, testInfo) => {
		await load(page);

		// Tap an element to select it.
		await page.locator('[data-pptx-element="true"]').last().tap();
		await page.waitForTimeout(200);

		// The Format button must appear in the mobile bottom bar for all frameworks.
		// Vue uses the "Slide controls" navigation label; other bindings use
		// "Editor actions".
		const formatBtn = page.getByRole('button', { name: 'Format' });
		await expect(formatBtn).toBeVisible();

		await page.screenshot({
			path: resolve(shotDir, `mobile-format-btn-${testInfo.project.name}.png`),
		});
	});

	test('tapping Format opens an inspector sheet overlay', async ({ page }, testInfo) => {
		await load(page);

		// Select an element first.
		await page.locator('[data-pptx-element="true"]').last().tap();
		await page.waitForTimeout(200);

		// Tap Format in the bottom bar.
		await page.getByRole('button', { name: 'Format' }).tap();
		await page.waitForTimeout(300);

		await expect(inspectorLocator(page)).toBeVisible();

		await page.screenshot({
			path: resolve(shotDir, `mobile-format-sheet-${testInfo.project.name}.png`),
		});
	});

	test('inspector sheet does not cover the full viewport (constrained height)', async ({
		page,
	}, testInfo) => {
		// Every binding uses a bottom-sheet pattern with a bounded max-height, so the top portion
		// of the slide canvas remains visible above the sheet.
		await load(page);

		await page.locator('[data-pptx-element="true"]').last().tap();
		await page.waitForTimeout(200);

		await page.getByRole('button', { name: 'Format' }).tap();
		await page.waitForTimeout(300);

		const vp = page.viewportSize()!;

		const sheetEl = inspectorLocator(page);

		await expect(sheetEl).toBeVisible();
		const box = await sheetEl.boundingBox();
		if (box) {
			// The sheet should start below the very top of the viewport (it's a bottom sheet).
			expect(box.y, 'inspector sheet must not start at viewport top').toBeGreaterThan(0);
			// The sheet height must be less than the full viewport height.
			expect(box.height, 'inspector sheet height must be less than viewport height').toBeLessThan(
				vp.height,
			);
		}

		await page.screenshot({
			path: resolve(shotDir, `mobile-sheet-bounds-${testInfo.project.name}.png`),
		});
	});
});

// ── Tablet portrait (820x1180, touch) ────────────────────────────────────────

test.describe('tablet inspector (820x1180, touch)', () => {
	// At 820px (> 768px breakpoint) all frameworks use desktop chrome.
	// The inspector renders as a side panel, not a bottom sheet.
	// Bindings differ in initial/open-on-selection behavior; `openInspector` normalizes it.
	test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

	// The checks below use each binding's normalized side-panel locator.

	test('inspector side panel visible after selecting an element; no bottom bar', async ({
		page,
	}, testInfo) => {
		await load(page);

		// At tablet width, mobile bottom bar is absent.
		await expect(page.getByRole('navigation', { name: 'Editor actions' })).not.toBeVisible();

		// Open the inspector panel when the binding requires an explicit toggle.
		await openInspector(page);

		// Select an element.
		// force: true - at these viewport widths the first element (a rect) can be
		// visually overlapped by a sibling title textbox once the inspector panel
		// opens and narrows the canvas, which reflows the title's autofit text and
		// makes it intercept pointer events over the rect below it. Which element
		// ends up selected doesn't matter for these assertions (only "some element
		// is selected so the inspector has content" does), so bypass the
		// actionability/interception check rather than chase the exact overlap.
		await page.locator('[data-pptx-element="true"]').first().click({ force: true });
		await page.waitForTimeout(300);

		// For Angular, ensure the inspector content is for the selected element.
		// For React, the inspector opens after toggle + element select.
		// For Vue, inspectorOpen=true by default, inspector shows after element select.
		const inspector = inspectorLocator(page);
		await expect(inspector).toBeVisible();

		await page.screenshot({
			path: resolve(shotDir, `tablet-inspector-${testInfo.project.name}.png`),
		});
	});
});

// ── Desktop (1280x800, no touch) ─────────────────────────────────────────────

test.describe('desktop inspector (1280x800, no touch)', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('inspector side panel visible as fixed-width panel after toggle + select', async ({
		page,
	}, testInfo) => {
		await load(page);

		// Open the inspector panel via toolbar toggle.
		await openInspector(page);

		// Select an element so the inspector has content to show.
		// force: true - at these viewport widths the first element (a rect) can be
		// visually overlapped by a sibling title textbox once the inspector panel
		// opens and narrows the canvas, which reflows the title's autofit text and
		// makes it intercept pointer events over the rect below it. Which element
		// ends up selected doesn't matter for these assertions (only "some element
		// is selected so the inspector has content" does), so bypass the
		// actionability/interception check rather than chase the exact overlap.
		await page.locator('[data-pptx-element="true"]').first().click({ force: true });
		await page.waitForTimeout(300);

		const inspector = inspectorLocator(page);
		await expect(inspector).toBeVisible();

		// On desktop the inspector must render as a side panel, not a bottom sheet.
		// Check that its top-left origin is near the right side of the viewport and
		// its top edge aligns with the presentation content, rather than appearing
		// as a bottom sheet.
		const vp = page.viewportSize()!;
		const box = await inspector.boundingBox();
		const contentBox = await page.locator('[data-pptx-viewport]').first().boundingBox();
		if (box) {
			// The inspector should start somewhere in the right half of the viewport.
			expect(box.x, 'desktop inspector must be in the right half').toBeGreaterThan(vp.width / 2);
			if (contentBox) {
				expect(
					Math.abs(box.y - contentBox.y),
					'desktop inspector should align with the presentation content',
				).toBeLessThan(20);
			}
			// Its height should span most of the viewport (side panel is full-height).
			expect(box.height, 'desktop inspector should be tall (side panel)').toBeGreaterThan(
				vp.height / 2,
			);
			expect(box.width, 'desktop inspector should match React width').toBeGreaterThanOrEqual(288);
			expect(box.width, 'desktop inspector should match React width').toBeLessThanOrEqual(289);
		}

		await page.screenshot({
			path: resolve(shotDir, `desktop-inspector-${testInfo.project.name}.png`),
		});
	});

	test('inspector is a side panel (not a bottom sheet) on desktop', async ({ page }, testInfo) => {
		await load(page);

		// Open the inspector panel via toolbar toggle.
		await openInspector(page);

		// Select an element.
		// force: true - at these viewport widths the first element (a rect) can be
		// visually overlapped by a sibling title textbox once the inspector panel
		// opens and narrows the canvas, which reflows the title's autofit text and
		// makes it intercept pointer events over the rect below it. Which element
		// ends up selected doesn't matter for these assertions (only "some element
		// is selected so the inspector has content" does), so bypass the
		// actionability/interception check rather than chase the exact overlap.
		await page.locator('[data-pptx-element="true"]').first().click({ force: true });
		await page.waitForTimeout(300);

		const inspector = inspectorLocator(page);
		await expect(inspector).toBeVisible();

		// Confirm no role="dialog" (bottom-sheet overlay) is present, which would
		// indicate a mobile sheet appearing at desktop width by mistake.
		await expect(page.getByRole('dialog')).toHaveCount(0);

		await page.screenshot({
			path: resolve(shotDir, `desktop-no-sheet-${testInfo.project.name}.png`),
		});
	});
});
