/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Slide-transition and element-animation PLAYBACK coverage, run identically
 * against every framework demo.
 *
 * Before this spec there was zero e2e coverage that actually exercised
 * transitions/animations *playing back* in presentation mode (only
 * `ribbon-tab-parity.spec.ts`, which checks the ribbon tabs switch, not that
 * anything animates). Both features are genuinely implemented in core - a
 * typed `PptxSlideTransition` model (parsed/serialized as real `p:transition`
 * XML) and native `p:timing` animation timelines - but investigation while
 * writing this spec found the three bindings render them via **architecturally
 * different mechanisms**, with one real gap:
 *
 *  - VUE (`PresentationTransitionOverlay.vue`) and ANGULAR
 *    (`presentation-transition-overlay.component.ts`) mount a genuine transient
 *    overlay while a transition plays: the outgoing slide (Vue: + a second,
 *    redundant incoming layer) is snapshotted into its own DOM subtree with a
 *    real CSS `animation` applied, then torn down once the duration elapses.
 *    This is directly assertable.
 *  - REACT's live "Present" flow does NOT wire up its equivalent
 *    (`PresentationTransitionOverlay.tsx` exists but is dead code - imported
 *    nowhere). `executeSlideTransition()` in
 *    `packages/react/src/viewer/hooks/presentation-mode/slide-transition.ts`
 *    only delays the slide swap by `min(transitionDuration, 480)`ms before an
 *    instant DOM replace; there is no CSS transition state to observe. The
 *    transition test below asserts what's actually true for React (a timing
 *    gap before an instant swap) rather than pretending a CSS transition
 *    plays, and documents the gap inline - see the "KNOWN GAP" comment.
 *
 * Element animations, by contrast, are observable in *all three* bindings, but
 * via different signals:
 *  - REACT drives playback off `slide.nativeAnimations` (parsed from real
 *    `p:timing` XML) through a `TimelineEngine`; an animated element's
 *    container div gets inline `visibility: hidden|visible` (+ `animation`
 *    once revealed).
 *  - VUE and ANGULAR drive playback off the simpler `slide.animations` array
 *    (also parsed from the same `p:timing` XML) via shared click-group
 *    helpers, applying inline `opacity: 0` (pending) then a real
 *    `animation-name` (e.g. `pptx-vue-fadeIn`) directly onto the
 *    `[data-element-id]` node.
 *  - All three share the same click semantics: advancing the presentation
 *    (`PageDown`/`ArrowRight`/Space) first reveals a slide's next pending
 *    animation click-group *without changing slide*; only once every
 *    click-group is revealed does the same keypress advance to the next
 *    slide. That shared "does this click reveal an animation or advance the
 *    slide" branch is exactly what the animation test below exercises.
 *
 * Because both `slide.animations` and `slide.nativeAnimations` are populated
 * independently from the *same* real `p:timing` XML at load time (see
 * `PptxSlideLoaderService`), a fixture authored via the SDK
 * (`SlideBuilder.setTransition` / `.addAnimation`) and loaded fresh through
 * `#file-input` plays back correctly in all three bindings. Authoring the
 * effect live via the ribbon/inspector in the same editing session would NOT
 * be portable: React's Present-mode playback only ever reads
 * `nativeAnimations`, which isn't regenerated from a live `slide.animations`
 * edit until the file is saved and reloaded. Hence: fixture-first, not
 * click-through-the-ribbon-then-present.
 *
 * Flakiness posture: every timing-sensitive assertion below uses
 * `expect(...)`'s built-in auto-retry or `expect.poll`, never a fixed
 * `waitForTimeout` gate on the pass/fail path (the only fixed waits are the
 * same post-navigation settle waits already established by
 * `chart-rendering.spec.ts`). Durations are read from the fixture's own
 * exported constants rather than hard-coded, so a future fixture tweak can't
 * silently desync the assertions from what's actually authored.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	ANIMATED_SHAPE_TEXT,
	ANIMATION_DURATION_MS,
	TRANSITIONS_ANIMATIONS_SLIDES as SLIDES,
	TRANSITION_DURATION_MS,
} from './fixtures/generate-transitions-animations-fixture';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/transitions-animations.pptx', import.meta.url)),
);

/** Buffer every binding adds past the raw duration before tearing its overlay
 * down / considering the effect "settled" (see `COMPLETE_MARGIN_MS` in the
 * Angular overlay and the equivalent `+ 50` in the Vue overlay). */
const SETTLE_BUFFER_MS = 50;
/** Extra slack on top of `duration + SETTLE_BUFFER_MS` for polls that wait on
 * a transient DOM state to clear - generous enough to absorb CI jitter without
 * letting a genuine regression (e.g. an overlay that never tears down) hang
 * for long before failing. */
const POLL_SLACK_MS = 2000;
/** How long the transition overlay (Vue/Angular) or the react timing-gap swap
 * should take to fully settle, derived from the fixture's own transition
 * duration rather than a hard-coded guess. */
