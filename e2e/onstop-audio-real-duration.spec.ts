/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Closes "`onStopAudio` in headless export" (docs/guide/limitations.md): when
 * a follow-on effect is chained after an audio clip with NO real `<audio>`
 * element having fired a genuine `ended` event to correct it (headless
 * export, SSR, or - as here - simply before the browser's own audio element
 * has actually finished playing), does the fallback timer use the clip's
 * REAL duration instead of PowerPoint's stale authored estimate?
 *
 * `media-trigger-tgtel.pptx` is a REAL PowerPoint-COM-authored fixture (see
 * its `fixture-corpus-manifest.ts` entry): "After Previous" audio chaining
 * writes a bare `<p:cond delay="2000"/>` on the follow-on click-group, copied
 * verbatim from a separate "play the media" effect node's own duration
 * estimate - never an explicit `onStopAudio` dependency (see
 * `native-animation-media-duration-plain-delay.ts`'s module doc for the full
 * ground truth). `media-trigger-mismatched.pptx`
 * (`generate-media-trigger-mismatched-fixture.ts`, generated in this spec's
 * own `beforeAll`) swaps the embedded clip for a synthetic one whose REAL
 * duration is 5000ms while the authored estimate still says 2000ms -
 * simulating a clip trimmed/swapped after the deck was exported.
 *
 * `native-animation-media-duration.ts` decodes the real duration at PARSE
 * time and patches it onto the click-group's `parGroupDelayMs`. A binding
 * bakes that value into the follow-on shape's `animation-delay` the MOMENT
 * the click-group plays (`animation-timeline-builder`'s `cssAnimation`
 * shorthand, `<keyframe> <duration>ms <easing> <delay>ms ...` - see
 * `animation-media-end-gating.ts`'s `DELAY_TOKEN_INDEX` doc comment), not via
 * a later `setTimeout` before the style is set: the CSS engine itself honours
 * `animation-delay`. So this spec reads that baked-in delay token IMMEDIATELY
 * after the triggering click - no multi-second wait needed - and asserts it
 * is the REAL 5000ms, not the stale 2000ms.
 *
 * Run: bunx playwright test onstop-audio-real-duration
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	generateMediaTriggerMismatchedFixture,
	MISMATCHED_REAL_DURATION_MS,
	STALE_AUTHORED_DURATION_MS,
} from './fixtures/generate-media-trigger-mismatched-fixture';
import { fixture, resetTabSession } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeAll(async () => {
	await generateMediaTriggerMismatchedFixture();
});

const DECK = fixture('media-trigger-mismatched.pptx');
/** `p:cNvPr id="2"` ("Rectangle 1"), the shape whose entrance effect is gated on the audio's estimated duration. */
const ENTRANCE_SHAPE_ID = 'ppt/slides/slide1.xml-shape-0';

/** Enter presentation mode through the demo's Present control. */
async function enterPresentation(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.click();
}

/**
 * Read the entrance shape's computed `animation-delay` in milliseconds (via
 * `getComputedStyle`, NOT by parsing `el.style.animation`'s shorthand
 * positionally: the browser re-serializes that shorthand in its own
 * canonical token order - duration, easing, delay, iteration-count,
 * direction, fill-mode, play-state, name - which differs from
 * `animation-timeline-builder`'s AUTHORING order documented in
 * `animation-media-end-gating.ts`'s `DELAY_TOKEN_INDEX`; the dedicated
 * longhand property has no such ambiguity). Returns `undefined` if no
 * animation is attached yet.
 */
async function readAnimationDelayMs(page: Page): Promise<number | undefined> {
	// NOT scoped to `[data-pptx-viewport]`: presentation mode's full-screen
	// slide-show stage does not use that wrapper (only the editor canvas
	// does), so scoping to it here would match nothing in every binding.
	//
	// Some bindings keep the editor canvas copy of this element mounted
	// underneath the presentation-mode overlay, so an unfiltered
	// `[data-element-id="..."]` can match TWO elements with the same id - the
	// stale editor one (no animation attached) alongside the real
	// presentation-stage one. `:visible` alone does not reliably tell them
	// apart (in Angular BOTH report as CSS-visible: the editor copy is merely
	// layered behind the overlay, not hidden), so pick whichever of the
	// matches actually has a `style.animation` set - only the real
	// presentation-stage copy ever does.
	const delaySeconds = await page
		.locator(`[data-element-id="${ENTRANCE_SHAPE_ID}"]`)
		.evaluateAll((nodes) => {
			for (const node of nodes as HTMLElement[]) {
				if (!node.style.animation) {
					continue;
				}
				// `animationDelay` can be a comma-separated list when more than one
				// animation is attached (e.g. a paired visibility-flip `p:set`
				// step); take the largest, since a same-group companion step's own
				// delay is never larger than the entrance effect's.
				const delays = getComputedStyle(node)
					.animationDelay.split(',')
					.map((token) => Number.parseFloat(token));
				return Math.max(...delays);
			}
			return undefined;
		});
	return delaySeconds !== undefined && Number.isFinite(delaySeconds)
		? delaySeconds * 1000
		: undefined;
}

test.describe('onStopAudio headless-fallback timer uses the REAL media duration', () => {
	test("every binding bakes the REAL 5000ms into the follow-on effect's CSS delay, not the stale authored 2000ms", async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await resetTabSession(page);
			await page.goto(origin);
			await page.locator('#file-input').setInputFiles(DECK);
			await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor();
			await enterPresentation(page);
			await page.waitForTimeout(500);

			// The deck's first (and only) click-group requires a click to start; it
			// plays the audio and, in the SAME synchronous step, bakes the
			// follow-on entrance effect's CSS animation-delay.
			await page.keyboard.press('PageDown');
			// One retry loop, not a fixed sleep: a binding may take a task-queue
			// tick to apply the click-group's state, but the delay VALUE itself is
			// set synchronously with that state, not by a later timer firing.
			for (let attempt = 0; attempt < 20; attempt++) {
				const delayMs = await readAnimationDelayMs(page);
				if (delayMs !== undefined) {
					return delayMs;
				}
				await page.waitForTimeout(100);
			}
			return undefined;
		});

		for (const { framework, value: delayMs } of results) {
			expect(delayMs, `${framework.name}: no animation-delay was ever attached`).toBeDefined();
			expect(
				delayMs,
				`${framework.name}: animation-delay was ${delayMs}ms - the STALE authored ` +
					`${STALE_AUTHORED_DURATION_MS}ms estimate, not the REAL ${MISMATCHED_REAL_DURATION_MS}ms duration`,
			).toBe(MISMATCHED_REAL_DURATION_MS);
		}
	});
});
