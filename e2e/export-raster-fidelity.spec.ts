/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does the new `foreignObject` raster path actually beat `html2canvas` on
 * the CSS features it exists to fix - measured, not asserted.
 *
 * `fidelity-showcase.pptx` (`generate-fidelity-showcase-fixture.ts`) carries
 * one authentically-authored OOXML fidelity feature (a real `a:scene3d`
 * perspective camera + `a:sp3d` bevel/extrusion - `visual-3d.ts` maps this to
 * a genuine CSS `perspective(...) rotate*(...)` 3D transform). Neither
 * `backdrop-filter` nor a CSS-custom-property-driven fill has any OOXML
 * authoring path anywhere in this codebase, so `injectFidelityTestStyles`
 * applies both to the rendered shape as a stylesheet rule before capturing -
 * a deliberate, documented departure from "everything baked into the
 * fixture": still a genuine test of how the RENDERING PIPELINE handles those
 * two CSS features, just not of an OOXML authoring path that does not exist
 * yet.
 *
 * Methodology: capture the on-screen stage (ground truth) at the same
 * `deviceScaleFactor` as the default 2x export baseline, then drive the same
 * "Export current slide" PNG action through each path in turn:
 *   - default (`mode: 'auto'`) -> the new `foreignObject` path. The spec
 *     PROVES that path ran (no `html2canvas-container` iframe appeared, see
 *     `observeHtml2CanvasRuns`) rather than trusting it: a silent fallback
 *     would otherwise make both numbers below identical and meaningless.
 *   - `URL.createObjectURL` stubbed to reject any `image/svg+xml` blob (the
 *     one thing `rasterizeForeignObjectSvg` creates) -> `foreignObject`
 *     throws for every tile, and since no binding wires a
 *     `vectorSvgFallback`, every tile falls straight through to the
 *     documented `html2canvas-pro` fallback - the exact legacy path, driven
 *     through the real export UI rather than reimplemented here.
 * Each exported PNG is resampled to the on-screen screenshot's pixel size
 * and diffed pixel-by-pixel in-browser (`e2e/support/pixel-diff.ts`).
 *
 * Run: bunx playwright test export-raster-fidelity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeck, slideElements, slideStage, viewport } from './support/deck';
import {
	backstage,
	downloadBytes,
	downloadViaCard,
	openBackstageExport,
	PNG_CARD,
} from './support/exports';
import {
	collectRasterFallbackWarnings,
	countForcedFallbacks,
	countHtml2CanvasRuns,
	forceHtml2CanvasFallback,
	injectFidelityTestStyles,
	observeHtml2CanvasRuns,
	pixelDiff,
} from './support/pixel-diff';

const FIDELITY_DECK = fixture('fidelity-showcase.pptx');
const SHAPE_SELECTOR = '[data-pptx-viewport] [data-pptx-element="true"]';
const VIEWPORT = { width: 1200, height: 800 };
const CHANNEL_THRESHOLD = 24;

test.use({ viewport: VIEWPORT, deviceScaleFactor: 2 });
// Two cold exports (the first html2canvas/foreignObject capture of a page
// warms fonts and stylesheets) plus three in-page pixel diffs.
test.describe.configure({ timeout: 240_000 });

