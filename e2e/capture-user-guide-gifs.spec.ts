import { execSync } from 'node:child_process';
/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Captures screen recordings (converted to GIF) for the User Guide docs.
 *
 * Run:
 *   node_modules/.bin/playwright test e2e/capture-user-guide-gifs.spec.ts --project=react
 *
 * Then convert .webm to .gif:
 *   ffmpeg -i input.webm -vf "fps=12,scale=800:-1" -loop 0 output.gif
 */
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

const sampleDeck = resolve(
	fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)),
);
const outDir = resolve(fileURLToPath(new URL('../docs/public/user-guide/', import.meta.url)));
const videoTmpDir = resolve(outDir, '../_video-tmp');

// Ensure temp dir exists
if (!existsSync(videoTmpDir)) {
	mkdirSync(videoTmpDir, { recursive: true });
}

async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(600);
}

function convertToGif(webmPath: string, gifPath: string, width = 800): void {
	try {
		execSync(
			`ffmpeg -y -i "${webmPath}" -vf "fps=12,scale=${width}:-1:flags=lanczos" -loop 0 "${gifPath}"`,
			{ stdio: 'pipe', timeout: 30_000 },
		);
	} catch (err) {
		// Log the video path so it can be converted manually
		console.warn(`[GIF] ffmpeg conversion failed for ${webmPath} -> ${gifPath}:`, err);
		console.warn(
			`[GIF] Convert manually: ffmpeg -y -i "${webmPath}" -vf "fps=12,scale=${width}:-1" -loop 0 "${gifPath}"`,
		);
	}
}

// ─── Slide Navigation GIF ─────────────────────────────────────────────────────

test.use({
	video: { mode: 'on', size: { width: 1280, height: 720 } },
	viewport: { width: 1280, height: 720 },
});

test.describe('user guide GIFs', () => {
	test('slide navigation', async ({ page }) => {
		await loadDeck(page);

		// Navigate through slides with pauses
		await page.waitForTimeout(500);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(800);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(800);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(800);
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(800);
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(500);

		// Close page to finalize the video
		await page.close();

		const videoPath = resolve(videoTmpDir, 'slide-navigation.webm');
		const vid = page.video();
		if (vid) {
			await vid.saveAs(videoPath);
			convertToGif(videoPath, resolve(outDir, 'viewing-navigation.gif'));
		}
	});

	test('element drag and resize', async ({ page }) => {
		await loadDeck(page);

		// Select and drag an element
		const element = page.locator('[data-pptx-element="true"]').first();
		const box = await element.boundingBox();
		if (box) {
			// Click to select
			await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
			await page.waitForTimeout(400);

			// Drag the element
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.down();
			await page.waitForTimeout(100);
			await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, {
				steps: 15,
			});
			await page.waitForTimeout(100);
			await page.mouse.up();
			await page.waitForTimeout(600);
		}

		await page.close();

		const videoPath = resolve(videoTmpDir, 'element-drag-resize.webm');
		const vid = page.video();
		if (vid) {
			await vid.saveAs(videoPath);
			convertToGif(videoPath, resolve(outDir, 'editing-drag-resize.gif'));
		}
	});

	test('presentation mode with transitions', async ({ page }) => {
		await loadDeck(page);

		// Start slideshow
		const slideShowTab = page.getByRole('tab', { name: 'Slide Show' });
		if (await slideShowTab.isVisible()) {
			await slideShowTab.click();
			await page.waitForTimeout(300);
		}

		const presentBtn = page.getByRole('button', { name: /present|play|start/iu }).first();
		if (await presentBtn.isVisible()) {
			await presentBtn.click();
			await page.waitForTimeout(1200);
		}

		// Navigate a few slides in slideshow
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(1000);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(1000);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(800);

		await page.close();

		const videoPath = resolve(videoTmpDir, 'presenting-transitions.webm');
		const vid = page.video();
		if (vid) {
			await vid.saveAs(videoPath);
			convertToGif(videoPath, resolve(outDir, 'presenting-transitions.gif'));
		}
	});

	test('pen annotation during slideshow', async ({ page }) => {
		await loadDeck(page);

		// Start slideshow
		const slideShowTab = page.getByRole('tab', { name: 'Slide Show' });
		if (await slideShowTab.isVisible()) {
			await slideShowTab.click();
			await page.waitForTimeout(300);
		}

		const presentBtn = page.getByRole('button', { name: /present|play|start/iu }).first();
		if (await presentBtn.isVisible()) {
			await presentBtn.click();
			await page.waitForTimeout(1000);
		}

		// Activate pen
		await page.keyboard.press('p');
		await page.waitForTimeout(300);

		// Draw a wavy line
		await page.mouse.move(200, 400);
		await page.mouse.down();
		for (let i = 0; i < 20; i++) {
			const x = 200 + i * 40;
			const y = 400 + Math.sin(i * 0.5) * 60;
			await page.mouse.move(x, y, { steps: 3 });
			await page.waitForTimeout(30);
		}
		await page.mouse.up();
		await page.waitForTimeout(600);

		await page.close();

		const videoPath = resolve(videoTmpDir, 'presenting-pen-annotation.webm');
		const vid = page.video();
		if (vid) {
			await vid.saveAs(videoPath);
			convertToGif(videoPath, resolve(outDir, 'presenting-pen-annotation.gif'));
		}
	});
});
