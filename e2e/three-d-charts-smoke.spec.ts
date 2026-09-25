/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Smoke test for every PowerPoint 3D chart family on `<pptx-three-view>`, run
 * across every binding demo via `acrossFrameworks`.
 *
 * `three-d-parity/three-d-charts.pptx` is the ground-truth deck of the 3D
 * parity harness (`demos/demo-three-parity/README.md`): 17 slides, one
 * PowerPoint-default 3D chart each (column, bar, cylinder/cone/pyramid, line,
 * area, pie, surface). This spec walks all 17 in each binding with every chart
 * scene opted in and asserts, per slide:
 *
 * - the main slide's `<pptx-three-view>` reaches `data-state="ready"` (never
 *   `error` or `unavailable`, which would mean the scene threw or no WebGL
 *   context could be had);
 * - its canvas is not blank. The element draws every view through ONE shared
 *   WebGL renderer and copies the pixels into a plain 2D canvas in its shadow
 *   root, so that canvas can be read back with `getImageData`.
 *
 * And, for the whole walk: the page never exceeds the browser's WebGL context
 * limit. Before the shared renderer, every chart (slide and thumbnail) owned a
 * context, so a deck like this one (17 thumbnails + the slide) tripped
 * Chromium's "Too many active WebGL contexts" eviction and blanked the main
 * slide. An init script counts the WebGL contexts the page creates and listens
 * for `webglcontextlost` on each; the console is watched for the eviction
 * warning.
 *
 * Headless Chromium needs a software GL (SwiftShader) for WebGL; without one
 * the spec skips, exactly as the other 3D specs do.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('three-d-parity/three-d-charts.pptx');
const SLIDE_COUNT = 17;
/** Every chart scene the deck needs, opted in (demos turn them off under automation). */
const ALL_CHART_SCENES = '/?barChart3D=1&lineChart3D=1&areaChart3D=1&pieChart3D=1&surfaceChart3D=1';
/** Share of the chart canvas that must carry painted (non-transparent) pixels. */
const MIN_PAINTED_FRACTION = 0.02;
/** A blank or flood-filled canvas has one or two colours; a real chart has many. */
const MIN_DISTINCT_COLOURS = 8;

let webglAvailable = true;

test.beforeAll(async ({ browser }) => {
	const page = await browser.newPage();
	webglAvailable = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
	});
	await page.close();
});

/**
 * Count WebGL contexts and their losses for the lifetime of the page. The
 * shared renderer's canvas never joins the DOM, so the only reliable hook is
 * `getContext` itself.
 */
async function watchWebGLContexts(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __webglContexts: number; __webglLost: number };
		w.__webglContexts = 0;
		w.__webglLost = 0;
		const seen = new WeakSet<HTMLCanvasElement>();
		const native = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function patched(
			this: HTMLCanvasElement,
			...args: Parameters<HTMLCanvasElement['getContext']>
		) {
			const context = native.apply(this, args);
			const kind = String(args[0]);
			if (context && kind.startsWith('webgl') && !seen.has(this)) {
				seen.add(this);
				w.__webglContexts++;
				this.addEventListener('webglcontextlost', () => w.__webglLost++);
			}
			return context;
		} as typeof native;
	});
}

async function webglCounters(page: Page): Promise<{ contexts: number; lost: number }> {
	return page.evaluate(() => {
		const w = window as unknown as { __webglContexts?: number; __webglLost?: number };
		return { contexts: w.__webglContexts ?? -1, lost: w.__webglLost ?? -1 };
	});
}

/** Jump to a slide via whichever thumbnail-rail convention the binding uses. */
async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	const byIndex = page.locator(`[data-slide-index="${slideNumber - 1}"]`).first();
	const byLabel = page.getByRole('button', { name: `Go to slide ${slideNumber}` }).first();
	const target = (await byIndex.count()) > 0 ? byIndex : byLabel;
	await target.click({ timeout: 30_000 });
}

interface CanvasPaint {
	width: number;
	height: number;
	paintedFraction: number;
	distinctColours: number;
}

