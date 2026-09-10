/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does PNG export actually tile once the export resolution exceeds the
 * browser's canvas cap, instead of clamping or silently truncating?
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
	openBackstageExport,
	PNG_CARD,
	pngDimensions,
	isPng,
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
