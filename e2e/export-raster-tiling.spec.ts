/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does PNG/PDF/GIF/video export actually tile once the export resolution
 * exceeds the browser's canvas cap, instead of clamping or silently
 * truncating?
 *
 * PDF places several small tile images per page instead of stitching
 * (`placeTileOnPage` in `pptx-viewer-shared`) and has been tile-aware since
 * before this file existed; the tests below just close the coverage gap.
 * GIF and video used to hard-clamp (downscale, never tile) through
 * `rasterizeElementClampedToCanvas`; they now go through
 * `rasterizeElementTiledToCanvas` (stitched via `putImageData`, same as PNG's
 * `putImageData`-free row-band stitch) in every binding's single-canvas
 * capture path, which also serves notes-PDF/print for free.
 *
 * GIF and video capture scale is now uniform across all five bindings: every
 * binding's GIF/video export derives its capture scale from the shared
 * `resolveExportCaptureDecision` (`pptx-viewer-shared`), which is
 * `2 * resolveImageResolutionScale(options)`, the same Options-aware baseline
 * PNG/PDF use (before this existed, React captured GIF/video at a fixed
 * 0.5x/1x and Angular at a fixed 2x, both ignoring File > Options > Advanced
 * > "Default resolution" entirely).
 *
 * GIF still does NOT get PNG/PDF's hard "must exceed the stubbed cap"
 * assertion below, but for a reason independent of tiling: GIF has its own
 * post-capture size cap (`resolveExportCaptureDecision`'s
 * `postCaptureMaxSide`, `GIF_POST_CAPTURE_MAX_SIDE` = 1920px, applied via
 * `clampGifDimensions` in every binding), which sits below this file's
 * stubbed 2048px probe cap - so an oversized GIF capture is downscaled back
 * under the stubbed cap before encoding, and tiling need not engage at all.
 * (See the dedicated "Default Resolution" describe block below for the
 * cross-binding assertion that this cap - and the capture scale below it -
 * behaves identically across bindings.) Video has no such cap, so once every
 * binding shares the same capture-scale policy, whether it tiles here is a
 * real tiling signal like PNG/PDF; the video test below still only asserts
 * against a corrupted/wrong-aspect-ratio frame, since proving "did it tile"
 * on top of that is not what this describe block is for. The GIF/video tests
 * below assert what tiling failing would actually break: a corrupted,
 * degenerate, or wrong-aspect-ratio frame - proven under the exact same
 * stubbed-cap conditions that force PNG/PDF to tile.
 *
 * The real per-browser cap (commonly 16,384px) is too large to reach through
 * the live UI on a normal-sized demo deck: even the highest "Image Size and
 * Quality" preset tops out around 7-8x the baseline capture scale. Rather
 * than authoring a giant fixture just to clear that bar, this spec lowers
 * the *effective* cap to 2048px with a `page.addInitScript` that corrupts
 * the read-back of the shared `canvas-size-probe.ts`'s own marker-pixel
 * canvases (it always creates a `{width: <candidate>, height: 1}` canvas
 * to test each candidate, a shape ordinary app content never produces), so
 * the probe genuinely determines 2048px is the largest usable dimension in
 * this browser session. `rasterizeElement`'s tiling path is otherwise
 * untouched: real tiles are rasterised, read back, and stitched by the same
 * pure-JS PNG encoder a truly oversized export on a real device would use.
 *
 * `probeMaxCanvasDimension`'s smallest candidate is 2048px, a hard floor the
 * probe always falls back to, so the sample deck's natural size (well under
 * 1024px on its long edge) needs a scale boost to clear even that floor:
 * File > Options > Advanced > "Default resolution" > "330 ppi" is the
 * highest preset (`resolveImageResolutionScale`, ~3.4x on top of the 2x
 * baseline capture scale), comfortably clearing 2048px on the stubbed cap.
 * Seeded directly into the `pptx-viewer-prefs` localStorage entry every
 * binding hydrates `File > Options` from
 * (`viewer-prefs-storage.ts`/`viewer-options-store.ts`'s sparse
 * `{ options: { <group>: { <key>: value } } }` diff shape) rather than
 * driven through the dialog's UI, which keeps this spec fast and avoids
 * coupling it to that dialog's exact control markup.
 *
 * Run: bunx playwright test export-raster-tiling
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck, loadDeckAt } from './support/deck';
import {
	downloadBytes,
	downloadViaCard,
	EXPORT_DECK,
	EXPORT_DECK_SLIDE_COUNT,
	EXPORT_DOWNLOAD_TIMEOUT_MS,
	GIF_CARD,
	gifDimensions,
	isGif,
	isPdf,
	isPng,
	openBackstageExport,
	PDF_CARD,
	pdfImageXObjectCount,
	pdfPageCount,
	PNG_CARD,
	pngDimensions,
	VIDEO_CARD,
} from './support/exports';
import { byBinding } from './support/menu-report';
import { acrossFrameworks } from './support/parity';

