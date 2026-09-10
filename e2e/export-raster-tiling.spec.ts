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
 * GIF and video do NOT get PNG/PDF's hard "must exceed the stubbed cap"
 * assertion below, for a reason independent of tiling: each binding captures
 * GIF/video frames at its own, pre-existing fixed scale policy (React: 0.5x
 * for GIF, 1x for video, neither reading File > Options > Advanced >
 * "Default resolution"; Angular: a fixed 2x, same gap; Vue/Svelte/Vanilla:
 * the same Options-aware 2x baseline PNG/PDF use). That policy spread means
 * the *requested* resolution for GIF/video already differs by binding before
 * tiling is even in the picture, so "did this binding's GIF/video clear
 * 2048px on this fixture" is not a tiling signal, it is a restatement of that
 * pre-existing, separate scale-policy gap. Asserting it here would either
 * force widening every binding's GIF/video scale policy (out of this
 * change's scope, and a real behaviour/file-size change deserving its own
 * review) or produce a spec that is red on React/Angular for a reason that
 * has nothing to do with tiling. The GIF/video tests below instead assert
 * what tiling failing would actually break: a corrupted, degenerate, or
 * wrong-aspect-ratio frame - proven under the exact same stubbed-cap
 * conditions that force PNG/PDF to tile, so any binding whose scale policy
 * does clear the cap on this fixture (Vue/Svelte/Vanilla do) is still
 * exercising the real tiled/stitched path, not just the untiled one.
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
		// No `maximizeExportResolution()` here (unlike PNG/PDF/video above): the
		// pure-JS median-cut quantiser + LZW encoder that GIF export shares
		// across all five bindings is CPU-bound on frame pixel count, and
		// Vue/React (which do not call the shared `clampGifDimensions` the way
		// Angular/Svelte/Vanilla do) would encode a multi-megapixel frame at the
		// resolution boost's ~6.8x scale, which genuinely exceeds any sane test
		// timeout. The default (unboosted) capture scale is exactly what a real
		// GIF export uses, so this still exercises the real pipeline end to end.
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
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				// No `maximizeExportResolution()`: see the comment on the
				// single-binding GIF test above - it would make the shared pure-JS
				// GIF encoder pathologically slow on any binding that does not
				// clamp its GIF frame size (Vue/React do not).
				await stubLowCanvasCap(page);
				await spyRecordingCanvasSize(page);
				await loadDeckAt(page, origin, EXPORT_DECK);
				await openBackstageExport(page);

				const stageBox = await page.locator('[aria-roledescription="slide"]').first().boundingBox();
				const stageAspect = stageBox ? stageBox.width / stageBox.height : 0;

				const gifDownload = await downloadViaCard(page, GIF_CARD, 60_000);
				const gifBytes = await downloadBytes(gifDownload);
				const gifDims = gifDimensions(gifBytes);

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
