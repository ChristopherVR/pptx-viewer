/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Issue #148: a morph between two slides that differ only in a picture's SCALE.
 *
 * PowerPoint's Format Picture > Size panel shows "Scale Height" and "Scale
 * Width" 113% for the backdrop photo on slide 3 and 101% for the same photo on
 * slide 12, and morphing between them is a slow zoom. There is no scale
 * attribute in OOXML: the frame is byte-identical on both slides
 * (`0,1 12192000x6858000`) and the scale lives entirely in `<a:srcRect>`, which
 * crops 5.739% off each side on slide 3 and 0.356% on slide 12.
 *
 * Because every other axis the morph engine compares - position, size,
 * rotation, blip, fill, text - agreed exactly, the pair read as INERT: neither
 * half was animated and neither was painted in the overlay, so the picture cut
 * from one crop to the other in a single frame. The reporter described it as
 * the viewer having "no concept of Scale" and treating one scaled picture as
 * "two unrelated identically sized images".
 *
 * The crop is rendered by transforming the `<img>` INSIDE the element's frame,
 * so that is the node this measures: `scaleX` of its computed transform must
 * travel continuously from the outgoing crop's magnification to the incoming
 * one's, not jump between them.
 *
 * Frozen and scrubbed for the same reason as issue #144's spec: the deck asks
 * for `spd="slow"` and the show plays it in 1s.
 *
 * Run: bunx playwright test issue-148-morph-scale
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

/** Core element ids: the one addressing scheme all five bindings agree on. */
const EXPLORE_BUTTON = 'ppt/slides/slide3.xml-shape-26';
/** The arriving slide's backdrop photo - the same blip as the wheel slide's. */
const ARRIVING_BACKDROP = 'ppt/slides/slide12.xml-pic-0';
/** A shape that only exists on slide 12, used to confirm the jump happened. */
const ARRIVING_CALLOUT = 'ppt/slides/slide12.xml-group-1';

/**
 * The running show's own stage. The editor canvas and the slide rail stay
 * mounted behind a show and carry the SAME element ids, so scoping is not
 * optional.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

/**
 * The transition overlay, which sits ABOVE that stage while a morph plays.
 *
 * Which of the two paints the arriving slide is a real architectural
 * difference, not a detail: React and Angular animate the live stage and put
 * only the departing ghosts in the overlay, while Vue, Svelte and Vanilla stack
 * a whole incoming slide layer inside the overlay and leave the stage's copy
 * static underneath it (covered, and never seen). So the arriving picture has
 * to be read from the overlay when there is one there, and from the stage
 * otherwise - reading the stage unconditionally measures a deliberately
 * unanimated copy on three of the five bindings.
 */
const TRANSITION_OVERLAY = '[data-pptx-transition-overlay]';

/**
 * Magnification of the source at each end of the morph.
 *
 * 1 / (1 - 0.05739 - 0.05739) = 1.1297 on the wheel slide, and
 * 1 / (1 - 0.00356 - 0.00356) = 1.0072 on the detail slide - the 113% and 101%
 * PowerPoint reports.
 */
const OUTGOING_SCALE = 1.1297;
const INCOMING_SCALE = 1.0072;
/**
 * How far past an endpoint a mid-morph sample has to be to count as "moving".
 *
 * Deliberately tiny: morph eases on `cubic-bezier(0.4, 0, 0.2, 1)`, which is
 * ~93% of the way home by three quarters through (1.0122 of a 1.1297 -> 1.0072
 * travel), so a generous band would fail on correct output. What this has to
 * separate is a real tween from the defect, where every sample read the
 * incoming crop exactly.
 */
const SCALE_EPSILON = 0.001;
/** Slack for the two copies a stacked-layer binding paints of the same picture. */
const SCALE_TOLERANCE = 0.006;

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
 * morph open, paused, so it can be scrubbed frame by frame. The overlay tears
 * itself down on one long timer, which is neutralised for the test; the CSS
 * animations keep their own clock, which `scrubTo` drives.
 */
async function clickExploreAndFreezeMorph(page: Page): Promise<void> {
	await page.evaluate(() => {
		const real = window.setTimeout.bind(window);
		(window as unknown as { setTimeout: unknown }).setTimeout = (
			handler: TimerHandler,
			timeout?: number,
			...args: unknown[]
		) => (typeof timeout === 'number' && timeout >= 900 ? 0 : real(handler, timeout, ...args));
	});

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

	// The jump has to have happened, or every assertion below is vacuous.
	await page
		.locator(`${SHOW_STAGE} [data-element-id="${ARRIVING_CALLOUT}"]`)
		.first()
		.waitFor({ timeout: 5_000 });
	await page.evaluate(() => {
		for (const animation of document.getAnimations()) {
			animation.pause();
		}
	});
}