test.describe('selection chrome is absent from raster exports', () => {
	test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
	// These elements exercise the rounded shape, clipped shape, and connector
	// renderers without adding a new fixture or touching the authored content.
	for (const fallback of [false, true]) {
		for (const label of ['Rounded', 'Arrow', 'connector']) {
			test(`${label} selection is absent from ${fallback ? 'fallback' : 'default'} PNG export`, async ({
				page,
			}, testInfo) => {
				if (fallback) {
					await forceHtml2CanvasFallback(page);
				}
				await observeHtml2CanvasRuns(page);
				await loadDeck(page, fixture('canvas-interaction.pptx'));
				await openBackstageExport(page);
				const unselectedDownload = await downloadViaCard(page, PNG_CARD);
				await unselectedDownload.saveAs(testInfo.outputPath('unselected.png'));
				const unselected = await downloadBytes(unselectedDownload);
				await page.keyboard.press('Escape');
				await expect(backstage(page)).not.toBeVisible();

				const target =
					label === 'connector'
						? viewport(page).locator('[aria-roledescription="connector line"]').first()
						: slideElements(page).filter({ hasText: label }).first();
				const box = await target.boundingBox();
				expect(box).not.toBeNull();
				await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
				const handle = viewport(page).getByRole('button', { name: 'Resize nw', exact: true });
				await expect(handle).toBeVisible();
				await openBackstageExport(page);
				// Keep the selection throughout capture: an equal image must not
				// merely prove that File deselected the element before exporting.
				await expect(handle).toBeAttached();
				const selectedDownload = await downloadViaCard(page, PNG_CARD);
				await selectedDownload.saveAs(testInfo.outputPath('selected.png'));
				const selected = await downloadBytes(selectedDownload);
				await expect(handle).toBeAttached();
				const diff = await pixelDiff(page, unselected, selected, { channelThreshold: 8 });
				await testInfo.attach('unselected.png', {
					path: testInfo.outputPath('unselected.png'),
					contentType: 'image/png',
				});
				await testInfo.attach('selected.png', {
					path: testInfo.outputPath('selected.png'),
					contentType: 'image/png',
				});
				expect(diff.diffPixelFraction, JSON.stringify(diff)).toBeLessThan(0.0001);
				if (fallback) {
					expect(await countForcedFallbacks(page)).toBeGreaterThan(0);
					expect(await countHtml2CanvasRuns(page)).toBeGreaterThan(0);
				} else {
					expect(await countHtml2CanvasRuns(page)).toBe(0);
				}
			});
		}
	}
});

/** The fixture authors a red connector and navy outline strokes, not editor UI. */
async function authoredStrokePixels(page: Page, bytes: Uint8Array) {
	return page.evaluate(async (base64) => {
		const bitmap = await createImageBitmap(
			await (await fetch(`data:image/png;base64,${base64}`)).blob(),
		);
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const context = canvas.getContext('2d')!;
		context.drawImage(bitmap, 0, 0);
		bitmap.close();
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let red = 0;
		let navy = 0;
		for (let i = 0; i < pixels.length; i += 4) {
			if (Math.abs(pixels[i] - 192) < 10 && pixels[i + 1] < 10 && pixels[i + 2] < 10) {
				red++;
			}
			if (
				Math.abs(pixels[i] - 31) < 10 &&
				Math.abs(pixels[i + 1] - 56) < 10 &&
				Math.abs(pixels[i + 2] - 100) < 10
			) {
				navy++;
			}
		}
		return { red, navy };
	}, Buffer.from(bytes).toString('base64'));
}

test('default raster export retains the authored SVG connector and shape strokes', async ({
	page,
}, testInfo) => {
	await observeHtml2CanvasRuns(page);
	await loadDeck(page, fixture('canvas-interaction.pptx'));
	await page.mouse.move(0, 0);
	const onScreen = new Uint8Array(await slideStage(page).screenshot());
	const live = await authoredStrokePixels(page, onScreen);
	expect(live.red).toBeGreaterThan(100);
	expect(live.navy).toBeGreaterThan(100);
	await openBackstageExport(page);
	const download = await downloadViaCard(page, PNG_CARD);
	await download.saveAs(testInfo.outputPath('authored-svg-strokes.png'));
	const exported = await authoredStrokePixels(page, await downloadBytes(download));
	expect(
		await countHtml2CanvasRuns(page),
		'the default browser raster path must actually run',
	).toBe(0);
	expect(exported.red, 'the authored connector must still be visible').toBeGreaterThan(100);
	expect(exported.navy, 'the authored outline strokes must still be visible').toBeGreaterThan(100);
});

