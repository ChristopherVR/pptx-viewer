/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A 3D chart must appear in a PNG export, through BOTH raster paths, in every
 * binding (`acrossFrameworks`).
 *
 * `<pptx-three-view>` draws into a 2D canvas inside its shadow root. Neither
 * raster path can read that directly: the `foreignObject` path serialises a
 * `cloneNode(true)` copy (no shadow root), and html2canvas-pro re-creates the
 * element in its own iframe. Both run the shared
 * `snapshotThreeViewsIntoClone`, which swaps each view for an `<img>` of its
 * pixels plus a copy of its DOM overlay (the html2canvas path through the
 * shared `prepareHtml2CanvasClone` every binding's `renderToCanvas` calls).
 *
 * The check is sharper than "not blank": the slotted 2D fallback chart would
 * not be blank either. The live view's own canvas is read back, and every
 * pixel where it painted a 3D mark (opaque) is compared against the same
 * spot in the exported PNG, cropped to the view's rectangle on the slide. A
 * 2D fallback (flat columns, no top/side faces) or an empty box fails that;
 * the 3D snapshot passes it.
 *
 * The html2canvas path is forced exactly as `export-raster-fidelity.spec.ts`
 * does it (`forceHtml2CanvasFallback` fails every foreignObject image load),
 * and html2canvas's own iframe is counted to prove it really ran.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import {
	downloadBytes,
	downloadViaCard,
	isPng,
	openBackstageExport,
	PNG_CARD,
} from './support/exports';
import { acrossFrameworks } from './support/parity';
import {
	countHtml2CanvasRuns,
	forceHtml2CanvasFallback,
	observeHtml2CanvasRuns,
} from './support/pixel-diff';

test.use({ viewport: { width: 1440, height: 900 } });

/** Slide 1: PowerPoint's default 3-D Clustered Column. */
const DECK = fixture('three-d-parity/three-d-charts.pptx');
const ALL_CHART_SCENES = '/?barChart3D=1&lineChart3D=1&areaChart3D=1&pieChart3D=1&surfaceChart3D=1';
/** Per-channel tolerance for "the export shows this mark pixel" (resampling blurs edges). */
const CHANNEL_TOLERANCE = 40;
/** Share of the live view's opaque mark pixels the export must reproduce. */
const MIN_MARK_MATCH = 0.6;

let webglAvailable = true;

test.beforeAll(async ({ browser }) => {
	const page = await browser.newPage();
	webglAvailable = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	});
	await page.close();
});

interface LiveView {
	/** The view's rectangle as fractions of the slide stage's box. */
	crop: { x: number; y: number; width: number; height: number };
	/** The live view's canvas as a PNG data URL. */
	pixels: string;
}

async function readLiveView(page: Page): Promise<LiveView> {
	const view = slideStage(page).locator('pptx-three-view').first();
	await expect(view).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
	// One more frame so the shared renderer has copied into the view.
	await page.waitForTimeout(300);
	const stageBox = await slideStage(page).boundingBox();
	const viewBox = await view.boundingBox();
	if (!stageBox || !viewBox) {
		throw new Error('the slide or its 3D view has no layout box');
	}
	const pixels = await view.evaluate(
		(el) => el.shadowRoot?.querySelector('canvas')?.toDataURL('image/png') ?? '',
	);
	return {
		crop: {
			x: (viewBox.x - stageBox.x) / stageBox.width,
			y: (viewBox.y - stageBox.y) / stageBox.height,
			width: viewBox.width / stageBox.width,
			height: viewBox.height / stageBox.height,
		},
		pixels,
	};
}

interface MarkMatch {
	markPixels: number;
	matched: number;
}

