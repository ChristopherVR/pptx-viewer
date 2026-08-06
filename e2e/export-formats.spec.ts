/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the raster/document export formats actually produce valid files?
 *
 * Until now the only export with e2e coverage was `.pptx` save: PNG, PDF and
 * GIF export had none, so a binding could ship a card that downloads an empty
 * blob, a PDF missing pages, or a mislabeled container and stay green. Each
 * download test goes through the real user path - File backstage > Export >
 * the shared action card - captures the download event, and validates the
 * payload by magic bytes plus a size floor. The PDF test additionally proves
 * the per-slide capture loop ran by counting page objects against the deck's
 * slide count.
 *
 * The progress-modal check is a cross-binding test so one run proves all five
 * bindings surface the same visible export-progress UI.
 *
 * Run: bunx playwright test export-formats
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck, loadDeckAt } from './support/deck';
import {
	downloadBytes,
	downloadViaCard,
	EXPORT_DECK,
	EXPORT_DECK_SLIDE_COUNT,
	exportCard,
	GIF_CARD,
	isGif,
	isPdf,
	isPng,
	openBackstageExport,
	PDF_CARD,
	pdfPageCount,
	PNG_CARD,
	progressAppears,
} from './support/exports';
import { byBinding } from './support/menu-report';
import { acrossFrameworks } from './support/parity';

const VIEWPORT = { width: 1600, height: 950 };
test.use({ viewport: VIEWPORT });
test.describe.configure({ timeout: 180_000 });

async function openExportPage(page: Page): Promise<void> {
	await loadDeck(page, EXPORT_DECK);
	await openBackstageExport(page);
}

test.describe('export formats', () => {
	test('the Export page offers the shared PNG, PDF and GIF cards', async ({ page }) => {
		await openExportPage(page);
		await expect(exportCard(page, PNG_CARD)).toBeVisible();
		await expect(exportCard(page, PDF_CARD)).toBeVisible();
		await expect(exportCard(page, GIF_CARD)).toBeVisible();
	});

	test('PNG export downloads a real PNG of the current slide', async ({ page }) => {
		await openExportPage(page);

		const download = await downloadViaCard(page, PNG_CARD);
		expect(download.suggestedFilename()).toMatch(/slide-1\.png$/u);

		const bytes = await downloadBytes(download);
		expect(isPng(bytes), 'payload must start with the PNG signature').toBe(true);
		// A rendered 4:3 slide at export scale is tens of KB; an empty or
		// one-pixel canvas (the classic silent-failure mode) is far below this.
		expect(bytes.byteLength).toBeGreaterThan(20_000);
	});

	test('PDF export downloads one page per slide', async ({ page }) => {
		await openExportPage(page);

		const download = await downloadViaCard(page, PDF_CARD);
		expect(download.suggestedFilename()).toMatch(/\.pdf$/u);

		const bytes = await downloadBytes(download);
		expect(isPdf(bytes), 'payload must start with %PDF-').toBe(true);
		expect(bytes.byteLength).toBeGreaterThan(20_000);
		expect(pdfPageCount(bytes), 'the PDF must have one page per slide').toBe(
			EXPORT_DECK_SLIDE_COUNT,
		);
	});

	test('GIF export downloads a real animated GIF', async ({ page }) => {
		await openExportPage(page);

		const download = await downloadViaCard(page, GIF_CARD);
		expect(download.suggestedFilename()).toMatch(/\.gif$/u);

		const bytes = await downloadBytes(download);
		expect(isGif(bytes), 'payload must start with GIF87a/GIF89a').toBe(true);
		expect(bytes.byteLength).toBeGreaterThan(2_000);
	});

	test('a multi-slide PDF export surfaces a visible progress modal', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await loadDeckAt(page, origin, EXPORT_DECK);
				await openBackstageExport(page);
				// The download itself is covered above; this scenario only needs the
				// export to be in flight long enough to observe (or miss) its UI.
				const downloadDone = page
					.waitForEvent('download', { timeout: 120_000 })
					.catch(() => undefined);
				await exportCard(page, PDF_CARD).click();
				const progressSeen = await progressAppears(page, /export as pdf/iu, 60_000);
				if (!progressSeen) {
					// Let a modal-less export finish before the page closes under it.
					await downloadDone;
				}
				return progressSeen;
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) =>
			value ? [] : [`${name}: no visible "Export as PDF" progress UI appeared during the export`],
		);

		expect(problems.join('\n')).toBe('');
	});
});
