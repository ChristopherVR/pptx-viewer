/**
 * Browser-side PNG pixel comparison + raster-strategy detection for the
 * export fidelity specs.
 *
 * Decoding happens IN the page (a `data:` PNG decoded through
 * `createImageBitmap`), not in Node: this repo has no PNG-decoding
 * dependency, and the browser is a PNG decoder already sitting right there.
 * Bytes cross the Playwright bridge as base64 strings (a few hundred KB),
 * never as JSON number arrays, which is what made an earlier draft of these
 * specs time out inside `page.evaluate`.
 *
 * @module e2e/support/pixel-diff
 */
import type { Page } from '@playwright/test';

/**
 * Force every export on this page to fall back to the documented
 * `html2canvas` path for the rest of the page's lifetime: the shared
 * `foreignObject` rasterizer (`rasterize-foreign-object.ts`) loads its SVG
 * document into an `Image` as a `data:image/svg+xml;charset=utf-8,` URL
 * whose payload contains an encoded `<foreignObject>`; making that exact
 * `img.src` assignment fire an `error` event reproduces the same "SVG image
 * failed to load" failure the strategy chain already falls back on, without
 * touching any other image the app loads.
 */
export async function forceHtml2CanvasFallback(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __forcedSvgImageFailures: number };
		w.__forcedSvgImageFailures = 0;
		const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
		if (!descriptor?.set || !descriptor.get) {
			throw new Error('forceHtml2CanvasFallback: HTMLImageElement.src is not an accessor');
		}
		const nativeSet = descriptor.set;
		const nativeGet = descriptor.get;
		Object.defineProperty(HTMLImageElement.prototype, 'src', {
			configurable: true,
			enumerable: descriptor.enumerable,
			get() {
				return nativeGet.call(this);
			},
			set(value: string) {
				const src = String(value);
				if (
					src.startsWith('data:image/svg+xml;charset=utf-8,') &&
					src.includes('%3CforeignObject')
				) {
					w.__forcedSvgImageFailures++;
					queueMicrotask(() => this.dispatchEvent(new Event('error')));
					return;
				}
				nativeSet.call(this, value);
			},
		});
	});
}

/** How many times `forceHtml2CanvasFallback`'s override actually fired. */
export async function countForcedFallbacks(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			(window as unknown as { __forcedSvgImageFailures?: number }).__forcedSvgImageFailures ?? -1,
	);
}

/**
 * Count real `html2canvas-pro` runs on this page. html2canvas clones the
 * document into an `<iframe class="html2canvas-container">` it appends to
 * the body for every capture (a documented, library-owned artefact no app
 * code produces), so counting those insertions proves which strategy
 * actually rasterised an export, independently of any binding's own
 * reporting. Call before navigation; read with {@link countHtml2CanvasRuns}.
 */
export async function observeHtml2CanvasRuns(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __html2canvasRuns: number };
		w.__html2canvasRuns = 0;
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				for (const node of record.addedNodes) {
					if (
						node instanceof HTMLIFrameElement &&
						node.classList.contains('html2canvas-container')
					) {
						w.__html2canvasRuns++;
					}
				}
			}
		});
		observer.observe(document, { childList: true, subtree: true });
	});
}

/** The count recorded by {@link observeHtml2CanvasRuns} (-1 if it was never armed). */
export async function countHtml2CanvasRuns(page: Page): Promise<number> {
	return page.evaluate(
		() => (window as unknown as { __html2canvasRuns?: number }).__html2canvasRuns ?? -1,
	);
}

/**
 * Collect the shared driver's own "strategy failed, falling back" console
 * warnings (`RASTER_STRATEGY_FALLBACK_WARNING` in
 * `packages/shared/src/export/rasterize-element-tiles.ts`) so a spec can
 * print WHY an export degraded, not just that it did.
 */
export function collectRasterFallbackWarnings(page: Page): string[] {
	const warnings: string[] = [];
	page.on('console', (msg) => {
		if (msg.text().includes('[pptx-viewer] raster export:')) {
			warnings.push(msg.text());
		}
	});
	return warnings;
}

/** Options for {@link injectFidelityTestStyles}. */
export interface FidelityStyleOptions {
	/**
	 * Also force an explicit `perspective(...) rotateY/rotateX` 3D transform.
	 * Default `true`; pass `false` for a fixture whose shape already carries
	 * an authentic OOXML `a:scene3d` transform that must not be overridden.
	 */
	transform3d?: boolean;
}

/**
 * Add `backdrop-filter`, a CSS-custom-property-driven fill, and (optionally)
 * an explicit 3D transform to the first element matching `selector`. These
 * simulate fidelity-sensitive CSS this repo's OOXML renderer does not yet
 * emit on its own (no `a:effectLst` currently maps to `backdrop-filter`, and
 * slide fills are resolved to literal colours rather than left as
 * `var(...)`), so the raster pipeline's handling of these CSS *features* can
 * be tested independently of whether a future OOXML mapping exists yet.
 *
 * Applied as a `<style>` stylesheet rule targeting a stable `data-` marker,
 * not an inline `style` attribute: the binding's own re-renders (opening the
 * Export backstage is enough) overwrite an element's inline `style` and
 * silently erase anything set via `el.style.setProperty(...)` before the
 * export actually runs. A stylesheet rule lives outside the framework's DOM
 * diffing entirely and survives for the rest of the page's lifetime.
 *
 * Returns the element's bounding box for scoped screenshot/export-region
 * comparisons.
 */
