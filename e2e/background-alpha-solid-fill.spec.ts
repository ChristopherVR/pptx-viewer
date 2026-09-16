/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Regression coverage for issue #288 ("Slide background a:solidFill ignores
 * a:alpha"), run identically against every framework demo.
 *
 * `e2e/fixtures/background-alpha.pptx` (generate-background-alpha-fixture.ts)
 * carries `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="CEE0F3"><a:alpha
 * val="43211"/></a:srgbClr></a:solidFill></p:bgPr></p:bg>`. PowerPoint has no
 * "page behind the page": a semi-transparent slide background is always
 * composited over white, so the rendered colour is the blend of #CEE0F3 at
 * 43.211% opacity onto white, `#EAF2FA` = `rgb(234, 242, 250)`. Before the
 * fix, `slide.backgroundColor` carried the raw, fully-opaque `#CEE0F3`.
 *
 * Assertions are scoped to the main slide stage
 * (`[data-pptx-viewport] [aria-roledescription="slide"]`), the
 * framework-neutral hook all five bindings emit on the slide stage element,
 * never to `document.body`: the thumbnail rail renders the same background.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/background-alpha.pptx', import.meta.url)),
);

async function openDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor({ timeout: 15_000 });
}

test.describe('background a:solidFill a:alpha (issue #288)', () => {
	test('blends the semi-transparent background onto white', async ({ page }) => {
		await openDeck(page);

		const stage = page.locator('[data-pptx-viewport] [aria-roledescription="slide"]').first();
		await stage.waitFor({ timeout: 10_000 });
		const bgColor = await stage.evaluate((node) => getComputedStyle(node).backgroundColor);

		// #EAF2FA = rgb(234, 242, 250): #CEE0F3 blended at 43.211% opacity onto
		// white. Not rgb(206, 224, 243) (#CEE0F3 unblended, the pre-fix defect)
		// and not an rgba(...) string: the resolved colour is a flat value so it
		// renders identically on every stage backdrop (white canvas, dark
		// presentation mode, thumbnails), matching what PowerPoint itself shows.
		expect(bgColor).toBe('rgb(234, 242, 250)');
	});
});