/**
 * Seed `File > Options > Advanced > "Default resolution"` at `'ppi330'` (the
 * highest preset) before the app boots, via the same `pptx-viewer-prefs`
 * localStorage entry the Options dialog itself persists to.
 */
async function maximizeExportResolution(page: Page): Promise<void> {
	await page.addInitScript(() => {
		try {
			const raw = localStorage.getItem('pptx-viewer-prefs');
			const prefs: Record<string, unknown> = raw ? JSON.parse(raw) : {};
			const options = (prefs.options as Record<string, unknown> | undefined) ?? {};
			const advanced = (options.advanced as Record<string, unknown> | undefined) ?? {};
			prefs.options = { ...options, advanced: { ...advanced, imageDefaultResolution: 'ppi330' } };
			localStorage.setItem('pptx-viewer-prefs', JSON.stringify(prefs));
		} catch {
			// Private-browsing/quota edge case; the test's own assertions surface it.
		}
	});
}

const VIEWPORT = { width: 1600, height: 950 };
// Generous: a tiled export clones the whole stage, inlines every computed
// style, and rasterises multiple tiles sequentially, on top of the normal
// per-download budget every other export spec uses.
test.describe.configure({ timeout: 90_000 });

/** The exact shape `probeMaxCanvasDimension`'s own probe canvases take. */
const PROBE_CANDIDATES = [16384, 14188, 11180, 8192, 4096] as const;

/**
 * Force the shared canvas-size probe to settle on 2048px as the "browser"
 * cap: corrupt only the 1px-tall marker-pixel canvases the probe itself
 * creates at each larger candidate width, so every export in this page
 * session genuinely believes those sizes are unusable, without touching any
 * other canvas the app draws (charts, thumbnails, the live slide stage).
 */
async function stubLowCanvasCap(page: Page): Promise<void> {
	await page.addInitScript((candidates: readonly number[]) => {
		const nativeGetContext = HTMLCanvasElement.prototype.getContext;
		// @ts-expect-error -- overriding a built-in overload set for a test-only stub.
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			id: string,
			...rest: unknown[]
		) {
			// @ts-expect-error -- forwarding the native overload's rest args untyped.
			const ctx = nativeGetContext.call(this, id, ...rest);
			if (id === '2d' && ctx && this.height === 1 && candidates.includes(this.width)) {
				const nativeGetImageData = (ctx as CanvasRenderingContext2D).getImageData.bind(
					ctx as CanvasRenderingContext2D,
				);
				(ctx as CanvasRenderingContext2D).getImageData = (
					...args: Parameters<CanvasRenderingContext2D['getImageData']>
				) => {
					const data = nativeGetImageData(...args);
					data.data.fill(0);
					return data;
				};
			}
			return ctx;
		};
	}, PROBE_CANDIDATES);
}

/**
 * Record the pixel size of every `<canvas>` that `captureStream()` is called
 * on. Video export feeds MediaRecorder from a recording canvas
 * (`recordingCanvas.captureStream(fps)` in every binding's video driver),
 * which is the one place video's actual output resolution is observable
 * without decoding the recorded WebM container: spying here is far more
 * robust than parsing VP8/VP9 WebM/EBML bytes for `PixelWidth`/`PixelHeight`.
 */
async function spyRecordingCanvasSize(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(
			window as unknown as { __capturedCanvasSizes: { width: number; height: number }[] }
		).__capturedCanvasSizes = [];
		const native = HTMLCanvasElement.prototype.captureStream;
		HTMLCanvasElement.prototype.captureStream = function (
			this: HTMLCanvasElement,
			...args: Parameters<typeof native>
		) {
			(
				window as unknown as { __capturedCanvasSizes: { width: number; height: number }[] }
			).__capturedCanvasSizes.push({ width: this.width, height: this.height });
			return native.apply(this, args);
		};
	});
}

