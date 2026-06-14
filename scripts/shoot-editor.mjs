/**
 * Capture the editor hero screenshot (.github/assets/editor.png) from the
 * running React demo, loaded with the clean, non-proprietary sample deck.
 *
 * Prereqs: the demo dev server must be running on :4173
 *   bun run --filter pptx-react-demo dev
 *
 *   node scripts/shoot-editor.mjs
 */
import { chromium } from '@playwright/test';

const URL = process.env.DEMO_URL ?? 'http://localhost:4173/';
const DECK = '.github/assets/sample-deck.pptx';
const OUT = '.github/assets/editor.png';

const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
	});
	await page.goto(URL, { waitUntil: 'load', timeout: 60_000 });

	// Load the clean deck through the demo's hidden file input.
	await page.setInputFiles('#file-input', DECK);

	// Wait for the editor ribbon to mount, then let the slide + thumbnails paint.
	await page.waitForSelector('text=Insert', { timeout: 60_000 });
	await page.waitForTimeout(6_000);

	await page.screenshot({ path: OUT });
	console.log(`[shoot-editor] wrote ${OUT}`);
} finally {
	await browser.close();
}
