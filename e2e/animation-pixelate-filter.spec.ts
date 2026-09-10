/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `p:animEffect/@filter="pixelate"` against `pixelate-filter.pptx`
 * (`e2e/fixtures/generate-pixelate-filter-fixture.ts`): a bare filter-only
 * entrance with NO `presetID`/`presetClass`, so `resolveFilterEffect`'s
 * fallback (`packages/shared/src/render/animation-filter-effects.ts`) is the
 * ONLY path that can resolve it. Run identically against every framework
 * demo.
 *
 * Verified via COM against real PowerPoint 2016 (CreateVideo, frame-diffed
 * against a dissolve control deck): PowerPoint performs NO animation at all
 * for `filter="pixelate"`, it snaps straight to the resolved end state from
 * the first frame - the element is simply absent until the transition's
 * final frame, then present, exactly matching `p:animEffect/@filter="cut"`'s
 * instant-swap semantics. Parity therefore means the DEFAULT here plays
 * `pptx-cutIn`/`pptx-cutOut` (`cut`'s own keyframes), not the mosaic this
 * repo used to default to.
 *
 * The blocky mosaic reveal (self-contained SVG `<filter>` data-URIs stepped
 * through discrete `@keyframes` stops, see `animation-pixelate-filter.ts`)
 * remains available as an explicit, off-by-default viewer option
 * (`ViewerAdvancedOptions.pixelateMosaicAnimation`, File > Options >
 * Advanced > Slide Show, documented on `docs/guide/visual-effects.md`), for
 * a viewer that would rather show something animating than PowerPoint's own
 * instant swap. Seeded here via the shared `pptx-viewer-prefs` localStorage
 * key (`packages/shared/src/render/viewer-prefs-storage.ts`) rather than
 * driving the Options dialog UI, since the dialog itself is not yet at
 * parity across all five bindings.
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

/** Find the pixelate-entrance target element (once its animation has started) and read its `animation-name`. */
function probePixelateTargetAnimationName(page: Page): Promise<string | undefined> {
	return page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>(
			'[data-element-id^="ppt/slides/slide1.xml"]',
		)) {
			const name = el.style.animationName;
			if (name === 'pptx-cutIn' || name?.startsWith('pptx-pixelate')) {
				return name;
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

/** Advance the show once (twice if the first press only settles the show's initial state). */
async function advanceUntilAnimationNamed(page: Page): Promise<string | undefined> {
	await page.keyboard.press('ArrowRight');
	let animationName = await probePixelateTargetAnimationName(page);
	if (!animationName) {
		await page.keyboard.press('ArrowRight');
		await expect
			.poll(() => probePixelateTargetAnimationName(page), { timeout: 8000 })
			.toBeDefined();
		animationName = await probePixelateTargetAnimationName(page);
	}
	return animationName;
}

/** Seed the shared viewer-prefs localStorage key with an Advanced-tab option override. */
async function seedPixelateMosaicOption(page: Page, enabled: boolean): Promise<void> {
	await page.addInitScript((mosaicEnabled: boolean) => {
		localStorage.setItem(
			'pptx-viewer-prefs',
			JSON.stringify({ options: { advanced: { pixelateMosaicAnimation: mosaicEnabled } } }),
		);
	}, enabled);
}

test.describe('p:animEffect filter="pixelate": defaults to snap-to-end-state (matches PowerPoint)', () => {
	test("plays pptx-cutIn (not the mosaic) by default, matching PowerPoint's own instant swap", async ({
		page,
	}) => {
		await loadDeck(page, PIXELATE_DECK);
		await startShow(page);

		const animationName = await advanceUntilAnimationNamed(page);
		expect(animationName).toBe('pptx-cutIn');
	});
});

test.describe('p:animEffect filter="pixelate": pixelateMosaicAnimation opt-in', () => {
	test('plays pptx-pixelateIn (not pptx-cutIn) once the mosaic option is enabled', async ({
		page,
	}) => {
		await seedPixelateMosaicOption(page, true);
		await loadDeck(page, PIXELATE_DECK);
		await startShow(page);

		const animationName = await advanceUntilAnimationNamed(page);
		expect(animationName).toBe('pptx-pixelateIn');
	});

	test('carries a mosaic SVG `<filter>` data-URI mid-animation, not a bare colour/opacity transform', async ({
		page,
	}) => {
		await seedPixelateMosaicOption(page, true);
		await loadDeck(page, PIXELATE_DECK);
		await startShow(page);

		await advanceUntilAnimationNamed(page);

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
