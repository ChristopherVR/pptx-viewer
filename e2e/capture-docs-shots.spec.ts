/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Captures screenshots for the developer docs (docs/ site).
 *
 * Run:
 *   bunx playwright test capture-docs-shots -c playwright.capture.config.ts
 *
 * Output lands in docs/public/docs-shots/. Slide canvas shots are captured for
 * the first slides of the sample deck; unused ones are deleted before commit.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

const sampleDeck = resolve(
	fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)),
);
const outDir = resolve(fileURLToPath(new URL('../docs/public/docs-shots/', import.meta.url)));
mkdirSync(outDir, { recursive: true });

async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(800);
}

test.describe('docs shots: editor chrome', () => {
	test('editor light', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);
		await page.screenshot({
			path: resolve(outDir, 'editor-light.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('editor dark', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);
		await page.screenshot({
			path: resolve(outDir, 'editor-dark.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});
});

test.describe('docs shots: slide canvases', () => {
	test('per-slide canvas shots', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		const canvas = page.locator('[aria-roledescription="slide"]').first();
		for (let slide = 1; slide <= 6; slide++) {
			await canvas.screenshot({
				path: resolve(outDir, `slide-${slide}.jpg`),
				type: 'jpeg',
				quality: 88,
			});
			await page.keyboard.press('ArrowRight');
			await page.waitForTimeout(700);
		}
	});
});
