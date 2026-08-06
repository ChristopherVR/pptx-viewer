/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Deck-as-JSON round trip: File > Export > "Export as JSON" downloads a
 * portable `pptx-viewer-json` document, and the same document loads back
 * through the viewer's File > Open > "Browse this device" picker.
 *
 * Framework-neutral by construction: only the shared DOM contract is used
 * (the `#file-input` upload hook, the "Presentation toolbar" tablist, the
 * backstage `role="dialog"` named "File", accessible button names, and the
 * "Slide N of M" status text). No ports, no project branching, no framework
 * selectors.
 *
 * NOTE: authored without running dev servers in this worktree; it follows the
 * exact contracts of `file-backstage-open.spec.ts` / `save-pptx.ts` and must
 * be integration-verified against the live demos in a follow-up run.
 *
 * Run: bunx playwright test deck-json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Download, Locator, Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const sampleDeck = resolve(fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)));

/** Slide count of the committed sample deck fixture. */
const SAMPLE_SLIDE_COUNT = 7;

const backstage = (page: Page): Locator => page.locator('[role="dialog"][aria-label="File"]');

async function loadSampleDeck(page: Page): Promise<void> {
	await page.goto('./');
	await page.locator('#file-input').setInputFiles(sampleDeck);
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 90_000 });
	await expect(page.getByText(/\b1 of 7\b/u).first()).toBeVisible();
}

/** Open the File tab through the shared toolbar/tablist contract. */
async function openBackstage(page: Page): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name: 'File', exact: true })
		.click();
	await expect(backstage(page)).toBeVisible();
}

/** Export the open deck through the backstage "Export as JSON" card. */
async function exportDeckJson(page: Page): Promise<Download> {
	await openBackstage(page);
	await backstage(page).getByRole('button', { name: 'Export', exact: true }).first().click();

	const jsonCard = backstage(page)
		.getByRole('button', { name: /export as json/iu })
		.first();
	await expect(jsonCard).toBeVisible();

	const downloadPromise = page.waitForEvent('download');
	await jsonCard.click();
	return downloadPromise;
}

test.describe('deck-as-JSON export + import', () => {
	test('exports a pptx-viewer-json document with the format marker and slide count', async ({
		page,
	}) => {
		await loadSampleDeck(page);

		const download = await exportDeckJson(page);
		expect(download.suggestedFilename()).toMatch(/\.json$/u);

		const filePath = await download.path();
		const text = readFileSync(filePath, 'utf8');
		const document = JSON.parse(text) as {
			format?: string;
			version?: number;
			slideCount?: number;
			slides?: unknown[];
			presentation?: { width?: number; height?: number };
		};

		expect(document.format).toBe('pptx-viewer-json');
		expect(document.version).toBe(1);
		expect(document.slideCount).toBe(SAMPLE_SLIDE_COUNT);
		expect(Array.isArray(document.slides)).toBe(true);
		expect(document.slides).toHaveLength(SAMPLE_SLIDE_COUNT);
		expect(typeof document.presentation?.width).toBe('number');
		expect(typeof document.presentation?.height).toBe('number');
	});

	test('re-imports the exported JSON and renders the deck', async ({ page }, testInfo) => {
		await loadSampleDeck(page);

		const download = await exportDeckJson(page);
		const jsonPath = testInfo.outputPath('deck-roundtrip.json');
		await download.saveAs(jsonPath);

		// Reopen the deck from the JSON document via the viewer's own Open pane
		// (the shared picker accepts .json). Some bindings keep the backstage
		// open after an export card click, others close it; normalize first.
		if (!(await backstage(page).isVisible())) {
			await openBackstage(page);
		}
		await backstage(page)
			.getByRole('button', { name: /^open$/iu })
			.first()
			.click();

		const browse = backstage(page)
			.getByRole('button', { name: /browse this device/iu })
			.first();
		await expect(browse).toBeVisible();

		const [chooser] = await Promise.all([
			page.waitForEvent('filechooser', { timeout: 15_000 }),
			browse.click(),
		]);
		await chooser.setFiles(jsonPath);

		// The backstage closes and the JSON deck renders: same slide count and a
		// real text probe from slide 1 of the sample deck.
		await expect(backstage(page)).toBeHidden({ timeout: 30_000 });
		await expect(page.getByText(/\b1 of 7\b/u).first()).toBeVisible({ timeout: 60_000 });
		expect(await page.locator('[data-pptx-viewport] [data-element-id]').count()).toBeGreaterThan(0);
		await expect(page.getByText('Product Overview', { exact: true }).first()).toBeVisible();
	});
});
