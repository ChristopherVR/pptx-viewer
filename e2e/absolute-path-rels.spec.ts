/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/absolute-path-rels.pptx', import.meta.url)),
);

/**
 * Regression test for PPTX files that use absolute relationship targets
 * (paths starting with '/' such as `/ppt/slideLayouts/slideLayout61.xml`).
 *
 * PowerPoint Online produces these; the viewer previously failed to resolve
 * layout/master paths, causing:
 *  - Missing black background (defaulted to white)
 *  - Missing layout decorative elements
 *
 * All assertions are scoped to the main slide canvas (`[data-pptx-viewport]`
 * and the first `[aria-roledescription="slide"]` stage inside it), never to
 * `document.body`: the thumbnail rail renders the same text and elements, so
 * a page-wide read can pass while the canvas is broken.
 */

/**
 * Rendered elements on slide 1 of this fixture: the slide's own 3 shapes
 * (`ppt/slides/slide16.xml` has 3 top-level `p:sp`) plus 8 decorative layout
 * elements that only render when the absolute layout path resolves. All five
 * bindings emit `data-element-id` on both kinds.
 */
const EXPECTED_SLIDE1_ELEMENTS = 11;

async function openDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	// Wait for the first slide element to appear
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor({ timeout: 15_000 });
}

test.describe('absolute-path relationship targets (PowerPoint Online files)', () => {
	test('renders black background from layout/master inheritance', async ({ page }) => {
		await openDeck(page);

		// The slide stage should have a black (or very dark) background.
		// The layout defines: <a:solidFill><a:schemeClr val="tx1"/></a:solidFill>
		// which maps to dk1 = #000000 in this theme.
		const stage = page.locator('[data-pptx-viewport] [aria-roledescription="slide"]').first();
		await stage.waitFor({ timeout: 10_000 });
		const bgColor = await stage.evaluate((node) => getComputedStyle(node).backgroundColor);

		// rgb(0, 0, 0) = black
		expect(bgColor).toBe('rgb(0, 0, 0)');
	});

	test('loads layout decorative elements', async ({ page }) => {
		await openDeck(page);

		// Exactly the slide's own shapes plus the layout decorations; fewer means
		// the absolute layout path silently failed to resolve again, more means
		// something double-renders.
		await expect(page.locator('[data-pptx-viewport] [data-element-id]')).toHaveCount(
			EXPECTED_SLIDE1_ELEMENTS,
		);
	});

	test('slide text content is visible', async ({ page }) => {
		await openDeck(page);

		// The slide's own body text, read from the main canvas only (the
		// thumbnail rail would satisfy a body-wide search even with a blank
		// canvas).
		await expect(page.locator('[data-pptx-viewport]').first()).toContainText(
			/digital time capsule/iu,
		);
	});
});
