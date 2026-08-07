/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Issue #144: what a morph INTO a detail slide is allowed to do.
 *
 * The reporter jumped from the wheel slide (slide 3) into its "Secure Data
 * Movement" detail slide (slide 12) by clicking the deck's own orange button,
 * and annotated three things PowerPoint does not do:
 *
 *  1. **"Mystery box"** - an empty grey rectangle flew in from off-stage and
 *     landed on the header chip. The chip is named `!!Breakdgsdfgdfsg` and the
 *     wheel slide parks a 100x74 rect named `!!D` off-canvas at (-177, -118);
 *     the proximity pass paired the two, because nothing stopped a weak signal
 *     from overruling two DIFFERENT explicit `!!` names.
 *  2. **"Drifting text"** - the wheel's centre panel glided across the slide
 *     into the top-right callout box. Both are groups, and a group carries no
 *     text of its own, so the "same place, different words" veto that exists
 *     precisely to stop this saw two wordless objects.
 *  3. **"Doesn't fade in"** - the arriving callouts did not dissolve in at all;
 *     they appeared in a single frame once the transition ended. Their opacity
 *     WAS being animated - the transition overlay was simply painting the
 *     outgoing slide's unchanged, opaque background picture on top of them for
 *     the whole morph.
 *
 * 1 and 2 are one assertion in the end: an element that exists only on the
 * arriving slide must dissolve in WHERE IT LIVES, never travel. 3 is about
 * pixels, so it is measured in pixels.
 *
 * The morph is frozen and scrubbed rather than sampled in real time: the show
 * runs it in 1s (the deck asks for `spd="slow"`), which is far too tight to
 * screenshot reliably.
 *
 * Run: bunx playwright test issue-144-morph
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const deck = resolve(fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)));

/** The 5 MB deck embeds a video; give the parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/** Wheel slide carrying the "Explore solution" button, and its destination. */
const WHEEL_SLIDE = 3;

/** Core element ids. Addressing shapes by id is the one thing every binding agrees on. */
const EXPLORE_BUTTON = 'ppt/slides/slide3.xml-shape-26';

/**
 * The running show's own stage. Every binding stamps it, and scoping to it is
 * not optional: the editor canvas and the slide rail are still mounted behind
 * the show and carry the SAME element ids at their own scale, so an unscoped
 * query reads a thumbnail's geometry and clicks the wrong pixel.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

/**
 * Everything that exists only on slide 12. None of them has a counterpart on
 * the wheel slide, so PowerPoint dissolves each one in where it sits.
 */
const ARRIVALS = {
	headerChip: 'ppt/slides/slide12.xml-shape-1',
	satellite: 'ppt/slides/slide12.xml-pic-1',
	topCallout: 'ppt/slides/slide12.xml-group-0',
	bottomCallout: 'ppt/slides/slide12.xml-group-1',
} as const;

/** How far an arriving element may be from its settled box, in CSS pixels. */
const TRAVEL_TOLERANCE_PX = 2;

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

async function startShowOnWheelSlide(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
	await page.locator(`[aria-label="Go to slide ${WHEEL_SLIDE}"]`).first().click();
	await page.waitForTimeout(900);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(2000);
}

/**
 * Click the deck's orange "Explore solution" button and hold the resulting
 * morph open, paused, so it can be scrubbed frame by frame.
 *
 * The overlay tears itself down on a single long timer, so that timer is
 * neutralised for the duration of the test; the animations themselves are CSS
 * and keep their own clock, which is what `scrubTo` drives.
 */
async function clickExploreAndFreezeMorph(page: Page): Promise<void> {
	await page.evaluate(() => {
		const real = window.setTimeout.bind(window);
		(window as unknown as { __realSetTimeout: typeof window.setTimeout }).__realSetTimeout = real;
		(window as unknown as { setTimeout: unknown }).setTimeout = (
			handler: TimerHandler,
			timeout?: number,
			...args: unknown[]
		) => (typeof timeout === 'number' && timeout >= 900 ? 0 : real(handler, timeout, ...args));
	});

	// Address the button by its core element id and click its centre for real:
	// an accessible-name query resolves to a different node in each binding, and
	// a synthetic MouseEvent misses the handler in the two that navigate from a
	// pointer event.
	const spot = await page.evaluate(
		([stage, id]) => {
			const node = document.querySelector(`${stage} [data-element-id="${id}"]`);
			if (!node) {
				return null;
			}
			const rect = node.getBoundingClientRect();
			return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
		},
		[SHOW_STAGE, EXPLORE_BUTTON] as const,
	);
	expect(spot, 'the Explore solution button must be on screen').not.toBeNull();
	await page.mouse.click(spot!.x, spot!.y);

	// The jump has to have happened, or every assertion below is vacuous: a
	// missed click leaves the wheel slide up and finds no slide-12 element.
	await page
		.locator(`${SHOW_STAGE} [data-element-id="${ARRIVALS.bottomCallout}"]`)
		.first()
		.waitFor({ timeout: 5_000 });
	await page.evaluate(() => {
		for (const animation of document.getAnimations()) {
			animation.pause();
		}
	});
}

/** Put every running animation at the same fraction of its own duration. */
async function scrubTo(page: Page, fraction: number): Promise<void> {
	await page.evaluate((f) => {
		for (const animation of document.getAnimations()) {
			const duration = animation.effect?.getTiming().duration;
			animation.currentTime = typeof duration === 'number' ? duration * f : 0;
		}
	}, fraction);
	await page.waitForTimeout(120);
}

