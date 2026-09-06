/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `p:animEffect/@filter="pixelate"` mosaic reveal, run identically against
 * every framework demo against `pixelate-filter.pptx`
 * (`e2e/fixtures/generate-pixelate-filter-fixture.ts`): a bare filter-only
 * entrance with NO `presetID`/`presetClass`, so `resolveFilterEffect`'s
 * fallback (`packages/shared/src/render/animation-filter-effects.ts`) is the
 * ONLY path that can resolve it.
 *
 * Pins that the mosaic actually plays rather than silently degrading to the
 * neutral fade fallback every other genuinely-unmapped filter family gets:
 * the entrance keyframe name must be `pptx-pixelateIn`
 * (`packages/shared/src/render/animation-pixelate-filter.ts`), and mid-flight
 * the element's computed `filter` must reference one of the self-contained
 * SVG `<filter>` data-URIs that engine steps through (CSS cannot interpolate
 * `filter: url(...)`, so playback is a fixed sequence of discrete steps).
 *
 * Verified via COM against real PowerPoint 2016 (CreateVideo, frame-diffed
 * against a dissolve control deck): PowerPoint performs NO animation at all
 * for `filter="pixelate"`, it snaps straight to the resolved end state from
 * the first frame. So there is no PowerPoint frame sequence for this mosaic
 * to match; this spec pins our own deliberate substitute behaviour instead
 * (see the module doc on `animation-pixelate-filter.ts` for the measurement).
 *
 * Every assertion reads the rendered DOM through the framework-neutral
 * contract (`#file-input`, `[data-element-id]`, role=button, standard Web
 * Animations API), so the same spec runs against all five bindings.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeck } from './support/deck';

const PIXELATE_DECK = fixture('pixelate-filter.pptx');

/** Start the slide show from the demo's Present control. */
async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(600);
}

/**
 * Seek every currently-running CSS animation to `fraction` of its OWN
 * duration and wait for the frame that paints it. Mirrors the identical
 * helper in `issue-161-morph-micro-movement.spec.ts`: setting
 * `Animation.currentTime` directly is deterministic, unlike racing a
 * `waitForTimeout` against playback speed.
 */
async function scrubTo(page: Page, fraction: number): Promise<void> {
	await page.evaluate(async (f) => {
		for (const animation of document.getAnimations()) {
			const duration = animation.effect?.getTiming().duration;
			animation.currentTime = typeof duration === 'number' ? duration * f : 0;
		}
		await new Promise<void>((painted) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => painted());
			});
		});
	}, fraction);
}

/** Find the pixelate-entrance target element (if its animation has started) and read its `animation-name`. */
function probePixelateAnimationName(page: Page): Promise<string | undefined> {
	return page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>(
			'[data-element-id^="ppt/slides/slide1.xml"]',
		)) {
			if (el.style.animationName?.startsWith('pptx-pixelate')) {
				return el.style.animationName;
			}
		}
		return undefined;
	});
}

/** Read the pixelate target's computed `filter`, once its animation has started. */
function probePixelateComputedFilter(page: Page): Promise<string | undefined> {
	return page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>(
			'[data-element-id^="ppt/slides/slide1.xml"]',
		)) {
			if (el.style.animationName?.startsWith('pptx-pixelate')) {
				return getComputedStyle(el).filter;
			}
		}
		return undefined;
	});
}

test.describe('p:animEffect filter="pixelate" mosaic reveal', () => {
	test('plays pptx-pixelateIn (not the neutral fade fallback) for a bare filter="pixelate" entrance', async ({
		page,
	}) => {
		await loadDeck(page, PIXELATE_DECK);
		await startShow(page);

		// The deck's only click group is the pixelate entrance; one advance
		// fires it. A second covers a binding that needed the first press to
		// settle the show's initial state.
		await page.keyboard.press('ArrowRight');
		let animationName = await probePixelateAnimationName(page);
		if (!animationName) {
			await page.keyboard.press('ArrowRight');
			await expect.poll(() => probePixelateAnimationName(page), { timeout: 8000 }).toBeDefined();
			animationName = await probePixelateAnimationName(page);
		}
		expect(animationName).toBe('pptx-pixelateIn');
	});

	test('carries a mosaic SVG `<filter>` data-URI mid-animation, not a bare colour/opacity transform', async ({
		page,
	}) => {
		await loadDeck(page, PIXELATE_DECK);
		await startShow(page);

		await page.keyboard.press('ArrowRight');
		if (!(await probePixelateAnimationName(page))) {
			await page.keyboard.press('ArrowRight');
			await expect.poll(() => probePixelateAnimationName(page), { timeout: 8000 }).toBeDefined();
		}

		// Halfway through the reveal the mosaic is still coarsening: the
		// computed `filter` must reference one of the self-contained
		// `pptx-pixelate-<n>` SVG filter data-URIs, not `none` (the resolved
		// end state) or a plain CSS filter function.
		await scrubTo(page, 0.5);
		const midFilter = await probePixelateComputedFilter(page);
		expect(midFilter).toBeDefined();
		expect(midFilter).toContain('pptx-pixelate');
		expect(midFilter).toContain('data:image/svg+xml');
	});
});
