/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The slide-show transition has to be VISIBLE, on the whole display.
 *
 * Every other transition assertion in this suite is structural: it counts
 * `document.getAnimations()`, looks for `@keyframes` text, or checks that an
 * overlay node exists. All of those passed while the Vue show was visibly
 * broken on a 1920x1080 screen, because the animation really was running, on a
 * layer that CSS had cropped to the deck's NATIVE 1280x720 box in the top-left
 * corner. The outer third of the screen simply cut to the next slide, and the
 * transition read to a human as "nothing happens / it just flickers".
 *
 * So this spec looks at pixels, and only at pixels that the old bug could not
 * reach: a band to the RIGHT of the deck's native width. It proves the band
 * paints an INTERMEDIATE state, i.e. a frame that matches neither the outgoing
 * slide nor the settled incoming one. A plain cut cannot produce that, no
 * matter how many animations are running somewhere else in the document.
 *
 * Run: bunx playwright test present-transition-pixels
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

/** Real deck: 1280x720, slides 3-14 each carry a `p159:morph` transition. */
const deck = resolve(fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)));

/**
 * Small synthetic deck whose slide 2 carries a classic (`p:fade`) transition.
 *
 * The layer-geometry test uses this one because morph is the one transition the
 * bindings render through different DOM: React drops the stacked-layer markup
 * and paints per-shape ghosts instead, so only a classic transition exercises
 * the two-layer contract everywhere.
 */
const classicDeck = resolve(
	fileURLToPath(new URL('./fixtures/transitions-animations.pptx', import.meta.url)),
);

/** The deck's own slide size. Everything right of this used to be dead space. */
const NATIVE_WIDTH = 1280;

/** A 1280x720 deck on this display is scaled 1.5x, so the show fills it exactly. */
const VIEWPORT = { width: 1920, height: 1080 };

/**
 * Sampling band: entirely OUTSIDE the deck's native-size top-left corner, and
 * clear of the bottom-centre slide counter / toolbar.
 */
const BAND = { x: NATIVE_WIDTH + 20, y: 60, width: 560, height: 900 };

/** The 5 MB deck embeds a video; give the parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

test.use({ viewport: VIEWPORT });

async function startShowOnSlide(
	page: Page,
	slideNumber: number,
	file = deck,
	slideCount = 14,
): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(file);
	await page
		.locator(`[aria-label="Go to slide ${slideCount}"]`)
		.first()
		.waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(900);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	// Fullscreen + the opening build settle before the first sample.
	await page.waitForTimeout(2000);
}

/**
 * Mean absolute RGB difference (0-255 per channel, summed over R+G+B) between
 * two PNG buffers of the same size, computed by decoding both onto a canvas in
 * a scratch page. Playwright ships no image decoder and this repo has no image
 * dependency, so the browser is the decoder.
 */
async function meanDiff(scratch: Page, a: Buffer, b: Buffer): Promise<number> {
	return scratch.evaluate(
		async ([left, right]) => {
			const load = (base64: string): Promise<HTMLImageElement> =>
				new Promise((res, rej) => {
					const img = new Image();
					img.onload = () => res(img);
					img.onerror = rej;
					img.src = `data:image/png;base64,${base64}`;
				});
			const [imgA, imgB] = await Promise.all([load(left), load(right)]);
			const w = 200;
			const h = 320;
			const read = (img: HTMLImageElement): Uint8ClampedArray => {
				const cv = document.createElement('canvas');
				cv.width = w;
				cv.height = h;
				const g = cv.getContext('2d', { willReadFrequently: true })!;
				g.drawImage(img, 0, 0, w, h);
				return g.getImageData(0, 0, w, h).data;
			};
			const pa = read(imgA);
			const pb = read(imgB);
			let sum = 0;
			for (let p = 0; p < pa.length; p += 4) {
				sum +=
					Math.abs(pa[p] - pb[p]) +
					Math.abs(pa[p + 1] - pb[p + 1]) +
					Math.abs(pa[p + 2] - pb[p + 2]);
			}
			return sum / (pa.length / 4);
		},
		[a.toString('base64'), b.toString('base64')] as const,
	);
}

/**
 * Mean absolute deviation of the band's pixels from the band's own mean colour:
 * a cheap "is anything actually drawn here" score.
 *
 * The second Vue defect this spec guards was invisible to a change-based
 * metric. The morph's departing-shape layer painted the OUTGOING slide's opaque
 * background over the whole stage for the full transition, so the display was a
 * flat slab that then cut to the next slide. Pixels changed the whole time; a
 * human just saw the deck vanish. Slide imagery scores >100 here, the slab
 * scored 16.6.
 */