test.describe('raster export fidelity: foreignObject vs html2canvas vs on-screen', () => {
	test('measures pixel agreement of each raster path against the live on-screen render', async ({
		page,
		browser,
	}) => {
		// 1. Default path. Prove it really was foreignObject.
		const warnings = collectRasterFallbackWarnings(page);
		await observeHtml2CanvasRuns(page);
		await loadDeck(page, FIDELITY_DECK);
		await injectFidelityTestStyles(page, SHAPE_SELECTOR, { transform3d: false });

		const stage = page.locator('[aria-roledescription="slide"]').first();
		await stage.waitFor();
		const screenshot = new Uint8Array(await stage.screenshot());

		await openBackstageExport(page);
		const foreignObjectBytes = await downloadBytes(await downloadViaCard(page, PNG_CARD));
		const defaultPathHtml2CanvasRuns = await countHtml2CanvasRuns(page);
		expect(
			defaultPathHtml2CanvasRuns,
			`the default export must be rasterised by foreignObject, not html2canvas; driver warnings: ${warnings.join(' | ') || '(none)'}`,
		).toBe(0);

		// 2. Forced html2canvas path, on a fresh page with the same styles.
		const html2canvasPage = await browser.newPage({
			viewport: VIEWPORT,
			deviceScaleFactor: 2,
		});
		await forceHtml2CanvasFallback(html2canvasPage);
		await observeHtml2CanvasRuns(html2canvasPage);
		await loadDeck(html2canvasPage, FIDELITY_DECK);
		await injectFidelityTestStyles(html2canvasPage, SHAPE_SELECTOR, { transform3d: false });
		await openBackstageExport(html2canvasPage);
		const html2canvasBytes = await downloadBytes(await downloadViaCard(html2canvasPage, PNG_CARD));
		const forcedFailures = await countForcedFallbacks(html2canvasPage);
		const fallbackHtml2CanvasRuns = await countHtml2CanvasRuns(html2canvasPage);
		await html2canvasPage.close();
		expect(forcedFailures, 'the forced-failure stub must have fired').toBeGreaterThan(0);
		expect(fallbackHtml2CanvasRuns, 'the forced page must have run html2canvas').toBeGreaterThan(0);

		// 3. Measure.
		const diffOptions = { channelThreshold: CHANNEL_THRESHOLD };
		const foreignObjectVsScreen = await pixelDiff(
			page,
			screenshot,
			foreignObjectBytes,
			diffOptions,
		);
		const html2canvasVsScreen = await pixelDiff(page, screenshot, html2canvasBytes, diffOptions);
		const foreignObjectVsHtml2canvas = await pixelDiff(
			page,
			foreignObjectBytes,
			html2canvasBytes,
			diffOptions,
		);

		// eslint-disable-next-line no-console -- the whole point of this spec is to report measured numbers.
		console.log(
			`[fidelity] ${test.info().project.name}: ` +
				`on-screen vs foreignObject: ${JSON.stringify(foreignObjectVsScreen)} | ` +
				`on-screen vs html2canvas: ${JSON.stringify(html2canvasVsScreen)} | ` +
				`foreignObject vs html2canvas: ${JSON.stringify(foreignObjectVsHtml2canvas)} ` +
				`(diffPixelFraction: share of pixels with any RGB channel off by > ${CHANNEL_THRESHOLD}; meanChannelDiff: 0-255)`,
		);

		// The new path must not regress vs the documented fallback: it should
		// disagree with the live render no more than html2canvas does. A gap was
		// measured here once (2026-09-11: diffPixelFraction 0.1798 vs
		// html2canvas's 0.1479 on fidelity-showcase, attributed to Chromium
		// decoding an injected large CSS perspective transform from the SVG
		// image at lower quality) and pinned with a 0.05 allowance. That gap is
		// gone as of the SVG-namespace serialization fix (1e3fdaf5b,
		// 2026-09-15): `buildForeignObjectSvgBody` now serializes the cloned
		// subtree with `XMLSerializer` instead of `outerHTML`, and the malformed
		// nested-SVG markup the old HTML serialization produced was almost
		// certainly what Chromium's decoder choked on. Re-measured 2026-09-16 on
		// this checkout (react project): foreignObject 0.0091 vs html2canvas's
		// 0.1752. Restored to the original small allowance so a real regression
		// still fails.
		expect(
			foreignObjectVsScreen.diffPixelFraction,
			'foreignObject must not be a worse match to the live render than html2canvas is',
		).toBeLessThanOrEqual(html2canvasVsScreen.diffPixelFraction + 0.02);
	});
});
