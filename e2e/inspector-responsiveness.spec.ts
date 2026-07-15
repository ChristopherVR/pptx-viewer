/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Inspector panel responsiveness tests.
 *
 * Verifies that the properties inspector adapts correctly to viewport size:
 *   - Mobile:  bottom-sheet overlay (Format button in the bottom bar)
 *   - Tablet:  desktop-style side panel visible without tapping Format
 *   - Desktop: fixed-width side panel always accessible via toggle
 *
 * Inspector selectors per framework:
 *   React:   role="complementary" aria-label="Properties"  (ViewerInspector.tsx)
 *   Vue:     aside[aria-label="Properties"]                (InspectorPane.vue)
 *   Angular: aside[aria-label="Element properties"]        (power-point-viewer.component.ts)
 *
 * Opening the inspector:
 *   React:   starts closed; opened via "Toggle inspector panel" button (ToolbarPrimaryRow.tsx)
 *   Vue:     inspectorOpen starts as true (ref(true)) but needs an element selected + !isMobile
 *   Angular: auto-opens when an element is selected (inspectorContent() computed)
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
 * The button label differs between React ("Toggle inspector panel") and Vue ("Toggle inspector").
 * Angular auto-opens when an element is selected, so this is a no-op for Angular.
 */
async function openInspector(page: Page, project: string): Promise<void> {
	if (project === 'angular') {
		// Angular inspector auto-opens when selectedElement() is truthy; no toggle needed.
		return;
	}
	// Vue's inspector pane starts OPEN (a slide-level "Slide Properties" panel is
	// shown until an element is selected, when it becomes the "Properties" panel).
	// React's starts closed. The toggle button flips the pane, so clicking it while
	// the pane is already open would CLOSE it. Skip the click when a side panel is
	// already present so this helper is idempotent across frameworks.
	const alreadyOpen =
		project === 'vue'
			? page.locator('aside[aria-label="Properties"], aside[aria-label="Slide Properties"]')
			: page.getByRole('complementary', { name: 'Properties' });
	if (
		await alreadyOpen
			.first()
			.isVisible()
			.catch(() => false)
	) {
		return;
	}
	// React and Vue both have a toggle inspector button in the primary toolbar row.
	// React:  aria-label="Toggle inspector panel"  (uses i18n key pptx.toolbar.toggleInspector)
	// Vue:    aria-label="Toggle inspector panel"   (ToolbarPrimaryRow.vue, same key)
	if (project === 'vanilla' || project === 'svelte') {
		return;
	}
	const label = project === 'react' ? 'Toggle inspector panel' : 'Toggle inspector';
	const toggleBtn = page.getByRole('button', { name: label });
	// Only click if the inspector is not already open (button may be hidden on mobile).
	if (await toggleBtn.isVisible()) {
		await toggleBtn.click();
		await page.waitForTimeout(200);
	}
}

/** Return the inspector side panel locator for the given framework. */
function inspectorLocator(page: Page, project: string) {
	if (project === 'react') {
		return page.getByRole('complementary', { name: 'Properties' });
	}
	if (project === 'angular') {
		return page.locator('aside[aria-label="Element properties"]');
	}
	// Vue: aside[aria-label="Properties"]
	return page.locator('aside[aria-label="Properties"]');
}

// ── Mobile (375x812, touch) ──────────────────────────────────────────────────