/** Compare the live view's opaque pixels with the same region of the exported PNG. */
async function matchMarks(page: Page, live: LiveView, exported: Uint8Array): Promise<MarkMatch> {
	return page.evaluate(
		async ({ viewUrl, exportB64, crop, tolerance }) => {
			const load = async (url: string): Promise<ImageBitmap> =>
				createImageBitmap(await (await fetch(url)).blob());
			const [viewBitmap, exportBitmap] = await Promise.all([
				load(viewUrl),
				load(`data:image/png;base64,${exportB64}`),
			]);
			const width = viewBitmap.width;
			const height = viewBitmap.height;
			const read = (draw: (ctx: CanvasRenderingContext2D) => void): Uint8ClampedArray => {
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					throw new Error('2D canvas context unavailable');
				}
				draw(ctx);
				return ctx.getImageData(0, 0, width, height).data;
			};
			const view = read((ctx) => ctx.drawImage(viewBitmap, 0, 0));
			const shot = read((ctx) =>
				ctx.drawImage(
					exportBitmap,
					crop.x * exportBitmap.width,
					crop.y * exportBitmap.height,
					crop.width * exportBitmap.width,
					crop.height * exportBitmap.height,
					0,
					0,
					width,
					height,
				),
			);
			let markPixels = 0;
			let matched = 0;
			for (let i = 0; i < view.length; i += 4) {
				if (view[i + 3] < 250) {
					continue;
				}
				markPixels++;
				if (
					Math.abs(view[i] - shot[i]) <= tolerance &&
					Math.abs(view[i + 1] - shot[i + 1]) <= tolerance &&
					Math.abs(view[i + 2] - shot[i + 2]) <= tolerance
				) {
					matched++;
				}
			}
			return { markPixels, matched };
		},
		{
			viewUrl: live.pixels,
			exportB64: Buffer.from(exported).toString('base64'),
			crop: live.crop,
			tolerance: CHANNEL_TOLERANCE,
		},
	);
}

interface ExportOutcome {
	isPng: boolean;
	html2canvasRuns: number;
	marks: MarkMatch;
}

async function exportChartSlide(page: Page, origin: string): Promise<ExportOutcome> {
	await observeHtml2CanvasRuns(page);
	await loadDeckAt(page, origin, DECK);
	const live = await readLiveView(page);
	await openBackstageExport(page);
	const bytes = await downloadBytes(await downloadViaCard(page, PNG_CARD));
	return {
		isPng: isPng(bytes),
		html2canvasRuns: await countHtml2CanvasRuns(page),
		marks: await matchMarks(page, live, bytes),
	};
}

function describeProblems(outcome: ExportOutcome, path: string): string[] {
	const problems: string[] = [];
	if (!outcome.isPng) {
		problems.push(`${path}: the download is not a PNG`);
	}
	const { markPixels, matched } = outcome.marks;
	if (markPixels === 0) {
		problems.push(`${path}: the live 3D view painted nothing to compare against`);
	} else if (matched / markPixels < MIN_MARK_MATCH) {
		problems.push(
			`${path}: only ${matched}/${markPixels} of the 3D chart's mark pixels appear in the export`,
		);
	}
	return problems;
}

test.describe('3D chart in a PNG export', () => {
	test.describe.configure({ timeout: 600_000 });

	test('the foreignObject path exports the 3D view, not its 2D fallback', async ({
		browser,
	}, testInfo) => {
		test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
		const results = await acrossFrameworks(browser, testInfo, exportChartSlide, {
			path: ALL_CHART_SCENES,
			concurrency: 'sequential',
		});
		const failures = results.flatMap(({ framework, value }) => {
			const problems = describeProblems(value, 'foreignObject');
			if (value.html2canvasRuns !== 0) {
				problems.push('the default export fell back to html2canvas');
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});
		expect(failures.join('\n')).toBe('');
	});

	test('the html2canvas path exports the 3D view, not its 2D fallback', async ({
		browser,
	}, testInfo) => {
		test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');
		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin) => {
				await forceHtml2CanvasFallback(page);
				return exportChartSlide(page, origin);
			},
			{ path: ALL_CHART_SCENES, concurrency: 'sequential' },
		);
		const failures = results.flatMap(({ framework, value }) => {
			const problems = describeProblems(value, 'html2canvas');
			if (value.html2canvasRuns < 1) {
				problems.push('html2canvas never ran, so this did not test its path');
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});
		expect(failures.join('\n')).toBe('');
	});
});