const TRANSITION_SETTLE_TIMEOUT_MS = TRANSITION_DURATION_MS + SETTLE_BUFFER_MS + POLL_SLACK_MS;
/** How long the entrance animation should take to fully settle (opacity 1),
 * derived from the fixture's own animation duration. */
const ANIMATION_SETTLE_TIMEOUT_MS = ANIMATION_DURATION_MS + SETTLE_BUFFER_MS + POLL_SLACK_MS;

/**
 * Presentation mode keeps more than just the live slide's DOM around: a
 * `[data-element-id]` filter by text can also match a same-text duplicate in
 * the slide-list thumbnail rail, or (Vue/Angular mount the presentation as a
 * separate overlay layer rather than repurposing the editor's own canvas) the
 * editor's own canvas still sitting, off to the side, behind the overlay.
 * Picking `.first()` is not reliable - document order does not guarantee the
 * "real" live render comes first.
 *
 * Mirrors the "pick the largest-by-area match" technique already established
 * by `chart-rendering.spec.ts`'s `chartElement()` helper: among every match
 * that is actually within the viewport (excluding off-screen render targets,
 * e.g. a hidden export-stage clone), return the one with the largest
 * bounding-box area - a thumbnail-rail entry or a squeezed-in editor canvas is
 * far smaller than the fullscreen presentation stage. `minAreaPx` is a floor
 * well above any thumbnail's size (~700px^2 observed) and well below a real
 * slide render's (~45,000px^2 observed), so a candidate below it is never
 * mistaken for the live render; if nothing clears it, an out-of-range `nth()`
 * is returned so `toBeVisible()` fails honestly instead of masquerading as a
 * thumbnail match.
 */
async function primaryMatch(page: Page, locator: Locator, minAreaPx = 5000): Promise<Locator> {
	const count = await locator.count();
	const viewport = page.viewportSize();
	let bestIndex = -1;
	let bestArea = -1;
	for (let i = 0; i < count; i++) {
		const box = await locator.nth(i).boundingBox();
		if (!box) {
			continue;
		}
		const onScreen =
			!viewport ||
			(box.x + box.width > 0 &&
				box.x < viewport.width &&
				box.y + box.height > 0 &&
				box.y < viewport.height);
		if (!onScreen) {
			continue;
		}
		const area = box.width * box.height;
		if (area >= minAreaPx && area > bestArea) {
			bestArea = area;
			bestIndex = i;
		}
	}
	return locator.nth(bestIndex === -1 ? count : bestIndex);
}

/** Load the fixture and enter presentation mode, landing on slide 1. */
async function openInPresentMode(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-element-id]').filter({ hasText: SLIDES.first }).first().waitFor();
	// Not anchored (`/present/iu`, not `/^present$/iu`): Angular's button label
	// is "▶ Present" (glyph prefix included in the accessible name), while
	// React/Vue's is a bare "Present" - both match, and no other control in the
	// toolbar contains the substring "present".
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.click();
	await page.waitForTimeout(700);
}

/** Advance the presentation by one step (slide or animation click-group). */
async function advance(page: Page): Promise<void> {
	await page.keyboard.press('PageDown');
}

/** The live, on-screen `[data-element-id]` node carrying a slide's unique title text. */
async function slideTitle(page: Page, title: string): Promise<Locator> {
	return primaryMatch(page, page.locator('[data-element-id]').filter({ hasText: title }));
}

/** The live, on-screen `[data-element-id]` node for the animated shape. */
async function animatedShape(page: Page): Promise<Locator> {
	return primaryMatch(
		page,
		page.locator('[data-element-id]').filter({ hasText: ANIMATED_SHAPE_TEXT }),
	);
}

