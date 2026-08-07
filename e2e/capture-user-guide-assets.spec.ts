/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Captures screenshots and screen recordings (GIF-ready) for the User Guide docs.
 *
 * Run:
 *   bunx playwright test capture-user-guide-assets --project=react
 *
 * Output lands in docs/public/user-guide/ as .jpg screenshots and .webm recordings
 * (convert .webm to .gif with ffmpeg for docs).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const sampleDeck = resolve(
	fileURLToPath(new URL('../.github/assets/sample-deck.pptx', import.meta.url)),
);
const outDir = resolve(fileURLToPath(new URL('../docs/public/user-guide/', import.meta.url)));

async function loadDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(800);
}

// ─── Overview / Layout Screenshots ────────────────────────────────────────────

test.describe('user guide: overview', () => {
	test('full editor layout', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		await page.screenshot({
			path: resolve(outDir, 'overview-full-layout.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('toolbar close-up', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		const toolbar = page.locator('[role="toolbar"]').first();
		if (await toolbar.isVisible()) {
			await toolbar.screenshot({
				path: resolve(outDir, 'overview-toolbar.jpg'),
				type: 'jpeg',
				quality: 85,
			});
		} else {
			// Fallback: capture top portion of the page
			await page.screenshot({
				path: resolve(outDir, 'overview-toolbar.jpg'),
				type: 'jpeg',
				quality: 85,
				clip: { x: 0, y: 0, width: 1440, height: 120 },
			});
		}
	});

	test('slides panel', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// The slides panel is typically on the left side
		await page.screenshot({
			path: resolve(outDir, 'overview-slides-panel.jpg'),
			type: 'jpeg',
			quality: 85,
			clip: { x: 0, y: 100, width: 260, height: 700 },
		});
	});
});

// ─── Viewing ──────────────────────────────────────────────────────────────────

test.describe('user guide: viewing', () => {
	test('slide canvas with content', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		const canvas = page.locator('[aria-roledescription="slide"]').first();
		await canvas.screenshot({
			path: resolve(outDir, 'viewing-slide-canvas.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('zoom controls in status bar', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Capture the bottom status bar area
		await page.screenshot({
			path: resolve(outDir, 'viewing-status-bar.jpg'),
			type: 'jpeg',
			quality: 85,
			clip: { x: 0, y: 850, width: 1440, height: 50 },
		});
	});

	test.skip('navigate slides recording', async ({ page, context }) => {
		await page.setViewportSize({ width: 1280, height: 720 });
		await loadDeck(page);

		// Record video-like navigation between slides
		await context.tracing.start({ screenshots: true });

		// Navigate through a few slides
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(600);
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(600);
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(600);

		await context.tracing.stop({ path: resolve(outDir, 'viewing-navigation.zip') });
	});
});

// ─── Editing ──────────────────────────────────────────────────────────────────

test.describe('user guide: editing', () => {
	test('element selected with handles', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Select an element
		const element = page.locator('[data-pptx-element="true"]').first();
		await element.click({ force: true });
		await page.waitForTimeout(300);

		await page.screenshot({
			path: resolve(outDir, 'editing-element-selected.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('inspector panel open', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Select an element to populate the inspector
		const element = page.locator('[data-pptx-element="true"]').first();
		await element.click({ force: true });
		await page.waitForTimeout(300);

		// Open inspector if not already open
		const toggleBtn = page.getByRole('button', { name: 'Toggle inspector panel' });
		if (await toggleBtn.isVisible()) {
			await toggleBtn.click();
			await page.waitForTimeout(400);
		}

		await page.screenshot({
			path: resolve(outDir, 'editing-inspector-panel.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('insert menu / toolbar tab', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Click the Insert tab
		const insertTab = page.getByRole('tab', { name: 'Insert' });
		if (await insertTab.isVisible()) {
			await insertTab.click();
			await page.waitForTimeout(300);
		}

		await page.screenshot({
			path: resolve(outDir, 'editing-insert-tab.jpg'),
			type: 'jpeg',
			quality: 85,
			clip: { x: 0, y: 0, width: 1440, height: 150 },
		});
	});

	test('text editing inline', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Double-click a text element to enter inline edit mode
		const textEl = page.locator('[data-pptx-element="true"]').first();
		await textEl.dblclick({ force: true });
		await page.waitForTimeout(400);

		await page.screenshot({
			path: resolve(outDir, 'editing-inline-text.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('arrange tab', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		const arrangeTab = page.getByRole('tab', { name: 'Arrange' });
		if (await arrangeTab.isVisible()) {
			await arrangeTab.click();
			await page.waitForTimeout(300);
		}

		await page.screenshot({
			path: resolve(outDir, 'editing-arrange-tab.jpg'),
			type: 'jpeg',
			quality: 85,
			clip: { x: 0, y: 0, width: 1440, height: 150 },
		});
	});
});

// ─── Presenting ───────────────────────────────────────────────────────────────

test.describe('user guide: presenting', () => {
	test('slideshow mode fullscreen', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Start slideshow - look for Slide Show tab or present button
		const slideShowTab = page.getByRole('tab', { name: 'Slide Show' });
		if (await slideShowTab.isVisible()) {
			await slideShowTab.click();
			await page.waitForTimeout(300);
		}

		// Click the present/play button
		const presentBtn = page.getByRole('button', { name: /present|play|start/iu }).first();
		if (await presentBtn.isVisible()) {
			await presentBtn.click();
			await page.waitForTimeout(1000);
		}

		await page.screenshot({
			path: resolve(outDir, 'presenting-slideshow.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('slideshow toolbar', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
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

		// Move mouse to bottom to reveal slideshow toolbar
		await page.mouse.move(720, 880);
		await page.waitForTimeout(500);

		await page.screenshot({
			path: resolve(outDir, 'presenting-toolbar.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('presenter view', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
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

		// Toggle presenter view with N key
		await page.keyboard.press('n');
		await page.waitForTimeout(500);

		await page.screenshot({
			path: resolve(outDir, 'presenting-presenter-view.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('annotation tools', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
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

		// Activate pen tool
		await page.keyboard.press('p');
		await page.waitForTimeout(300);

		// Draw a stroke across the slide
		await page.mouse.move(400, 400);
		await page.mouse.down();
		await page.mouse.move(600, 350, { steps: 10 });
		await page.mouse.move(800, 450, { steps: 10 });
		await page.mouse.up();
		await page.waitForTimeout(300);

		await page.screenshot({
			path: resolve(outDir, 'presenting-annotation.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});
});

// ─── Exporting ────────────────────────────────────────────────────────────────

test.describe('user guide: exporting', () => {
	test('file tab with export options', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Click File tab to show export menu
		const fileTab = page.getByRole('tab', { name: 'File' });
		if (await fileTab.isVisible()) {
			await fileTab.click();
			await page.waitForTimeout(400);
		}

		await page.screenshot({
			path: resolve(outDir, 'exporting-file-menu.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});
});

// ─── Collaboration ────────────────────────────────────────────────────────────

test.describe('user guide: collaboration', () => {
	test('share dialog / connection UI', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await loadDeck(page);

		// Look for a Share or Collaborate button
		const shareBtn = page.getByRole('button', { name: /share|collaborate/iu }).first();
		if (await shareBtn.isVisible()) {
			await shareBtn.click();
			await page.waitForTimeout(500);
		}

		await page.screenshot({
			path: resolve(outDir, 'collaboration-share-dialog.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});
});

// ─── Mobile Views ─────────────────────────────────────────────────────────────

test.describe('user guide: mobile', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

	test('mobile viewer layout', async ({ page }) => {
		await loadDeck(page);

		await page.screenshot({
			path: resolve(outDir, 'overview-mobile-layout.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});

	test('mobile bottom sheet inspector', async ({ page }) => {
		await loadDeck(page);

		// Tap an element
		await page.locator('[data-pptx-element="true"]').first().tap({ force: true });
		await page.waitForTimeout(300);

		// Tap Format to open bottom sheet
		const formatBtn = page.getByRole('button', { name: 'Format' });
		if (await formatBtn.isVisible()) {
			await formatBtn.tap();
			await page.waitForTimeout(400);
		}

		await page.screenshot({
			path: resolve(outDir, 'overview-mobile-inspector.jpg'),
			type: 'jpeg',
			quality: 85,
		});
	});
});