export async function injectFidelityTestStyles(
	page: Page,
	selector: string,
	options: FidelityStyleOptions = {},
): Promise<{ x: number; y: number; width: number; height: number }> {
	const { transform3d = true } = options;
	return page.evaluate(
		({ sel, transform3d: with3d }) => {
			const el = document.querySelector<HTMLElement>(sel);
			if (!el) {
				throw new Error(`injectFidelityTestStyles: no element matches ${sel}`);
			}
			el.setAttribute('data-pptx-e2e-fidelity-target', 'true');

			const transformRules = with3d
				? `transform: perspective(500px) rotateY(38deg) rotateX(14deg) !important;
				transform-style: preserve-3d !important;`
				: '';
			const style = document.createElement('style');
			style.textContent = `
			[data-pptx-e2e-fidelity-target="true"] {
				--pptx-e2e-fill: linear-gradient(135deg, #ff6b6b, #4dabf7) !important;
				background: var(--pptx-e2e-fill) !important;
				backdrop-filter: blur(6px) saturate(180%) !important;
				-webkit-backdrop-filter: blur(6px) saturate(180%) !important;
				${transformRules}
			}
		`;
			document.head.appendChild(style);

			const rect = el.getBoundingClientRect();
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		},
		{ sel: selector, transform3d },
	);
}

/** A crop window expressed as fractions (0-1) of the source image's full size. */
export interface FractionalCropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Result of {@link pixelDiff}. */
export interface PixelDiffStats {
	/** Mean absolute per-channel RGB delta, 0-255 scale (0 = identical). */
	meanChannelDiff: number;
	/** Fraction (0-1) of pixels where any RGB channel differs by more than `channelThreshold`. */
	diffPixelFraction: number;
}

/** Options for {@link pixelDiff}. */
export interface PixelDiffOptions {
	cropA?: FractionalCropRect;
	cropB?: FractionalCropRect;
	/** Common resample size; defaults to image A's own decoded size. */
	targetW?: number;
	targetH?: number;
	/** Per-channel delta above which a pixel counts as "different" (default 24). */
	channelThreshold?: number;
}

/**
 * Decode two PNG byte buffers in-page, optionally crop each to its own
 * fractional sub-rect, resample both to a common size (image A's decoded
 * size unless `targetW`/`targetH` are given), and return the mean absolute
 * per-channel RGB difference plus the fraction of pixels differing by more
 * than `channelThreshold` in any channel.
 */
export async function pixelDiff(
	page: Page,
	bytesA: Uint8Array,
	bytesB: Uint8Array,
	options: PixelDiffOptions = {},
): Promise<PixelDiffStats> {
	const { cropA, cropB, targetW, targetH, channelThreshold = 24 } = options;
	return page.evaluate(
		async ({ a, b, w, h, cropA: ca, cropB: cb, threshold }) => {
			async function decode(b64: string): Promise<ImageBitmap> {
				const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
				return createImageBitmap(blob);
			}
			const [bitmapA, bitmapB] = await Promise.all([decode(a), decode(b)]);
			const width = w ?? (ca ? Math.round(ca.width * bitmapA.width) : bitmapA.width);
			const height = h ?? (ca ? Math.round(ca.height * bitmapA.height) : bitmapA.height);

			function resample(
				bitmap: ImageBitmap,
				crop: { x: number; y: number; width: number; height: number } | undefined,
			): Uint8ClampedArray {
				const sx = crop ? crop.x * bitmap.width : 0;
				const sy = crop ? crop.y * bitmap.height : 0;
				const sw = crop ? crop.width * bitmap.width : bitmap.width;
				const sh = crop ? crop.height * bitmap.height : bitmap.height;
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					throw new Error('pixelDiff: 2D canvas context unavailable');
				}
				ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
				return ctx.getImageData(0, 0, width, height).data;
			}

			const pa = resample(bitmapA, ca);
			const pb = resample(bitmapB, cb);
			let total = 0;
			let differing = 0;
			const pixelCount = width * height;
			for (let i = 0; i < pa.length; i += 4) {
				const dr = Math.abs(pa[i] - pb[i]);
				const dg = Math.abs(pa[i + 1] - pb[i + 1]);
				const db = Math.abs(pa[i + 2] - pb[i + 2]);
				total += dr + dg + db;
				if (dr > threshold || dg > threshold || db > threshold) {
					differing++;
				}
			}
			return {
				meanChannelDiff: pixelCount > 0 ? total / (pixelCount * 3) : NaN,
				diffPixelFraction: pixelCount > 0 ? differing / pixelCount : NaN,
			};
		},
		{
			a: Buffer.from(bytesA).toString('base64'),
			b: Buffer.from(bytesB).toString('base64'),
			w: targetW,
			h: targetH,
			cropA,
			cropB,
			threshold: channelThreshold,
		},
	);
}

/** Convenience: just {@link PixelDiffStats.meanChannelDiff} of {@link pixelDiff}. */
export async function meanPixelDiff(
	page: Page,
	bytesA: Uint8Array,
	bytesB: Uint8Array,
	options: PixelDiffOptions = {},
): Promise<number> {
	return (await pixelDiff(page, bytesA, bytesB, options)).meanChannelDiff;
}
