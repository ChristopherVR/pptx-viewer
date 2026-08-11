/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A morph pair that changes its PRESET has to keep travelling.
 *
 * Such a pair is driven by two animations at once: the pair's own `transform`
 * journey (`generateMorphAnimations`) and a baked `clip-path` tween of the
 * resolved outline (`generateGeometryMorphAnimation`). Both are keyed on the
 * incoming element's id, and `buildMorphTransitionPlan` used to fold every
 * animation into its maps with a plain `set` - so the tween, generated second,
 * silently replaced the journey. The arriving shape then sat at its final
 * position for the whole transition, re-cutting its own outline where it stood,
 * while its ghost flew the path alone: a shape that should glide across the
 * slide instead appeared at the far end on frame 1.
 *
 * The two animate DISJOINT properties, so the fix is to compose them into the
 * shorthand's comma-separated list rather than have one win. This measures the
 * consequence rather than the CSS: where the arriving shape is actually painted
 * at each point of the morph.
 *
 * `solution-explorer.pptx` cannot cover this - it holds the same freeform on
 * both topic slides, so no pair there ever asks for a geometry morph - hence
 * the purpose-built two-slide fixture.
 *
 * Frozen and scrubbed rather than sampled in real time, for the reason every
 * other morph spec here is: 1s is far too tight to screenshot reliably.
 *
 * Run: bunx playwright test morph-shape-swap
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const deck = resolve(fileURLToPath(new URL('./fixtures/morph-shape-swap.pptx', import.meta.url)));

/** The morphing shape, added first on both slides so it is `-shape-0`. */
const OUTGOING_SHAPE = 'ppt/slides/slide1.xml-shape-0';
const INCOMING_SHAPE = 'ppt/slides/slide2.xml-shape-0';

/**
 * The running show's own stage. The editor canvas and the slide rail stay
 * mounted behind a show and carry the SAME element ids, so scoping is not
 * optional.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

/**
 * The transition overlay, which sits ABOVE that stage while a morph plays.
 *
 * Which layer paints the ARRIVING slide is a real architectural difference:
 * React and Angular animate the live stage and put only the departing ghosts
 * here, while Vue, Svelte and Vanilla stack a whole incoming slide layer inside
 * the overlay and leave the stage's copy static underneath it. Reading the
 * stage unconditionally would measure a deliberately unanimated copy on three
 * of the five bindings (see `issue-148-morph-scale.spec.ts`).
 */
const TRANSITION_OVERLAY = '[data-pptx-transition-overlay]';

/**
 * How far from either end of the journey a mid-morph sample has to sit, as a
 * fraction of the total travel.
 *
 * Deliberately tiny. Morph eases on `cubic-bezier(0.4, 0, 0.2, 1)`, which is
 * 95.9% of the way home by three quarters through, so a generous band fails on
 * correct output. What this has to separate is a real glide from the defect,
 * where every sample read the destination EXACTLY; the easing's precise shape
 * is issue #131's business, not this spec's.
 */
const TRAVEL_EPSILON = 0.02;

async function startShowOnFirstSlide(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator(`[data-element-id="${OUTGOING_SHAPE}"]`).first().waitFor();
	await page.waitForTimeout(600);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1500);
	await page.mouse.move(4, 4);
}

/**
 * Advance into the morph and hold it open, paused, so it can be scrubbed.
 *
 * The freeze is a global `animation-play-state: paused` injected BEFORE the
 * navigation: pausing from script afterwards is a race nothing can win, and
 * every sample would land on the settled frame, passing vacuously. The
 * overlay's teardown timer is neutralised separately.
 */
async function advanceAndFreezeMorph(page: Page): Promise<void> {
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

	await page.keyboard.press('ArrowRight');
	await page.locator(TRANSITION_OVERLAY).first().waitFor({ timeout: 5_000 });

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

/** Put every running animation at the same fraction of its own duration. */
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
	await page.waitForTimeout(120);
}

/**
 * Where the arriving shape is painted right now, in viewport pixels.
 *
 * The overlay wins when it holds a copy (see {@link TRANSITION_OVERLAY});
 * otherwise the live stage's copy is the one on screen.
 */