test.describe('mobile inspector (375x812, touch)', () => {
	test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

	// Vue's mobile inspector opens as a MobileSheet (role="dialog") which differs from
	// the React/Angular bottom-sheet approach tested here. Vue's Format tap triggers
	// openMobileSheet('format') rendering a <MobileSheet> with a "Format" title. The
	// Format button in Vue's bottom bar uses aria-label="Format", same as React/Angular,
	// so that part of the test passes -- but the sheet is a role="dialog" container
	// rather than the inspector complementary region. We include Vue for the Format
	// button and sheet existence checks below.

	test('Format button visible in bottom bar after selecting an element', async ({
		page,
	}, testInfo) => {
		await load(page);

		// Tap an element to select it.
		await page.locator('[data-pptx-element="true"]').last().tap();
		await page.waitForTimeout(200);

		// The Format button must appear in the mobile bottom bar for all frameworks.
		// React/Angular: inside role="navigation" aria-label="Editor actions"
		// Vue:           inside role="navigation" aria-label="Slide controls"
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

		if (
			testInfo.project.name === 'vue' ||
			testInfo.project.name === 'vanilla' ||
			testInfo.project.name === 'svelte'
		) {
			// Vue opens a MobileSheet dialog (role="dialog") for the inspector on mobile.
			// The sheet has a "Format" title heading rendered inside it.
			const sheet = page.getByRole('dialog');
			await expect(sheet).toBeVisible();
		} else {
			// React opens InspectorPane as a bottom sheet (max-md:fixed, slides up from bottom).
			// Angular opens pptx-ng-inspector-host as a bottom drawer (position: fixed, mobile styles).
			// Both are wired to the Format button in the bottom bar and appear as overlays.
			// React: the inspector wrapper has role="complementary" aria-label="Properties".
			// Angular: the inspector aside has aria-label="Element properties" (mobile: bottom drawer).
			const inspector = inspectorLocator(page, testInfo.project.name);
			await expect(inspector).toBeVisible();
		}

		await page.screenshot({
			path: resolve(shotDir, `mobile-format-sheet-${testInfo.project.name}.png`),
		});
	});

	test('inspector sheet does not cover the full viewport (constrained height)', async ({
		page,
	}, testInfo) => {
		// Vue's mobile inspector is a MobileSheet (role="dialog").
		// React's is InspectorPane (max-md:max-h-[75dvh]).
		// Angular's is pptx-ng-inspector-host (mobile: max-height: 40vh).
		// All use a bottom-sheet pattern with a bounded max-height, so the top portion
		// of the slide canvas remains visible above the sheet.
		await load(page);

		await page.locator('[data-pptx-element="true"]').last().tap();
		await page.waitForTimeout(200);

		await page.getByRole('button', { name: 'Format' }).tap();
		await page.waitForTimeout(300);

		const vp = page.viewportSize()!;

		// Find the inspector/sheet element.
		let sheetEl: ReturnType<Page['locator']>;
		if (testInfo.project.name === 'vue') {
			// Vue's MobileSheet panel has class "pptx-vue-msheet-panel".
			sheetEl = page.locator('.pptx-vue-msheet-panel');
		} else if (testInfo.project.name === 'angular') {
			sheetEl = page.locator('.pptx-ng-inspector-host');
		} else if (testInfo.project.name === 'vanilla') {
			sheetEl = page.locator('.pptxv-mobile-sheet');
		} else if (testInfo.project.name === 'svelte') {
			sheetEl = page.locator('.pptx-svelte-mobile-sheet');
		} else {
			// React: the InspectorPane div that slides up from the bottom.
			sheetEl = page.locator('[role="complementary"][aria-label="Properties"]');
		}

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
	// React needs explicit toggle; Angular auto-opens on element select; Vue starts open.
	test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

	// Vue's desktop inspector requires canEdit=true AND inspectorOpen (which starts as true)
	// AND an element selection. The checks below cover React and Angular.
	// Vue is included but its inspector locator differs (aside[aria-label="Properties"]).

	test('inspector side panel visible after selecting an element; no bottom bar', async ({
		page,
	}, testInfo) => {
		await load(page);

		// At tablet width, mobile bottom bar is absent.
		if (testInfo.project.name === 'vue') {
			await expect(page.getByRole('navigation', { name: 'Slide controls' })).toHaveCount(0);
		} else if (testInfo.project.name === 'vanilla' || testInfo.project.name === 'svelte') {
			await expect(page.getByRole('navigation', { name: 'Editor actions' })).not.toBeVisible();
		} else {
			await expect(page.getByRole('navigation', { name: 'Editor actions' })).toHaveCount(0);
		}

		// Open the inspector panel (React/Vue need toggle; Angular auto-opens on select).
		await openInspector(page, testInfo.project.name);

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
		const inspector = inspectorLocator(page, testInfo.project.name);
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
		await openInspector(page, testInfo.project.name);

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

		const inspector = inspectorLocator(page, testInfo.project.name);
		await expect(inspector).toBeVisible();

		// On desktop the inspector must render as a side panel, not a bottom sheet.
		// Check that its top-left origin is near the right side of the viewport and
		// its y-position is near the top (not a bottom sheet starting near vp.height).
		const vp = page.viewportSize()!;
		const box = await inspector.boundingBox();
		if (box) {
			// The inspector should start somewhere in the right half of the viewport.
			expect(box.x, 'desktop inspector must be in the right half').toBeGreaterThan(vp.width / 2);
			// It should start near the top of the content area (within 200px of viewport top).
			expect(box.y, 'desktop inspector should start near the top').toBeLessThan(200);
			// Its height should span most of the viewport (side panel is full-height).
			expect(box.height, 'desktop inspector should be tall (side panel)').toBeGreaterThan(
				vp.height / 2,
			);
			if (testInfo.project.name === 'vanilla' || testInfo.project.name === 'svelte') {
				expect(box.width, 'desktop inspector should match React width').toBeGreaterThanOrEqual(288);
				expect(box.width, 'desktop inspector should match React width').toBeLessThanOrEqual(289);
			}
		}

		await page.screenshot({
			path: resolve(shotDir, `desktop-inspector-${testInfo.project.name}.png`),
		});
	});

	test('inspector is a side panel (not a bottom sheet) on desktop', async ({ page }, testInfo) => {
		await load(page);

		// Open the inspector panel via toolbar toggle.
		await openInspector(page, testInfo.project.name);

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

		const inspector = inspectorLocator(page, testInfo.project.name);
		await expect(inspector).toBeVisible();

		// Confirm no role="dialog" (bottom-sheet overlay) is present, which would
		// indicate a mobile sheet appearing at desktop width by mistake.
		await expect(page.getByRole('dialog')).toHaveCount(0);

		await page.screenshot({
			path: resolve(shotDir, `desktop-no-sheet-${testInfo.project.name}.png`),
		});
	});
});