/**
 * Every copy of an element the running show is painting.
 *
 * A morph can have two: the live stage's, and the transition overlay's own
 * layer (three of the five bindings stack whole slide layers rather than
 * individual ghosts). Both are on screen, so both have to be in the right
 * place; reading only the first would let the animated copy off.
 */
async function rectsOf(page: Page, elementId: string): Promise<Rect[]> {
	return page.evaluate(
		([stage, id]) =>
			[...document.querySelectorAll(`${stage} [data-element-id="${id}"]`)]
				.map((node) => node.getBoundingClientRect())
				.filter((r) => r.width > 0 && r.height > 0)
				.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
		[SHOW_STAGE, elementId] as const,
	);
}

test.describe('issue #144 - morphing into a detail slide', () => {
	test('an arriving shape dissolves in place instead of flying in', async ({ page }) => {
		await startShowOnWheelSlide(page);
		await clickExploreAndFreezeMorph(page);

		await scrubTo(page, 1);
		const settled: Record<string, Rect> = {};
		for (const [name, id] of Object.entries(ARRIVALS)) {
			const rects = await rectsOf(page, id);
			expect(rects.length, `${name} must be painted once the morph has landed`).toBeGreaterThan(0);
			settled[name] = rects[0];
		}

		// Sampled across the whole morph, not just the middle: the mystery box
		// entered from (-217, -118) and was still short of its mark at 80%. The
		// last sample re-reads the landed frame, which is where a binding that
		// paints two copies has to show them agreeing.
		for (const fraction of [0.1, 0.4, 0.8, 1]) {
			await scrubTo(page, fraction);
			for (const [name, id] of Object.entries(ARRIVALS)) {
				for (const rect of await rectsOf(page, id)) {
					expect(
						Math.abs(rect.x - settled[name].x),
						`${name} moved horizontally at ${fraction * 100}% of the morph`,
					).toBeLessThanOrEqual(TRAVEL_TOLERANCE_PX);
					expect(
						Math.abs(rect.y - settled[name].y),
						`${name} moved vertically at ${fraction * 100}% of the morph`,
					).toBeLessThanOrEqual(TRAVEL_TOLERANCE_PX);
					expect(
						Math.abs(rect.width - settled[name].width),
						`${name} was resized at ${fraction * 100}% of the morph`,
					).toBeLessThanOrEqual(TRAVEL_TOLERANCE_PX);
				}
			}
		}
	});

	test('the arriving callout is on screen before the morph ends', async ({ page }) => {
		await startShowOnWheelSlide(page);
		await clickExploreAndFreezeMorph(page);

		await scrubTo(page, 1);
		const [box] = await rectsOf(page, ARRIVALS.bottomCallout);
		expect(box, 'the arriving callout must settle on screen').toBeDefined();
		const clip = {
			x: Math.round(box.x),
			y: Math.round(box.y),
			width: Math.round(box.width),
			height: Math.round(box.height),
		};

		// 30%: the wheel has dissolved out and nothing has arrived yet - the
		// callout's patch of slide is bare background.
		await scrubTo(page, 0.3);
		const bare = await page.screenshot({ clip });
		// 85%: PowerPoint has the callout nearly fully dissolved in by here.
		await scrubTo(page, 0.85);
		const arriving = await page.screenshot({ clip });
		await scrubTo(page, 1);
		const settled = await page.screenshot({ clip });

		const scratch = await page.context().newPage();
		const [bareToArriving, arrivingToSettled, bareToSettled] = [
			await meanDiff(scratch, bare, arriving),
			await meanDiff(scratch, arriving, settled),
			await meanDiff(scratch, bare, settled),
		];
		await scratch.close();

		// The overlay used to paint the outgoing slide's own background picture
		// over this patch for the whole morph, so 30% and 85% were the same
		// frame and the callout appeared only once the overlay came down.
		expect(
			bareToArriving,
			'the callout must already be painting at 85% of the morph',
		).toBeGreaterThan(bareToSettled * 0.5);
		expect(arrivingToSettled, 'the callout must be nearly settled at 85%').toBeLessThan(
			bareToSettled * 0.5,
		);
	});
});

/**
 * Mean absolute RGB difference between two PNG buffers of the same size.
 * Playwright ships no image decoder and this repo has no image dependency, so a
 * scratch page's canvas is the decoder.
 */
async function meanDiff(scratch: Page, a: Buffer, b: Buffer): Promise<number> {
	return scratch.evaluate(
		async ([left, right]) => {
			const load = (base64: string): Promise<HTMLImageElement> =>
				new Promise((res, rej) => {
					const img = new Image();
					img.onload = () => {
						res(img);
					};
					img.onerror = rej;
					img.src = `data:image/png;base64,${base64}`;
				});
			const [imgA, imgB] = await Promise.all([load(left), load(right)]);
			const w = 160;
			const h = 80;
			const read = (img: HTMLImageElement): Uint8ClampedArray => {
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const context = canvas.getContext('2d', { willReadFrequently: true })!;
				context.drawImage(img, 0, 0, w, h);
				return context.getImageData(0, 0, w, h).data;
			};
			const pixelsA = read(imgA);
			const pixelsB = read(imgB);
			let sum = 0;
			for (let p = 0; p < pixelsA.length; p += 4) {
				sum +=
					Math.abs(pixelsA[p] - pixelsB[p]) +
					Math.abs(pixelsA[p + 1] - pixelsB[p + 1]) +
					Math.abs(pixelsA[p + 2] - pixelsB[p + 2]);
			}
			return sum / (w * h);
		},
		[a.toString('base64'), b.toString('base64')] as const,
	);
}