test.describe('slide transition playback', () => {
	test('advancing into a transition-bearing slide plays it back', async ({ page }, testInfo) => {
		await openInPresentMode(page);
		await expect(await slideTitle(page, SLIDES.first)).toBeVisible();

		const framework = testInfo.project.name;

		if (framework === 'vue') {
			const overlay = page.locator('.pptx-vue-transition-overlay');
			await advance(page);

			// Both the outgoing and incoming slide are genuinely mounted at once,
			// inside the overlay's two layers - not just "adjacent slide
			// preloading" elsewhere on the page (this locator is scoped to the
			// overlay itself).
			const layers = overlay.locator('.pptx-vue-transition-layer');
			await expect(layers).toHaveCount(2);
			await expect(layers.filter({ hasText: SLIDES.first })).toHaveCount(1);
			await expect(layers.filter({ hasText: SLIDES.transitionTarget })).toHaveCount(1);

			// Each layer carries a real CSS `animation`, not just a bare DOM swap.
			const animations = await layers.evaluateAll((els) =>
				els.map((el) => (el as HTMLElement).style.animation),
			);
			for (const anim of animations) {
				expect(anim, 'transition layer has a CSS animation applied').not.toBe('');
			}

			// The overlay tears itself down once the transition completes.
			await expect(overlay).toHaveCount(0, { timeout: TRANSITION_SETTLE_TIMEOUT_MS });
		} else if (framework === 'angular') {
			const overlay = page.locator('pptx-presentation-transition-overlay');
			await advance(page);

			await expect(overlay).toBeVisible();
			const layer = overlay.locator('.pptx-ng-transition-layer');
			// The overlay renders only the OUTGOING slide as a snapshot layer; the
			// incoming slide is the always-current main stage underneath it -
			// both coexist for the transition's duration.
			await expect(layer).toContainText(SLIDES.first);
			const animation = await layer.evaluate((el) => (el as HTMLElement).style.animation);
			expect(animation, 'transition layer has a CSS animation applied').not.toBe('');
			await expect(await slideTitle(page, SLIDES.transitionTarget)).toBeVisible();

			await expect(overlay).toHaveCount(0, { timeout: TRANSITION_SETTLE_TIMEOUT_MS });
		} else {
			// KNOWN GAP (react): `executeSlideTransition()` delays the slide swap
			// by `min(transitionDuration, 480)`ms then replaces the DOM instantly;
			// there is no CSS transition overlay wired to the live Present flow to
			// assert against (see the module doc above). This asserts the actual,
			// honest behaviour: the outgoing slide is still on screen immediately
			// after the advancing keypress, and the incoming slide only appears
			// once the swap fires.
			await advance(page);
			await expect(await slideTitle(page, SLIDES.first)).toBeVisible();
			await expect(await slideTitle(page, SLIDES.transitionTarget)).toBeVisible({
				timeout: TRANSITION_SETTLE_TIMEOUT_MS,
			});
		}

		// Steady state is identical across all three once the transition settles:
		// the incoming slide is the live render, the outgoing one no longer is
		// (`primaryMatch` resolves to no element once nothing full-size remains,
		// so this is a real check, not a false pass from a thumbnail-rail
		// duplicate lingering elsewhere on the page).
		await expect(await slideTitle(page, SLIDES.transitionTarget)).toBeVisible();
		await expect(await slideTitle(page, SLIDES.first)).not.toBeVisible();
	});
});

test.describe('element animation playback', () => {
	test('entrance animation is hidden until its click-group is revealed, then plays', async ({
		page,
	}, testInfo) => {
		const framework = testInfo.project.name;

		await openInPresentMode(page);
		await advance(page); // slide 1 -> slide 2 (transition slide; not under test here)
		await expect(await slideTitle(page, SLIDES.transitionTarget)).toBeVisible();
		// Let slide 2's transition (if any observable overlay exists) fully settle
		// before continuing, so it can't bleed into the animation timing below.
		await expect(page.locator('.pptx-vue-transition-overlay')).toHaveCount(0, {
			timeout: TRANSITION_SETTLE_TIMEOUT_MS,
		});
		await expect(page.locator('pptx-presentation-transition-overlay')).toHaveCount(0, {
			timeout: TRANSITION_SETTLE_TIMEOUT_MS,
		});

		await advance(page); // slide 2 -> slide 3 (transition 'none': instant)
		await expect(await slideTitle(page, SLIDES.animated)).toBeVisible();

		const shape = await animatedShape(page);

		// Before the first click on this slide, the entrance hasn't played: the
		// element is hidden (React: `visibility: hidden`; Vue/Angular: `opacity: 0`
		// pre-seeded so it never flashes visible).
		if (framework === 'react') {
			await expect
				.poll(() => shape.evaluate((el) => getComputedStyle(el).visibility))
				.toBe('hidden');
		} else {
			await expect.poll(() => shape.evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
		}

		// The next click reveals the animation's click-group WITHOUT advancing the
		// slide - the shared "an animation is pending, consume the click" contract
		// every binding implements (`playNextAnimationGroup()` / `playback.advance()`).
		await advance(page);
		await expect(await slideTitle(page, SLIDES.animated)).toBeVisible();
		await expect(await slideTitle(page, SLIDES.end)).not.toBeVisible();

		if (framework === 'react') {
			await expect
				.poll(() => shape.evaluate((el) => getComputedStyle(el).visibility))
				.toBe('visible');
			await expect
				.poll(() => shape.evaluate((el) => getComputedStyle(el).animationName))
				.toBe('pptx-fadeIn');
		} else {
			await expect
				.poll(() => shape.evaluate((el) => getComputedStyle(el).animationName))
				.toBe('pptx-vue-fadeIn');
		}

		// Whichever binding, the entrance keyframe ends on full opacity and the
		// `forwards`/`both` fill mode holds it there once the animation completes.
		await expect
			.poll(() => shape.evaluate((el) => getComputedStyle(el).opacity), {
				timeout: ANIMATION_SETTLE_TIMEOUT_MS,
			})
			.toBe('1');

		// The click-group is now exhausted: this next click really advances the
		// slide.
		await advance(page);
		await expect(await slideTitle(page, SLIDES.end)).toBeVisible();
	});
});
