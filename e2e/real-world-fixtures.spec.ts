/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Real-world .pptx corpus: every deck loads, renders, and stays error-free.
 *
 * Per fixture the expectations are DERIVED from the package itself (parsed in
 * Node via `e2e/support/pptx-integrity.ts`) instead of hardcoded:
 *   - the "1 of N" indicator must match the deck's own `p:sldIdLst` count;
 *   - the rendered element count on slide 1 must reach the deck's own
 *     top-level `p:spTree` child count. Rendered elements can legitimately
 *     EXCEED that floor because layout/master-inherited elements also render
 *     with `data-element-id` (verified: the Japanese/Chinese/animation decks
 *     render 2 layout extras on slide 1 in every binding);
 *   - no page errors and no console errors may occur during load and render.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { summarizeDeck } from './support/pptx-integrity';
import type { DeckSummary } from './support/pptx-integrity';

test.describe.configure({ timeout: 180_000 });
test.use({ viewport: { width: 1920, height: 1080 } });

const fixtureDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url));

const FIXTURES: readonly string[] = [
	'36_Slides_Extra_Large_22_5_MB_578ce6bbf3.pptx',
	'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx',
	'Japanese_10_Slides_1_8_MB_bbd4090b55.pptx',
	'Mathematical_Equations_11_Slides_46_KB_3c22e70f4d.pptx',
	'Non_Latin_Arabic_RTL_text_11_Slides_7_3_MB_7f135c4f96.pptx',
	'Simplified_Chinese_10_Slides_1_8_MB_792c2c1166.pptx',
	'Slide_Animations_Speaker_comments_8_Slides_2_7_MB_c8f64d1a03.pptx',
];

function fixturePath(filename: string): string {
	return resolve(fixtureDirectory, filename);
}

async function parseFixture(filename: string): Promise<DeckSummary> {
	return summarizeDeck(new Uint8Array(readFileSync(fixturePath(filename))));
}

function slideRegion(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"]');
}

/** Rendered slide-1 elements on the main canvas (slide + inherited layout). */
function renderedElements(page: Page): Locator {
	return page.locator('[data-pptx-viewport] [data-element-id]');
}

/**
 * Start collecting page errors and console errors. Call BEFORE `page.goto` so
 * load-time failures (bad media, parser throws surfaced via console.error) are
 * captured too.
 */
function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', (error) => {
		errors.push(`pageerror: ${String(error)}`);
	});
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(`console.error: ${message.text()}`);
		}
	});
	return errors;
}

async function loadFixture(page: Page, filename: string): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath(filename));
	await slideRegion(page).first().waitFor({ timeout: 120_000 });
	await renderedElements(page).first().waitFor({ state: 'attached', timeout: 120_000 });
}

test.describe('real-world presentation fixtures', () => {
	for (const filename of FIXTURES) {
		test(`loads ${filename}`, async ({ page }) => {
			const summary = await parseFixture(filename);
			const errors = collectErrors(page);
			await loadFixture(page, filename);

			await expect(page.locator('[data-pptx-viewport]')).toBeVisible();
			// Slide count straight from the deck's own sldIdLst.
			await expect(page.getByText(new RegExp(`1 of ${summary.slideCount}`, 'u'))).toBeVisible();
			// Slide 1 must render at least its own top-level spTree children;
			// layout/master placeholders may add more on top (see header).
			expect(
				await renderedElements(page).count(),
				`slide 1 renders its ${summary.firstSlideElementCount} authored elements`,
			).toBeGreaterThanOrEqual(summary.firstSlideElementCount);

			// Let the first paint (fonts, media posters, charts) settle so late
			// async failures surface before the error assertion.
			await page.waitForTimeout(1000);
			expect(errors, 'no page/console errors while loading and rendering').toEqual([]);

			// Preserve the rendered result as a Playwright artifact for comparison
			// with the matching PowerPoint reference export during visual audits.
			await test.info().attach(`${test.info().project.name}-slide-1`, {
				body: await page.locator('[data-pptx-viewport]').screenshot(),
				contentType: 'image/png',
			});
		});
	}

	test('navigates the large presentation to its final slide', async ({ page }) => {
		const filename = FIXTURES[0]!;
		const summary = await parseFixture(filename);
		await loadFixture(page, filename);
		const lastThumbnail = page.getByRole('button', {
			name: `Go to slide ${summary.slideCount}`,
			exact: true,
		});
		await lastThumbnail.click();
		await expect(
			page.getByText(new RegExp(`${summary.slideCount} of ${summary.slideCount}`, 'u')),
		).toBeVisible();
	});
});