async function paintedCentreX(page: Page, elementId: string): Promise<number | null> {
	return page.evaluate(
		([stage, overlay, id]) => {
			const painted = (scope: string): Element[] =>
				[...document.querySelectorAll(`${scope} [data-element-id="${id}"]`)].filter(
					(node) => node.getBoundingClientRect().width > 0,
				);
			const inOverlay = painted(overlay);
			const node = (inOverlay.length > 0 ? inOverlay : painted(stage))[0];
			if (!node) {
				return null;
			}
			const rect = node.getBoundingClientRect();
			return rect.x + rect.width / 2;
		},
		[SHOW_STAGE, TRANSITION_OVERLAY, elementId] as const,
	);
}

test.describe('morphing a shape that changes preset', () => {
	test('the arriving shape glides instead of appearing at its destination', async ({ page }) => {
		await startShowOnFirstSlide(page);

		// Where the two ends of the journey are ON THIS VIEWPORT, so the assertions
		// below need no knowledge of the stage's scale.
		const startX = await paintedCentreX(page, OUTGOING_SHAPE);
		expect(startX, 'the outgoing shape must be on screen before the morph').not.toBeNull();

		await advanceAndFreezeMorph(page);

		await scrubTo(page, 1);
		const endX = await paintedCentreX(page, INCOMING_SHAPE);
		expect(endX, 'the arriving shape must be painted at the end of the morph').not.toBeNull();
		const travel = endX! - startX!;
		expect(Math.abs(travel), 'the fixture must move the shape at all').toBeGreaterThan(50);

		// The regression: with the tween overwriting the journey, every one of
		// these read `endX` exactly.
		const covered: number[] = [];
		for (const fraction of [0.25, 0.5, 0.75]) {
			await scrubTo(page, fraction);
			const x = await paintedCentreX(page, INCOMING_SHAPE);
			expect(x, `the arriving shape must be painted at ${fraction * 100}%`).not.toBeNull();
			const fractionCovered = (x! - startX!) / travel;
			expect(
				fractionCovered,
				`the arriving shape must still be short of its destination at ${fraction * 100}%`,
			).toBeLessThan(1 - TRAVEL_EPSILON);
			expect(
				fractionCovered,
				`the arriving shape must be past its start at ${fraction * 100}%`,
			).toBeGreaterThan(TRAVEL_EPSILON);
			covered.push(fractionCovered);
		}

		// ...and it has to be one journey, not three unrelated positions.
		expect(covered[1], 'the glide must be monotonic').toBeGreaterThan(covered[0]);
		expect(covered[2], 'the glide must be monotonic').toBeGreaterThan(covered[1]);
	});

	test('the outline is tweened as well as the journey', async ({ page }) => {
		// The other half of the composition: dropping the tween instead of the
		// journey would leave the shape gliding while cutting straight to the
		// hexagon, which the test above cannot see.
		await startShowOnFirstSlide(page);
		await advanceAndFreezeMorph(page);
		await scrubTo(page, 0.5);

		const clip = await page.evaluate(
			([stage, overlay, id]) => {
				const painted = (scope: string): Element[] =>
					[...document.querySelectorAll(`${scope} [data-element-id="${id}"]`)].filter(
						(node) => node.getBoundingClientRect().width > 0,
					);
				const inOverlay = painted(overlay);
				const node = (inOverlay.length > 0 ? inOverlay : painted(stage))[0];
				if (!node) {
					return null;
				}
				// The clip may sit on the element or on the geometry node inside it.
				for (const candidate of [node, ...node.querySelectorAll('*')]) {
					const value = getComputedStyle(candidate).clipPath;
					if (value && value !== 'none' && value.includes('path(')) {
						return value;
					}
				}
				return null;
			},
			[SHOW_STAGE, TRANSITION_OVERLAY, INCOMING_SHAPE] as const,
		);

		expect(clip, 'the arriving shape must be clipped to a tweened outline').not.toBeNull();
	});
});
