/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Production-build smoke guard for the slide show.
 *
 * Every other product spec runs against a demo DEV server. This one is meant to
 * be run by `playwright.packaged.config.ts`, whose web servers are
 * `vite preview` over each demo's BUILT `dist/` (the same artifact the GitHub
 * Pages deploy publishes). It exists because a packaged bundle that renders
 * fine but never animates once shipped is invisible to the dev-server suite:
 * bundling can drop or reorder a module-scope constant (this repo has already
 * lost `DEFAULT_CANVAS_WIDTH` that way), and the keyframes CSS is exactly such
 * a constant.
 *
 * The assertions are deliberately coarse and binding-neutral:
 *  1. the slide-transition `@keyframes` text reaches the document while a
 *     transition plays (proving the constant survived bundling);
 *  2. stepping onto a morph slide actually runs `pptx-morph*` CSS animations;
 *  3. no Next press is swallowed by a slide whose only `p:timing` content is an
 *     interactive (click-the-shape) sequence. A duplicated interactive step
 *     used to land in the main sequence as a phantom click step, so Next did
 *     nothing and the show looked frozen and animation-free.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

/**
 * Real deck: slide 2 carries a click-to-pause video (interactive sequence only)
 * and slides 3-14 each carry a `p159:morph` transition.
 */
const deck = resolve(fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)));

/** Small synthetic deck whose slide 2 carries a classic (`p:fade`) transition. */
const classicDeck = resolve(
	fileURLToPath(new URL('./fixtures/transitions-animations.pptx', import.meta.url)),
);

/** The 5 MB deck embeds a video; give the packaged parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page, file = deck, slideCount = 14): Promise<void> {
	await page.setViewportSize({ width: 1440, height: 900 });
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
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(900);
}

async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(1500);
}

interface AnimationProbe {
	/** Distinct `animationName`s seen running, in first-seen order. */
	names: string[];
	/** Highest concurrent running-animation count observed. */
	peak: number;
	/**
	 * Whether the slide-transition `@keyframes` text was in the document at any
	 * sampled frame. Vanilla and Svelte inject it once per document when the show
	 * opens; React, Vue and Angular mount it with the transition overlay, so it
	 * only exists while a transition is on screen. Either satisfies this.
	 */
	sawTransitionKeyframes: boolean;
}

/**
 * Sample the document every frame for `windowMs`, recording running CSS
 * animations and whether the transition keyframes are present. A transition is
 * over in well under a second, so polling after the fact would miss it.
 */
async function recordAnimations(page: Page, windowMs: number): Promise<void> {
	await page.evaluate((ms) => {
		const store: AnimationProbe = { names: [], peak: 0, sawTransitionKeyframes: false };
		(window as unknown as { __pptxAnimProbe: AnimationProbe }).__pptxAnimProbe = store;
		const seen = new Set<string>();
		const started = performance.now();
		const sample = (): void => {
			const running = document.getAnimations();
			store.peak = Math.max(store.peak, running.length);
			for (const animation of running) {
				const name = (animation as unknown as { animationName?: string }).animationName;
				if (name && !seen.has(name)) {
					seen.add(name);
					store.names.push(name);
				}
			}
			if (
				!store.sawTransitionKeyframes &&
				[...document.querySelectorAll('style')].some((node) =>
					(node.textContent ?? '').includes('@keyframes pptx-tr-fade-in'),
				)
			) {
				store.sawTransitionKeyframes = true;
			}
			if (performance.now() - started < ms) {
				requestAnimationFrame(sample);
			}
		};
		requestAnimationFrame(sample);
	}, windowMs);
}

async function readAnimations(page: Page): Promise<AnimationProbe> {
	return page.evaluate(
		() => (window as unknown as { __pptxAnimProbe: AnimationProbe }).__pptxAnimProbe,
	);
}

test('a packaged build carries the slide-transition keyframes', async ({ page }) => {
	// Slide 2 of this deck has a classic `p:fade` transition, which resolves to
	// the `pptx-tr-*` keyframes (a morph builds its own keyframes instead, so it
	// would not exercise the shared block).
	await loadDeck(page, classicDeck, 4);
	await startShow(page);
	await recordAnimations(page, 6000);

	await page.keyboard.press('PageDown');
	await page.waitForTimeout(2500);

	const { names, sawTransitionKeyframes } = await readAnimations(page);

	// A bundler that drops the keyframes constant still emits the `<style>`
	// element, just empty, so assert on the CONTENT, not the element.
	expect(sawTransitionKeyframes, 'the slide-transition @keyframes text reached the document').toBe(
		true,
	);
	expect(
		names.filter((name) => name.startsWith('pptx-tr-')),
		`the fade transition ran its keyframes (saw: ${names.slice(0, 5).join(', ')})`,
	).not.toHaveLength(0);
});

test('a packaged build actually animates a morph transition', async ({ page }) => {
	await loadDeck(page);
	await gotoSlide(page, 4);
	await startShow(page);
	await recordAnimations(page, 6000);

	await page.keyboard.press('PageDown');
	await page.waitForTimeout(2500);

	const { names, peak } = await readAnimations(page);
	const morphNames = names.filter((name) => name.includes('pptx-morph'));

	expect(peak, 'CSS animations ran during the transition').toBeGreaterThan(0);
	expect(
		morphNames.length,
		`morph keyframes ran (saw: ${names.slice(0, 5).join(', ')})`,
	).toBeGreaterThan(0);
});

test('no Next press is swallowed by a click-only interactive sequence', async ({ page }) => {
	await loadDeck(page);
	await startShow(page);
	await recordAnimations(page, 14_000);

	// Slide 2's only `p:timing` content is an interactive (click-the-video)
	// sequence plus one auto-started media command, so PowerPoint leaves it on
	// the first press. A duplicated interactive step used to land in the MAIN
	// sequence as a phantom click step, so the second press did nothing and the
	// show looked frozen (and, since every morph lives from slide 3 on,
	// animation-free).
	//
	// Three presses from the start must therefore reach slide 4, playing the
	// 2 -> 3 AND 3 -> 4 morphs. The deck's slides carry the same visible text,
	// so identity comes from the morph keyframe names, which embed the paired
	// slide's part name (`...pptslidesslide4xml...`).
	for (let press = 0; press < 3; press++) {
		await page.keyboard.press('PageDown');
		await page.waitForTimeout(2200);
	}

	const { names } = await readAnimations(page);
	const morphedSlides = new Set(
		names
			.filter((name) => name.includes('pptx-morph'))
			.map((name) => /slide(\d+)xml/u.exec(name)?.[1])
			.filter((slide): slide is string => slide !== undefined),
	);

	expect(
		morphedSlides.size,
		`three presses played two morph transitions (slides seen: ${[...morphedSlides].join(', ')})`,
	).toBeGreaterThanOrEqual(2);
});