async function contentSpread(scratch: Page, png: Buffer): Promise<number> {
	return scratch.evaluate(async (base64) => {
		const img = await new Promise<HTMLImageElement>((res, rej) => {
			const el = new Image();
			el.onload = () => res(el);
			el.onerror = rej;
			el.src = `data:image/png;base64,${base64}`;
		});
		const w = 200;
		const h = 320;
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		const g = cv.getContext('2d', { willReadFrequently: true })!;
		g.drawImage(img, 0, 0, w, h);
		const d = g.getImageData(0, 0, w, h).data;
		const n = d.length / 4;
		let mr = 0;
		let mg = 0;
		let mb = 0;
		for (let p = 0; p < d.length; p += 4) {
			mr += d[p];
			mg += d[p + 1];
			mb += d[p + 2];
		}
		mr /= n;
		mg /= n;
		mb /= n;
		let dev = 0;
		for (let p = 0; p < d.length; p += 4) {
			dev += Math.abs(d[p] - mr) + Math.abs(d[p + 1] - mg) + Math.abs(d[p + 2] - mb);
		}
		return dev / n;
	}, png.toString('base64'));
}

test('a slide transition animates across the whole display, not just the deck-sized corner', async ({
	page,
	context,
}) => {
	await startShowOnSlide(page, 3);

	// `animations: 'allow'` is essential: Playwright's default freezes CSS
	// animations for screenshots, which would make every sample identical and
	// turn this spec into the very false green it exists to replace.
	const shot = (): Promise<Buffer> => page.screenshot({ clip: BAND, animations: 'allow' });

	const before = await shot();
	await page.keyboard.press('ArrowRight');
	const burst: Buffer[] = [];
	for (let i = 0; i < 8; i++) {
		burst.push(await shot());
	}
	await page.waitForTimeout(2000);
	const after = await shot();

	const scratch = await context.newPage();
	await scratch.goto('about:blank');

	// The slide really did change out here (guards against a swallowed Next).
	const changed = await meanDiff(scratch, before, after);
	expect(changed).toBeGreaterThan(6);

	// ...and at least one sampled frame is neither the old slide nor the new one,
	// which is only possible if a transitional state was painted in this band.
	const scores: { toBefore: number; toAfter: number; spread: number }[] = [];
	for (const frame of burst) {
		scores.push({
			toBefore: await meanDiff(scratch, before, frame),
			toAfter: await meanDiff(scratch, after, frame),
			spread: await contentSpread(scratch, frame),
		});
	}
	await scratch.close();

	// oxlint-disable-next-line no-console -- the numbers are the point of this spec
	console.log('outer-band before/after/spread:', JSON.stringify(scores));

	const intermediate = scores.filter((s) => s.toBefore > 2 && s.toAfter > 2);
	expect(
		intermediate.length,
		`no intermediate frame right of x=${NATIVE_WIDTH}: the transition is cropped to the deck's native size`,
	).toBeGreaterThan(0);

	// Both slides in this morph are full-bleed photography, so every frame of a
	// correct cross-dissolve is rich. A flat slab (the departing layer painting
	// its own opaque slide background over everything) scores ~17.
	const flattest = Math.min(...scores.map((s) => s.spread));
	expect(
		flattest,
		`the show blanked to a near-flat fill mid-transition (spread ${flattest.toFixed(1)}): ` +
			'the transition layer is covering the slide instead of blending with it',
	).toBeGreaterThan(30);
});

test('the transition layers cover the whole slide stage', async ({ page }) => {
	await startShowOnSlide(page, 1, classicDeck, 4);

	// Record the biggest transition-layer box seen while the change plays. The
	// layers are mounted only for the duration of the transition.
	await page.evaluate(() => {
		const store: { layer: number[][]; stage: number[] | null } = { layer: [], stage: null };
		(window as unknown as { __pptxLayerProbe: typeof store }).__pptxLayerProbe = store;
		const started = performance.now();
		const sample = (): void => {
			for (const node of document.querySelectorAll('[data-pptx-transition-layer]')) {
				const r = node.getBoundingClientRect();
				store.layer.push([Math.round(r.width), Math.round(r.height)]);
			}
			const stages = [...document.querySelectorAll('[aria-roledescription="slide"]')]
				.map((n) => n.getBoundingClientRect())
				.sort((a, b) => b.width * b.height - a.width * a.height)[0];
			if (stages && (!store.stage || stages.width > store.stage[0])) {
				store.stage = [Math.round(stages.width), Math.round(stages.height)];
			}
			if (performance.now() - started < 2500) {
				requestAnimationFrame(sample);
			}
		};
		requestAnimationFrame(sample);
	});
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(2800);

	const probe = await page.evaluate(
		() =>
			(window as unknown as { __pptxLayerProbe: { layer: number[][]; stage: number[] | null } })
				.__pptxLayerProbe,
	);

	expect(probe.stage, 'no slide stage found in the running show').not.toBeNull();
	const [stageW, stageH] = probe.stage!;
	expect(probe.layer.length, 'no transition layer was ever mounted').toBeGreaterThan(0);

	const widest = Math.max(...probe.layer.map((l) => l[0]));
	const tallest = Math.max(...probe.layer.map((l) => l[1]));
	// A layer that shrink-wraps the deck's UNSCALED stage measures 1280x720 while
	// the stage paints 1920x1080; with `overflow: hidden` that is a hard crop.
	expect(widest, `transition layer ${widest}px wide vs a ${stageW}px stage`).toBeGreaterThanOrEqual(
		stageW - 2,
	);
	expect(
		tallest,
		`transition layer ${tallest}px tall vs a ${stageH}px stage`,
	).toBeGreaterThanOrEqual(stageH - 2);
});
