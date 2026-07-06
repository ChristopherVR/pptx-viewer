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
 */

async function openDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	// Wait for the first slide element to appear
	await page.locator('[data-pptx-element="true"]').first().waitFor({ timeout: 15_000 });
}

test.describe('absolute-path relationship targets (PowerPoint Online files)', () => {
	test('renders black background from layout/master inheritance', async ({ page }) => {
		await openDeck(page);

		// The slide stage should have a black (or very dark) background.
		// The layout defines: <a:solidFill><a:schemeClr val="tx1"/></a:solidFill>
		// which maps to dk1 = #000000 in this theme.
		const bgColor = await page.evaluate(() => {
			const stage = document.querySelector('[aria-roledescription="slide"]');
			if (!stage) {
				throw new Error('no slide stage found');
			}
			return getComputedStyle(stage).backgroundColor;
		});

		// rgb(0, 0, 0) = black
		expect(bgColor).toBe('rgb(0, 0, 0)');
	});

	test('loads layout decorative elements', async ({ page }) => {
		await openDeck(page);

		// The layout has decorative group shapes (ellipses, lines, etc.)
		// that should be rendered as layout elements. Without the fix,
		// no elements would appear since even slide-authored shapes rely on
		// the layout path being resolved for placeholder styling.
		const elementCount = await page.evaluate(() => {
			return document.querySelectorAll('[data-pptx-element="true"]').length;
		});

		// The slide has text placeholders + layout decorative shapes.
		// Without the fix, path resolution fails silently and elements are
		// missing or improperly styled.
		expect(elementCount).toBeGreaterThanOrEqual(3);
	});

	test('slide text content is visible', async ({ page }) => {
		await openDeck(page);

		// The slide has direct text content (title, footer, body) that should
		// render. Use a broader search since the slide container selector may vary.
		const hasText = await page.evaluate(() => {
			const body = document.body.innerText;
			return body.includes('COLLAGE') || body.includes('DIGITAL TIME CAPSULE');
		});
		expect(hasText).toBe(true);
	});
});