/**
 * Put every animation at the same fraction of its own duration, and hold it
 * there.
 *
 * The pause is repeated on every scrub rather than done once after the click,
 * because a binding can attach an animation a frame or two AFTER the arriving
 * slide is in the DOM. One that appeared late was never paused, so setting its
 * `currentTime` only nudged an animation that was still playing, and the very
 * next measurement read it wherever real time had carried it - a flake that
 * failed the 0% sample on whichever binding happened to be slowest that run.
 */
async function scrubTo(page: Page, fraction: number): Promise<void> {
	await page.evaluate((f) => {
		for (const animation of document.getAnimations()) {
			animation.pause();
			const duration = animation.effect?.getTiming().duration;
			animation.currentTime = typeof duration === 'number' ? duration * f : 0;
		}
	}, fraction);
	await page.waitForTimeout(120);
}

/**
 * Horizontal scale of the `<img>` of every VISIBLE copy of a picture.
 *
 * The overlay wins when it holds a copy of this element (see
 * {@link TRANSITION_OVERLAY}); otherwise the live stage's copy is the one on
 * screen. Anything the binding paints in the chosen layer is measured, so a
 * binding that somehow painted two disagreeing copies in it would be caught.
 */
async function imageScalesOf(page: Page, elementId: string): Promise<number[]> {
	return page.evaluate(
		([stage, overlay, id]) => {
			const scaleOf = (node: Element): number => {
				const transform = getComputedStyle(node).transform;
				if (!transform || transform === 'none') {
					return 1;
				}
				const values = /matrix\(([^)]+)\)/u.exec(transform)?.[1].split(',');
				return values ? Number.parseFloat(values[0]) : 1;
			};
			const painted = (scope: string): Element[] =>
				[...document.querySelectorAll(`${scope} [data-element-id="${id}"] img`)].filter(
					(node) => node.getBoundingClientRect().width > 0,
				);
			const inOverlay = painted(overlay);
			return (inOverlay.length > 0 ? inOverlay : painted(stage)).map(scaleOf);
		},
		[SHOW_STAGE, TRANSITION_OVERLAY, elementId] as const,
	);
}

test.describe('issue #148 - morphing a picture scale', () => {
	test('the backdrop zooms between the two crops instead of cutting', async ({ page }) => {
		await startShowOnWheelSlide(page);
		await clickExploreAndFreezeMorph(page);

		const samples: number[][] = [];
		for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
			await scrubTo(page, fraction);
			const scales = await imageScalesOf(page, ARRIVING_BACKDROP);
			expect(
				scales.length,
				`the arriving backdrop must be painted at ${fraction * 100}% of the morph`,
			).toBeGreaterThan(0);
			samples.push(scales);
		}

		const [start, quarter, half, threeQuarters, end] = samples.map((scales) => scales[0]);

		// The ends are the two crops PowerPoint reports as 113% and 101%.
		expect(start, 'the morph must start on the outgoing slide crop').toBeCloseTo(OUTGOING_SCALE, 2);
		expect(end, 'the morph must land on the incoming slide crop').toBeCloseTo(INCOMING_SCALE, 2);

		// ...and it has to actually travel between them. Before this fix the
		// picture sat at the incoming crop from frame 1 and every sample here read
		// the same number.
		for (const [name, value] of [
			['25%', quarter],
			['50%', half],
			['75%', threeQuarters],
		] as const) {
			expect(value, `the backdrop must still be zooming at ${name}`).toBeGreaterThan(
				INCOMING_SCALE + SCALE_EPSILON,
			);
			expect(value, `the backdrop must be past its start at ${name}`).toBeLessThan(
				OUTGOING_SCALE - SCALE_EPSILON,
			);
		}
		expect(quarter, 'the zoom must be monotonic').toBeGreaterThan(half);
		expect(half, 'the zoom must be monotonic').toBeGreaterThan(threeQuarters);

		// Every copy the visible layer paints has to agree, or one of them zooms
		// while another sits still and the seam shows.
		for (const scales of samples) {
			for (const scale of scales) {
				expect(Math.abs(scale - scales[0])).toBeLessThanOrEqual(SCALE_TOLERANCE);
			}
		}
	});

	test('the settled slide keeps its authored crop once the morph ends', async ({ page }) => {
		await startShowOnWheelSlide(page);
		await clickExploreAndFreezeMorph(page);

		// The animation holds its final frame (`forwards`) until the binding tears
		// the plan down, at which point the element reverts to its static style.
		// Those two have to be the same picture, or it snaps at the very end.
		await scrubTo(page, 1);
		const animated = await imageScalesOf(page, ARRIVING_BACKDROP);
		await page.evaluate(() => {
			for (const animation of document.getAnimations()) {
				animation.cancel();
			}
		});
		await page.waitForTimeout(200);
		const settled = await imageScalesOf(page, ARRIVING_BACKDROP);

		expect(animated.length).toBeGreaterThan(0);
		expect(settled.length).toBeGreaterThan(0);
		expect(settled[0], 'the final frame must equal the element static crop').toBeCloseTo(
			animated[0],
			2,
		);
		expect(settled[0]).toBeCloseTo(INCOMING_SCALE, 2);
	});
});