/** The last (and normally only) canvas size `spyRecordingCanvasSize` observed. */
async function lastCapturedCanvasSize(
	page: Page,
): Promise<{ width: number; height: number } | undefined> {
	return page.evaluate(() =>
		(
			window as unknown as { __capturedCanvasSizes: { width: number; height: number }[] }
		).__capturedCanvasSizes.at(-1),
	);
}

test.describe('PNG export tiles beyond the browser canvas cap', () => {
	test('a single binding produces a valid, correctly-sized tiled PNG', async ({ page }) => {
		await maximizeExportResolution(page);
		await stubLowCanvasCap(page);
		await loadDeck(page, EXPORT_DECK);
		await openBackstageExport(page);

		const stageBox = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
		expect(stageBox).not.toBeNull();
		const stageAspect = stageBox!.width / stageBox!.height;

		const download = await downloadViaCard(page, PNG_CARD, 60_000);
		const bytes = await downloadBytes(download);
		expect(isPng(bytes), 'payload must start with the PNG signature').toBe(true);

		const { width, height } = pngDimensions(bytes);
		// The stubbed 2048px cap forces tiling on at least one axis for this
		// deck at any realistic export scale.
		expect(
			Math.max(width, height),
			'export must exceed the stubbed 2048px cap on at least one axis (proves tiling engaged, not clamping)',
		).toBeGreaterThan(2048);
		expect(width, 'exported width must be a real, non-degenerate size').toBeGreaterThan(0);
		expect(height, 'exported height must be a real, non-degenerate size').toBeGreaterThan(0);
		expect(
			width / height,
			'the tiled+stitched PNG must preserve the slide aspect ratio',
		).toBeCloseTo(stageAspect, 1);
	});

	test('every binding tiles without error and agrees on the exported aspect ratio', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await maximizeExportResolution(page);
				await stubLowCanvasCap(page);
				await loadDeckAt(page, origin, EXPORT_DECK);
				await openBackstageExport(page);

				const stageBox = await page.locator('[aria-roledescription="slide"]').first().boundingBox();

				const download = await downloadViaCard(page, PNG_CARD, 60_000);
				const bytes = await downloadBytes(download);
				const dims = pngDimensions(bytes);

				return {
					isPng: isPng(bytes),
					tiled: Math.max(dims.width, dims.height) > 2048,
					aspect: dims.width / dims.height,
					stageAspect: stageBox ? stageBox.width / stageBox.height : 0,
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			const issues: string[] = [];
			if (!value.isPng) {
				issues.push(`${name}: export did not produce a valid PNG`);
			}
			if (!value.tiled) {
				issues.push(`${name}: export did not exceed the stubbed cap (tiling did not engage)`);
			}
			if (Math.abs(value.aspect - value.stageAspect) > 0.1) {
				issues.push(
					`${name}: exported aspect ratio ${value.aspect.toFixed(3)} does not match the on-screen stage ${value.stageAspect.toFixed(3)}`,
				);
			}
			return issues;
		});

		expect(problems.join('\n')).toBe('');
	});
});

test.describe('PDF export tiles beyond the browser canvas cap', () => {
	test('a single binding embeds several tile images per page, not one clamped image', async ({
		page,
	}) => {
		await maximizeExportResolution(page);
		await stubLowCanvasCap(page);
		await loadDeck(page, EXPORT_DECK);
		await openBackstageExport(page);

		const download = await downloadViaCard(page, PDF_CARD, 60_000);
		const bytes = await downloadBytes(download);
		expect(isPdf(bytes), 'payload must start with %PDF-').toBe(true);

		const pageCount = pdfPageCount(bytes);
		expect(pageCount, 'the PDF must have one page per slide').toBe(EXPORT_DECK_SLIDE_COUNT);
		expect(
			pdfImageXObjectCount(bytes),
			'each tiled page must embed several tile images (placeTileOnPage), not one clamped image per page',
		).toBeGreaterThan(pageCount);
	});

	test('every binding tiles PDF pages without error and agrees on page count', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await maximizeExportResolution(page);
				await stubLowCanvasCap(page);
				await loadDeckAt(page, origin, EXPORT_DECK);
				await openBackstageExport(page);

				const download = await downloadViaCard(page, PDF_CARD, 60_000);
				const bytes = await downloadBytes(download);
				const pageCount = pdfPageCount(bytes);

				return {
					isPdf: isPdf(bytes),
					pageCount,
					imagesPerPage: pageCount > 0 ? pdfImageXObjectCount(bytes) / pageCount : 0,
				};
			},
			{ viewport: VIEWPORT },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			const issues: string[] = [];
			if (!value.isPdf) {
				issues.push(`${name}: export did not produce a valid PDF`);
			}
			if (value.pageCount !== EXPORT_DECK_SLIDE_COUNT) {
				issues.push(
					`${name}: PDF has ${value.pageCount} pages, expected ${EXPORT_DECK_SLIDE_COUNT}`,
				);
			}
			if (value.imagesPerPage <= 1) {
				issues.push(
					`${name}: averages ${value.imagesPerPage.toFixed(1)} image(s) per page, expected several tile images (tiling did not engage)`,
				);
			}
			return issues;
		});

		expect(problems.join('\n')).toBe('');
	});
});

