/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Issue #146: a shape arriving INSIDE a shape that persists has to be seen.
 *
 * From the wheel slide the reporter clicked the "Multi-Domain Fusion" wedge,
 * which jumps to that challenge's slide. Both slides draw the same centre disc
 * (`!!Content`, unchanged), and the arriving slide fills it with a title, two
 * paragraphs and an orange button. PowerPoint dissolves those in over the disc;
 * pptx-viewer showed an empty disc for the whole morph and snapped the wording
 * in once the transition ended - annotated "No Fade" in the reporter's video.
 *
 * Nothing was wrong with the dissolve itself: the transition overlay paints the
 * outgoing slide ABOVE the live stage, the unchanged disc was one of the ghosts
 * it painted, and the disc is opaque. The arriving text was fading in
 * underneath it, invisible.
 *
 * So this is measured in pixels, not in opacity: an element can carry a perfect
 * fade-in animation and still be painted by nobody.
 *
 * The morph is frozen and scrubbed rather than sampled in real time - the show
 * runs it in 1s, far too tight to screenshot reliably.
 *
 * Run: bunx playwright test issue-146-morph-fade
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const deck = resolve(fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)));

/** The 5 MB deck embeds a video; give the parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/** The "Select Challenge" hub, and the wedge that jumps off it. */
const HUB_SLIDE = 2;

/**
 * The top-right wedge, which carries a slide-jump hyperlink to slide 4. Element
 * ids are the one address every binding agrees on.
 */
const FUSION_WEDGE = 'ppt/slides/slide2.xml-shape-7';

/**
 * The running show's own stage. Scoping to it is not optional: the editor
 * canvas and the slide rail stay mounted behind the show and carry the SAME
 * element ids at their own scale, so an unscoped query reads a thumbnail.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

/** The arriving centre content, all of it inside the unchanged disc. */
const ARRIVALS = {
	title: 'ppt/slides/slide4.xml-group-0-shape-2',
	body: 'ppt/slides/slide4.xml-group-0-shape-3',
	button: 'ppt/slides/slide4.xml-group-0-shape-1',
} as const;

interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

async function startShowOnHubSlide(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
	await page.locator(`[aria-label="Go to slide ${HUB_SLIDE}"]`).first().click();
	await page.waitForTimeout(900);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(2000);
}

/**
 * Click the wedge and hold the resulting morph open, paused, so it can be
 * scrubbed frame by frame. The overlay tears itself down on a single long
 * timer, so that timer is neutralised; the animations are CSS and keep their
 * own clock, which is what `scrubTo` drives.
 *
 * The freeze is a global `animation-play-state: paused`, injected BEFORE the
 * click. Pausing from script afterwards is a race nothing can win: the morph
 * runs for 1s and a single round trip to ask whether it has started can cost
 * more than that, leaving every sample on the settled frame and the whole test
 * vacuously green. A stylesheet applies the instant the animation is created.
 */
async function clickWedgeAndFreezeMorph(page: Page): Promise<void> {
	await page.evaluate(() => {
		const real = window.setTimeout.bind(window);
		(window as unknown as { setTimeout: unknown }).setTimeout = (
			handler: TimerHandler,
			timeout?: number,
			...args: unknown[]
		) => (typeof timeout === 'number' && timeout >= 900 ? 0 : real(handler, timeout, ...args));
		const style = document.createElement('style');
		style.textContent = '*, *::before, *::after { animation-play-state: paused !important; }';
		document.head.appendChild(style);
	});

	// Click the wedge's own pixels near its outer edge: its centre is over the
	// disc, and a synthetic MouseEvent misses the handler in the two bindings
	// that navigate from a pointer event.
	const spot = await page.evaluate(
		([stage, id]) => {
			const node = document.querySelector(`${stage} [data-element-id="${id}"]`);
			if (!node) {
				return null;
			}
			const rect = node.getBoundingClientRect();
			return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 4 };
		},
		[SHOW_STAGE, FUSION_WEDGE] as const,
	);
	expect(spot, 'the Multi-Domain Fusion wedge must be on screen').not.toBeNull();
	await page.mouse.click(spot!.x, spot!.y);

	// The jump AND the transition have to have happened, or every assertion
	// below is vacuous: a run where the morph never started reads the settled
	// slide at every sample and passes nothing while failing nothing.
	await page.locator('[data-pptx-transition-overlay]').first().waitFor({ timeout: 5_000 });
	await page
		.locator(`${SHOW_STAGE} [data-element-id="${ARRIVALS.title}"]`)
		.first()
		.waitFor({ timeout: 5_000 });
	const morphAnimations = await page.evaluate(
		() =>
			document
				.getAnimations()
				.filter((animation) =>
					(animation as { animationName?: string }).animationName?.startsWith('pptx-morph'),
				).length,
	);
	expect(morphAnimations, 'a morph must be playing and frozen').toBeGreaterThan(0);
}

/**
 * Put every running animation at the same fraction of its own duration, and
 * wait for the frame that paints it. A fixed sleep is not enough under a loaded
 * machine, and a sample taken before the repaint reads the PREVIOUS fraction.
 */
async function scrubTo(page: Page, fraction: number): Promise<void> {
	await page.evaluate(async (f) => {
		for (const animation of document.getAnimations()) {
			const duration = animation.effect?.getTiming().duration;
			animation.currentTime = typeof duration === 'number' ? duration * f : 0;
		}
		await new Promise<void>((painted) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					painted();
				});
			});
		});
	}, fraction);
	await page.waitForTimeout(150);
}

/** The largest painted box for an element id anywhere on the show stage. */
async function rectOf(page: Page, elementId: string): Promise<Rect | undefined> {
	const rects = await page.evaluate(
		([stage, id]) =>
			[...document.querySelectorAll(`${stage} [data-element-id="${id}"]`)]
				.map((node) => node.getBoundingClientRect())
				.filter((r) => r.width > 0 && r.height > 0)
				.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
		[SHOW_STAGE, elementId] as const,
	);
	return rects.sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

test.describe('issue #146 - a morph must not hide what is arriving', () => {
	for (const [name, elementId] of Object.entries(ARRIVALS)) {
		test(`the arriving ${name} is painting before the morph ends`, async ({ page }) => {
			await startShowOnHubSlide(page);
			await clickWedgeAndFreezeMorph(page);

			await scrubTo(page, 1);
			const box = await rectOf(page, elementId);
			expect(box, `the arriving ${name} must settle on screen`).toBeDefined();
			const clip = {
				x: Math.round(box!.x),
				y: Math.round(box!.y),
				width: Math.round(box!.width),
				height: Math.round(box!.height),
			};

			// 20%: the old wording has dissolved and nothing has arrived - this
			// patch of the disc is bare.
			await scrubTo(page, 0.2);
			const bare = await page.screenshot({ clip });
			// 90%: PowerPoint has the arriving content all but fully dissolved in.
			await scrubTo(page, 0.9);
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

			// The unchanged centre disc was painted in the overlay, opaque, over
			// this whole patch, so 20% and 90% used to be the same frame and the
			// wording appeared only once the overlay came down.
			expect(
				bareToArriving,
				`the ${name} must already be painting at 90% of the morph`,
			).toBeGreaterThan(bareToSettled * 0.5);
			expect(arrivingToSettled, `the ${name} must be nearly settled at 90%`).toBeLessThan(
				bareToSettled * 0.5,
			);
		});
	}
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
			const h = 40;
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