/** Read back the main slide view's 2D canvas (the shared renderer's copy target). */
async function sampleViewCanvas(page: Page): Promise<CanvasPaint | null> {
	return slideStage(page)
		.locator('pptx-three-view')
		.first()
		.evaluate((view) => {
			const canvas = view.shadowRoot?.querySelector('canvas');
			const context = canvas?.getContext('2d');
			if (!canvas || !context || canvas.width === 0 || canvas.height === 0) {
				return null;
			}
			const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
			let painted = 0;
			const colours = new Set<number>();
			for (let i = 0; i < data.length; i += 4) {
				if (data[i + 3] > 16) {
					painted++;
					// Quantise to 5 bits per channel so anti-aliasing noise does not count.
					colours.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
				}
			}
			return {
				width: canvas.width,
				height: canvas.height,
				paintedFraction: painted / (canvas.width * canvas.height),
				distinctColours: colours.size,
			};
		});
}

function isPainted(paint: CanvasPaint | null): boolean {
	return Boolean(
		paint &&
		paint.paintedFraction >= MIN_PAINTED_FRACTION &&
		paint.distinctColours >= MIN_DISTINCT_COLOURS,
	);
}

/**
 * `ready` means the scene mounted; the shared renderer draws on the next
 * animation frame(s), after the view has measured itself. Poll the canvas
 * until it holds a frame (or give up and report the last sample).
 */
async function paintedCanvas(page: Page): Promise<CanvasPaint | null> {
	let paint: CanvasPaint | null = null;
	const deadline = Date.now() + 15_000;
	while (Date.now() < deadline) {
		paint = await sampleViewCanvas(page);
		if (isPainted(paint)) {
			return paint;
		}
		await page.waitForTimeout(250);
	}
	return paint;
}

interface SlideOutcome {
	slide: number;
	state: string;
	paint: CanvasPaint | null;
}

interface SmokeResult {
	slides: SlideOutcome[];
	pageErrors: string[];
	contextWarnings: string[];
	contexts: number;
	lost: number;
}

async function readyState(page: Page): Promise<string> {
	const view = slideStage(page).locator('pptx-three-view').first();
	await view.waitFor({ state: 'attached', timeout: 15_000 });
	let state = '';
	await expect
		.poll(
			async () => {
				state = (await view.getAttribute('data-state')) ?? '';
				return state === 'ready' || state === 'error' || state === 'unavailable';
			},
			{ timeout: 20_000 },
		)
		.toBe(true)
		.catch(() => undefined);
	return state;
}

test.describe('3D charts smoke: every PowerPoint 3D chart family on <pptx-three-view>', () => {
	test('all 17 charts reach ready, paint, and share one WebGL context', async ({
		browser,
	}, testInfo) => {
		test.setTimeout(900_000);
		test.skip(!webglAvailable, 'headless Chromium has no WebGL context in this environment');

		const results = await acrossFrameworks(
			browser,
			testInfo,
			async (page, origin): Promise<SmokeResult> => {
				const pageErrors: string[] = [];
				const contextWarnings: string[] = [];
				page.on('pageerror', (err) => pageErrors.push(String(err)));
				page.on('console', (message) => {
					if (/too many active webgl contexts/iu.test(message.text())) {
						contextWarnings.push(message.text());
					}
				});
				await watchWebGLContexts(page);

				await loadDeckAt(page, origin, DECK);
				await slideStage(page).waitFor();

				const slides: SlideOutcome[] = [];
				for (let slide = 1; slide <= SLIDE_COUNT; slide++) {
					if (slide > 1) {
						await gotoSlide(page, slide);
					}
					const state = await readyState(page);
					const paint = state === 'ready' ? await paintedCanvas(page) : null;
					slides.push({ slide, state, paint });
				}
				const { contexts, lost } = await webglCounters(page);
				return { slides, pageErrors, contextWarnings, contexts, lost };
			},
			{ path: ALL_CHART_SCENES, concurrency: 'sequential' },
		);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			for (const { slide, state, paint } of value.slides) {
				if (state !== 'ready') {
					problems.push(`slide ${slide}: view state "${state || '(none)'}", expected "ready"`);
				} else if (!isPainted(paint)) {
					problems.push(`slide ${slide}: the chart canvas is blank (${JSON.stringify(paint)})`);
				}
			}
			if (value.contextWarnings.length > 0) {
				problems.push(`WebGL context eviction: ${value.contextWarnings[0]}`);
			}
			if (value.lost !== 0) {
				problems.push(`${value.lost} webglcontextlost event(s)`);
			}
			// One shared renderer; allow a couple of capability probes on top.
			if (value.contexts < 1 || value.contexts > 3) {
				problems.push(`${value.contexts} WebGL contexts created, expected one shared context`);
			}
			if (value.pageErrors.length > 0) {
				problems.push(`page errors: ${value.pageErrors.join('; ')}`);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