test.describe('GIF/video export do not corrupt a frame under the same stubbed cap', () => {
	test('GIF export produces a valid, correctly-proportioned animated GIF', async ({ page }) => {
		// No `maximizeExportResolution()` here (unlike PNG/PDF/video above): this
		// test is about basic pipeline validity (valid bytes, non-degenerate,
		// correct aspect ratio), not the Default Resolution option, so it runs at
		// the default (unboosted) capture scale - exactly what a real GIF export
		// most commonly uses. Every binding now downscales an oversized capture
		// to the shared `GIF_POST_CAPTURE_MAX_SIDE` (1920px, via
		// `clampGifDimensions`) before encoding, so boosting the option no longer
		// risks a pathologically slow encode the way it used to when Vue/React
		// skipped that cap; see the "Default Resolution" describe block below for
		// the boosted-resolution, cross-binding assertion.
		await stubLowCanvasCap(page);
		await loadDeck(page, EXPORT_DECK);
		await openBackstageExport(page);

		const stageBox = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
		expect(stageBox).not.toBeNull();
		const stageAspect = stageBox!.width / stageBox!.height;

		const download = await downloadViaCard(page, GIF_CARD, 60_000);
		const bytes = await downloadBytes(download);
		expect(isGif(bytes), 'payload must start with GIF87a/GIF89a').toBe(true);

		const { width, height } = gifDimensions(bytes);
		expect(width, 'exported width must be a real, non-degenerate size').toBeGreaterThan(0);
		expect(height, 'exported height must be a real, non-degenerate size').toBeGreaterThan(0);
		expect(
			width / height,
			'the (possibly tiled/stitched) frame must preserve the slide aspect ratio',
		).toBeCloseTo(stageAspect, 1);
	});

	test('video export records at the stage aspect ratio without a corrupted frame', async ({
		page,
	}) => {
		await maximizeExportResolution(page);
		await stubLowCanvasCap(page);
		await spyRecordingCanvasSize(page);
		await loadDeck(page, EXPORT_DECK);
		await openBackstageExport(page);

		const stageBox = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
		expect(stageBox).not.toBeNull();
		const stageAspect = stageBox!.width / stageBox!.height;

		const download = await downloadViaCard(page, VIDEO_CARD, 90_000);
		const bytes = await downloadBytes(download);
		expect(bytes.byteLength, 'a recorded video must not be an empty file').toBeGreaterThan(0);

		const recorded = await lastCapturedCanvasSize(page);
		expect(
			recorded,
			'video export must have called captureStream() on a recording canvas',
		).not.toBe(undefined);
		expect(recorded!.width, 'recording canvas width must be non-degenerate').toBeGreaterThan(0);
		expect(recorded!.height, 'recording canvas height must be non-degenerate').toBeGreaterThan(0);
		expect(
			recorded!.width / recorded!.height,
			'the recording canvas must preserve the slide aspect ratio (proves the tiled/stitched frame was not distorted before being drawn into it)',
		).toBeCloseTo(stageAspect, 1);
	});

	test('every binding produces a valid, aspect-correct GIF and video recording canvas', async ({
		browser,
	}, testInfo) => {
		// The file-wide 90s default (above) fits the single-binding tiling tests,
		// but this one runs a GIF capture *and* a real-time video recording for
		// all five bindings sequentially (`concurrency: 'sequential'` below): at
		// this file's own single-binding numbers (~7s GIF, ~19s video) that is
		// already ~130s in the best case, before per-binding page-load/backstage
		// overhead. Match the budget the other multi-download export specs use
		// (export-fidelity-pixel-diff.spec.ts, export-raster-fidelity.spec.ts).
		test.setTimeout(240_000);
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				// No `maximizeExportResolution()`: this test is about basic pipeline
				// validity at the default capture scale, not the Default Resolution
				// option; see the "Default Resolution" describe block below for that.
				await stubLowCanvasCap(page);
				await spyRecordingCanvasSize(page);
				await loadDeckAt(page, origin, EXPORT_DECK);
				await openBackstageExport(page);

				const stageBox = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
				const stageAspect = stageBox ? stageBox.width / stageBox.height : 0;

				const gifDownload = await downloadViaCard(page, GIF_CARD, 60_000);
				const gifBytes = await downloadBytes(gifDownload);
				const gifDims = gifDimensions(gifBytes);

				// Clicking any export card closes the whole File backstage
				// (`FileSection`'s `run()` calls `onClose()` right after invoking the
				// card's handler, same as every other binding's equivalent close-on-
				// action wiring), so the dialog from the GIF download above is gone
				// by now. Every other spec that downloads more than once in a test
				// (export-fidelity-pixel-diff.spec.ts, export-raster-fidelity.spec.ts)
				// re-opens it before each card click; do the same here.
				await openBackstageExport(page);
				const videoDownload = await downloadViaCard(page, VIDEO_CARD, 90_000);
				const videoBytes = await downloadBytes(videoDownload);
				const recordedCanvas = await lastCapturedCanvasSize(page);

				return {
					isGif: isGif(gifBytes),
					gifAspect: gifDims.width / gifDims.height,
					gifNonDegenerate: gifDims.width > 0 && gifDims.height > 0,
					videoNonEmpty: videoBytes.byteLength > 0,
					videoAspect: recordedCanvas ? recordedCanvas.width / recordedCanvas.height : 0,
					videoCanvasSeen: recordedCanvas !== undefined,
					stageAspect,
				};
			},
			// Video recording is real-time (slideDurationMs per slide) and
			// CPU/GPU-heavy on top of the GIF capture in the same scenario; five
			// pages recording at once is exactly the contention
			// `AcrossFrameworksOptions.concurrency` warns about, so run one at a
			// time like the other CPU-heavy parity specs do.
			{ viewport: VIEWPORT, concurrency: 'sequential' },
		);

		const problems = byBinding(results).flatMap(({ name, value }) => {
			const issues: string[] = [];
			if (!value.isGif) {
				issues.push(`${name}: GIF export did not produce a valid GIF`);
			}
			if (!value.gifNonDegenerate) {
				issues.push(`${name}: GIF export produced a degenerate (zero-size) frame`);
			}
			if (Math.abs(value.gifAspect - value.stageAspect) > 0.1) {
				issues.push(
					`${name}: GIF aspect ratio ${value.gifAspect.toFixed(3)} does not match the on-screen stage ${value.stageAspect.toFixed(3)}`,
				);
			}
			if (!value.videoNonEmpty) {
				issues.push(`${name}: video export produced an empty file`);
			}
			if (!value.videoCanvasSeen) {
				issues.push(`${name}: video export never called captureStream() on a recording canvas`);
			} else if (Math.abs(value.videoAspect - value.stageAspect) > 0.1) {
				issues.push(
					`${name}: video recording canvas aspect ratio ${value.videoAspect.toFixed(3)} does not match the on-screen stage ${value.stageAspect.toFixed(3)}`,
				);
			}
			return issues;
		});

		expect(problems.join('\n')).toBe('');
	});
});

