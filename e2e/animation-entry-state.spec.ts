/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Slide-entry animation STATE coverage against a real PowerPoint deck
 * (`issue-132-hr-deck.pptx`, the 29-slide deck from issue #132), run
 * identically against every framework demo.
 *
 * Pins the three regressions that deck exposed:
 *
 *  1. NO END-STATE FLASH: entering a slide during the show must seed its
 *     entrance-animated elements HIDDEN synchronously with the slide swap.
 *     React used to defer the seed until the slide transition finished and
 *     Angular deferred it by a requestAnimationFrame, so every animated
 *     element painted at its FINAL state for the whole transition (or a
 *     frame), then visibly snapped back to replay.
 *
 *  2. WIPE DIRECTION + GEOMETRY: a `wipe(up)` entrance (presetSubtype 1) must
 *     reveal from the BOTTOM edge, and the reveal must be a CSS `mask` sweep
 *     that COMPOSES with the element's own geometry `clip-path`. The old
 *     `clip-path` keyframes both mapped the subtype to the opposite edge and
 *     replaced the geometry clip, so a thin diagonal stripe wiped in as its
 *     full bounding box (a filled rectangle "blob").
 *
 *  3. FLY-IN DIRECTION: presetSubtype 8 = fly in from the LEFT
 *     (origin-edge bitmask), pinned via the assigned keyframe name.
 *
 * Every assertion reads the rendered DOM through the framework-neutral
 * contract (`#file-input`, `[data-element-id]`, role=button), so the same spec
 * runs against all five bindings.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const deck = resolve(fileURLToPath(new URL('./fixtures/issue-132-hr-deck.pptx', import.meta.url)));

/** The deck's slide transitions run 800ms (`p14:dur="800"`); the flash poll
 * must give its verdict BEFORE the transition ends, because the old bug seeded
 * the hidden states only when the transition finished: a longer poll would let
 * the late seed masquerade as a pass. */
const FLASH_POLL_TIMEOUT_MS = 600;

/** Load the deck into the demo and wait for the first slide to paint. */
async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page
		.locator('[data-pptx-element="true"], [data-element-id]')
		.first()
		.waitFor({ state: 'attached' });
	await page.waitForTimeout(800);
}

/** Start the slide show from the demo's Present control. */
async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1200);
}

/** Jump to a 1-based slide number via the shared "type digits + Enter" keymap. */
async function goToSlide(page: Page, slideNumber: number): Promise<void> {
	for (const digit of String(slideNumber)) {
		await page.keyboard.press(digit);
	}
	await page.keyboard.press('Enter');
}

/**
 * Count the incoming slide's elements that are demonstrably NOT at their final
 * state, i.e. entrance-seeded. Two shapes of "seeded" are equally correct and
 * the bindings legitimately differ:
 *
 *  - `visibility: hidden`, for an element whose entrance group has not started
 *    (React holds playback until the slide transition finishes), or
 *  - an attached CSS animation with a backwards-filling `both` / `backwards`
 *    fill mode, which pins the element at its FROM state through the effect's
 *    delay (Vue / Svelte / Angular / Vanilla start the slide's auto-play group
 *    with the slide swap).
 *
 * The regression looks like NEITHER: the element painted plain-visible with no
 * animation at all, which is the deck's final state, and only afterwards
 * snapped back to replay.
 */
async function seededElementCount(page: Page, slideFile: string): Promise<number> {
	return page.evaluate((file) => {
		const stage = document.querySelector('[data-pptx-presenting]') ?? document;
		let seeded = 0;
		for (const el of stage.querySelectorAll<HTMLElement>(`[data-element-id^="${file}"]`)) {
			if (getComputedStyle(el).visibility === 'hidden') {
				seeded++;
				continue;
			}
			const animation = el.style.animation;
			if (animation && (animation.includes('both') || animation.includes('backwards'))) {
				seeded++;
			}
		}
		return seeded;
	}, slideFile);
}

test.describe('slide-entry animation state (issue #132 deck)', () => {
	test('entrance-animated elements are hidden from the first paint of a slide (no end-state flash)', async ({
		page,
	}) => {
		await loadDeck(page);
		await startShow(page);

		// Advance into slide 2: a 800ms fade transition, a parallelogram with a
		// wipe entrance and a letter-by-letter text build.
		await page.keyboard.press('ArrowRight');

		// The seed must be observable essentially immediately: well INSIDE the
		// transition window, the incoming slide's wipe-entrance parallelogram is
		// already held off its final state. Before the fix nothing was seeded
		// until the transition finished (React) or until the next animation
		// frame (Angular), so this poll (shorter than the transition) fails on
		// regression.
		await expect
			.poll(() => seededElementCount(page, 'ppt/slides/slide2.xml'), {
				timeout: FLASH_POLL_TIMEOUT_MS,
			})
			.toBeGreaterThan(0);
	});

	test('a wipe(up) entrance sweeps a mask from the bottom and keeps the shape geometry clip', async ({
		page,
	}) => {
		await loadDeck(page);
		await startShow(page);

		// Slide 29's diagonal stripes are parallelograms (geometry clip-path)
		// entering with wipe presetSubtype 1 = wipe(up) on slide entry.
		await goToSlide(page, 29);

		interface StripeProbe {
			mask: string;
			clip: string;
			animation: string;
		}
		const probeStripe = (): Promise<StripeProbe | undefined> =>
			page.evaluate(() => {
				for (const el of document.querySelectorAll<HTMLElement>(
					'[data-element-id^="ppt/slides/slide29.xml"]',
				)) {
					const cs = getComputedStyle(el);
					if (el.style.animation && cs.maskImage !== 'none') {
						return { mask: cs.maskImage, clip: cs.clipPath, animation: el.style.animation };
					}
				}
				return undefined;
			});

		await expect.poll(probeStripe, { timeout: 10000 }).toBeDefined();
		const stripe = (await probeStripe())!;

		// Direction: wipe(up) = reveal grows from the BOTTOM edge, which the
		// mask encodes as a to-top hard-stop gradient.
		expect(stripe.mask).toContain('linear-gradient(to top');
		// The blob regression: the reveal must never replace the element's own
		// geometry clip-path. Mid-animation the parallelogram outline is still
		// clipping (a path/polygon, not 'none'), while the mask does the reveal.
		expect(stripe.clip).not.toBe('none');
	});

	test('fly-in presetSubtype 8 enters from the left', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);

		// Slide 8's four ellipse text boxes fly in with presetSubtype 8 (left).
		await goToSlide(page, 8);
		await page.waitForTimeout(600);
		await page.keyboard.press('ArrowRight');

		const flyProbe = (): Promise<string | undefined> =>
			page.evaluate(() => {
				for (const el of document.querySelectorAll<HTMLElement>(
					'[data-element-id^="ppt/slides/slide8.xml"]',
				)) {
					if (el.style.animation.includes('pptx-flyIn')) {
						return el.style.animation;
					}
				}
				return undefined;
			});

		// One advance is enough on this slide to start its fly-in group; a second
		// covers a binding that needed the first press to finish the transition.
		let animation = await flyProbe();
		if (!animation) {
			await page.keyboard.press('ArrowRight');
			await expect.poll(flyProbe, { timeout: 8000 }).toBeDefined();
			animation = await flyProbe();
		}
		expect(animation).toContain('pptx-flyInLeft');
	});
});
