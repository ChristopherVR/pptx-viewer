/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Captures the landing page hero recording: the real React viewer loading a
 * deck, flipping slides, dragging an element, and presenting.
 *
 * Run:
 *   node_modules/.bin/playwright test e2e/capture-hero-gif.spec.ts --project=react
 *
 * The raw .webm lands in docs/public/_video-tmp/hero-viewer.webm along with a
 * hero-viewer.trim file holding the seconds to cut from the start (the deck
 * load). Convert with a speed-up, e.g.:
 *   ffmpeg -ss <trim> -i hero-viewer.webm -filter_complex \
 *     "[0:v]setpts=PTS/2.2,fps=14,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" \
 *     docs/public/hero-viewer.gif
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

const sampleDeck = resolve(
	fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)),
);
const videoTmpDir = resolve(fileURLToPath(new URL('../docs/public/_video-tmp/', import.meta.url)));

if (!existsSync(videoTmpDir)) {
	mkdirSync(videoTmpDir, { recursive: true });
}

test.use({
	video: { mode: 'on', size: { width: 1280, height: 720 } },
	viewport: { width: 1280, height: 720 },
});

test('hero viewer montage', async ({ page }) => {
	const started = Date.now();
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(400);
	const trimSeconds = (Date.now() - started) / 1000;

	// Flip to the chart slide
	await page.waitForTimeout(500);
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(900);
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(900);

	// Select and drag an element to show editing handles and guides
	const element = page.locator('[data-pptx-element="true"]').first();
	const box = await element.boundingBox();
	if (box) {
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await page.waitForTimeout(600);
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 18 });
		await page.mouse.up();
		await page.waitForTimeout(500);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
		await page.mouse.up();
		await page.waitForTimeout(600);
	}

	// Continue through the architecture and table slides
	await page.keyboard.press('Escape');
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(900);
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(1100);

	await page.close();

	const vid = page.video();
	if (vid) {
		await vid.saveAs(resolve(videoTmpDir, 'hero-viewer.webm'));
		writeFileSync(resolve(videoTmpDir, 'hero-viewer.trim'), String(trimSeconds));
	}
});