test.describe('GIF export honors Default Resolution identically across bindings', () => {
	/**
	 * Capture one GIF export's frame dimensions on a freshly-loaded page,
	 * optionally boosting Default Resolution first. Two SEPARATE
	 * `acrossFrameworks` sweeps (one default, one boosted) rather than one
	 * scenario that reloads mid-session: a mid-session `page.evaluate` +
	 * second `loadDeckAt` navigation on the same page proved flaky (the
	 * second, "cold" capture after reload intermittently never fired a
	 * download at all), where two independent fresh page loads - the same
	 * shape `maximizeExportResolution` already uses successfully elsewhere in
	 * this file - did not.
	 */
	async function captureGifDims(
		page: Page,
		origin: string,
		boosted: boolean,
	): Promise<{ width: number; height: number }> {
		if (boosted) {
			await maximizeExportResolution(page);
		}
		await loadDeckAt(page, origin, EXPORT_DECK);
		await openBackstageExport(page);
		const download = await downloadViaCard(page, GIF_CARD, EXPORT_DOWNLOAD_TIMEOUT_MS);
		return gifDimensions(await downloadBytes(download));
	}

	test('boosting File > Options > Advanced > Default Resolution changes the GIF frame size the same way on all five bindings', async ({
		browser,
	}, testInfo) => {
		// Two full sweeps (default, then boosted) of one GIF capture per
		// binding; each capture gets the same generous per-download budget the
		// single-binding GIF/video tests above use for a cold page.
		test.setTimeout(240_000);
		const sweepOptions = { viewport: VIEWPORT, concurrency: 'sequential' as const };
		const defaultResults = await acrossFrameworks(
			browser,
			testInfo,
			(page, origin) => captureGifDims(page, origin, false),
			sweepOptions,
		);
		const boostedResults = await acrossFrameworks(
			browser,
			testInfo,
			(page, origin) => captureGifDims(page, origin, true),
			sweepOptions,
		);

		const defaultRows = byBinding(defaultResults);
		const boostedByName = new Map(byBinding(boostedResults).map((row) => [row.name, row.value]));

		const problems = defaultRows.flatMap(({ name, value: defaultDims }) => {
			const boostedDims = boostedByName.get(name);
			const issues: string[] = [];
			if (defaultDims.width <= 0 || defaultDims.height <= 0) {
				issues.push(`${name}: default-resolution GIF frame was degenerate (zero-size)`);
			}
			if (!boostedDims) {
				issues.push(`${name}: no boosted-resolution result was recorded`);
				return issues;
			}
			if (boostedDims.width <= 0 || boostedDims.height <= 0) {
				issues.push(`${name}: boosted-resolution GIF frame was degenerate (zero-size)`);
			}
			// The shared `resolveExportCaptureDecision` scales GIF capture with the
			// option and then downscales via the shared `GIF_POST_CAPTURE_MAX_SIDE`
			// (1920px) cap, so boosting the option must never shrink the frame by
			// more than a rounding pixel - it either grows it or (once the cap is
			// hit, which the default 2x baseline already reaches on this deck at
			// this viewport) leaves the longer side at the cap. A couple of px of
			// slack absorbs `clampGifDimensions`' proportional-rounding jitter
			// between two different pre-clamp scales that land on the same capped
			// side (measured: 1920x1080 at default, 1920x1079 at boosted on the
			// same binding).
			const SHRINK_TOLERANCE_PX = 3;
			if (
				boostedDims.width < defaultDims.width - SHRINK_TOLERANCE_PX ||
				boostedDims.height < defaultDims.height - SHRINK_TOLERANCE_PX
			) {
				issues.push(
					`${name}: boosting Default Resolution shrank the GIF frame (default ${defaultDims.width}x${defaultDims.height}, boosted ${boostedDims.width}x${boostedDims.height})`,
				);
			}
			return issues;
		});

		// Cross-binding parity: every binding computes its capture scale and cap
		// from the same shared `resolveExportCaptureDecision`, so for the same
		// deck and the same option value every binding's frame size should agree
		// (a few px of tolerance for per-binding DOM/layout rounding).
		const DIMENSION_TOLERANCE_PX = 4;
		const reference = defaultRows[0];
		const referenceBoosted = reference ? boostedByName.get(reference.name) : undefined;
		if (reference && referenceBoosted) {
			for (const { name, value: defaultDims } of defaultRows.slice(1)) {
				const boostedDims = boostedByName.get(name);
				const pairs: Array<[string, number, number]> = [
					['default width', defaultDims.width, reference.value.width],
					['default height', defaultDims.height, reference.value.height],
				];
				if (boostedDims) {
					pairs.push(
						['boosted width', boostedDims.width, referenceBoosted.width],
						['boosted height', boostedDims.height, referenceBoosted.height],
					);
				}
				for (const [label, a, b] of pairs) {
					if (Math.abs(a - b) > DIMENSION_TOLERANCE_PX) {
						problems.push(
							`${name}: ${label} ${a} disagrees with ${reference.name}'s ${b} (tolerance ${DIMENSION_TOLERANCE_PX}px)`,
						);
					}
				}
			}
		}

		expect(problems.join('\n')).toBe('');
	});
});
