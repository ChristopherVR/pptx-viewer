/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Two defects the repo owner hit on the deployed Angular demo with
 * `e2e/fixtures/solution-explorer.pptx`, both pinned here against what a HUMAN
 * sees rather than against a DOM node merely existing:
 *
 *  1. Slide 2 rendered as a flat block of GREEN. The slide is a full-bleed
 *     background video with a click-target rectangle laid over it, authored
 *     `<a:solidFill><a:schemeClr val="accent3" …><a:alpha val="0"/></a:schemeClr>`
 *     i.e. FULLY TRANSPARENT. Angular's own fill cascade emitted the bare
 *     `fillColor` and dropped `fillOpacity`, so that invisible overlay painted
 *     opaque and hid the entire slide behind it. Asserted on real pixels: the
 *     corners of the rendered slide must not be the overlay's fill colour.
 *
 *  2. The slide show was completely unresponsive: entering it and clicking did
 *     nothing at all, for ever. Slide 1 is authored `advClick="0" advTm="10"`
 *     ("advance on click OFF, after 10ms"), so the click gate correctly swallows
 *     every click and the ONLY thing that can move the show on is the timed
 *     auto-advance. Bindings that honoured the gate without arming the timer
 *     stranded the show on slide 1.
 *
 * Plus a third, found while confirming a Vue finding against Angular: a morph's
 * DEPARTING layer must not paint a slide background, or it covers the incoming
 * slide for the whole morph. See that test for why the existing pixel spec
 * cannot catch it on this deck.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)),
);

/** The deck is 5 MB with a real video; give the initial parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/**
 * The slide-2 overlay rectangle ("Rectangle 49"), keyed by the core-assigned
 * element id every binding stamps identically.
 */
const OVERLAY_ID = 'ppt/slides/slide2.xml-shape-0';

/** The overlay's resolved scheme colour, `accent3 lumMod 40% lumOff 60%`. */
const OVERLAY_RGB = [132, 226, 145] as const;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

/**
 * Which slide the biggest painted surface belongs to. Reads the core-assigned
 * `data-element-id` prefixes rather than a per-binding slide counter, and takes
 * the most-represented slide so a transition overlay (which paints the outgoing
 * and incoming slide at once) and the slide rail cannot win.
 */
async function presentedSlideNumber(page: Page): Promise<number> {
	return page.evaluate(() => {
		const counts = new Map<number, number>();
		for (const node of document.querySelectorAll('[data-element-id]')) {
			// Slide-rail thumbnails are an order of magnitude smaller than the stage.
			if (node.getBoundingClientRect().width < 40) {
				continue;
			}
			const match = /slide(\d+)\.xml/u.exec(node.getAttribute('data-element-id') ?? '');
			if (!match) {
				continue;
			}
			const slideNumber = Number(match[1]);
			counts.set(slideNumber, (counts.get(slideNumber) ?? 0) + 1);
		}
		return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 0;
	});
}

/**
 * Sample real rendered pixels: screenshot `locator`, decode it back inside the
 * page, and read the colour at each fractional position.
 *
 * Going through actual pixels is the point. The previous round of this bug was
 * declared fixed off a passing DOM assertion while the user still saw the
 * defect on screen, so nothing here trusts `getComputedStyle` alone.
 */
async function samplePixels(
	page: Page,
	selector: string,
	points: readonly (readonly [number, number])[],
): Promise<number[][]> {
	const shot = await page.locator(selector).first().screenshot();
	return page.evaluate(
		async ({ dataUrl, positions }) => {
			const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
			const canvas = document.createElement('canvas');
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			const context = canvas.getContext('2d');
			if (!context) {
				return [];
			}
			context.drawImage(bitmap, 0, 0);
			return positions.map(([fx, fy]) => {
				const x = Math.min(bitmap.width - 1, Math.max(0, Math.round(fx * bitmap.width)));
				const y = Math.min(bitmap.height - 1, Math.max(0, Math.round(fy * bitmap.height)));
				const { data } = context.getImageData(x, y, 1, 1);
				return [data[0], data[1], data[2]];
			});
		},
		{ dataUrl: `data:image/png;base64,${shot.toString('base64')}`, positions: points },
	);
}

test.describe('solution-explorer.pptx: transparent overlay + timed advance', () => {
	test('a fully transparent overlay does not paint over the slide', async ({ page }) => {
		await loadDeck(page);
		await page.locator('[aria-label="Go to slide 2"]').first().click();
		await page.waitForTimeout(1500);

		// DOM truth: `<a:alpha val="0"/>` must survive into the painted colour.
		const overlayAlpha = await page.evaluate((id) => {
			const nodes = [...document.querySelectorAll<HTMLElement>(`[data-element-id="${id}"]`)].sort(
				(left, right) => right.getBoundingClientRect().width - left.getBoundingClientRect().width,
			);
			const node = nodes[0];
			if (!node) {
				return null;
			}
			const background = getComputedStyle(node).backgroundColor;
			const match = /rgba?\(([^)]+)\)/u.exec(background);
			if (!match) {
				return { background, alpha: null as number | null };
			}
			const parts = match[1].split(',').map((part) => Number.parseFloat(part));
			return { background, alpha: parts.length > 3 ? parts[3] : 1 };
		}, OVERLAY_ID);

		expect(overlayAlpha, `found the slide-2 overlay ${OVERLAY_ID}`).not.toBeNull();
		expect(
			overlayAlpha?.alpha ?? 1,
			`the overlay is authored alpha=0 but painted ${overlayAlpha?.background}`,
		).toBeLessThan(0.02);

		// Pixel truth: the corners of the slide carry the background behind the
		// overlay (video frame / slide background), never the overlay's colour.
		// This is the part a human sees; the whole slide was one flat green field.
		const samples = await samplePixels(page, '[aria-roledescription="slide"]', [
			[0.02, 0.03],
			[0.98, 0.03],
			[0.02, 0.97],
			[0.98, 0.97],
			[0.5, 0.04],
		]);
		expect(samples.length, 'sampled the rendered slide').toBe(5);
		for (const [red, green, blue] of samples) {
			const distance =
				Math.abs(red - OVERLAY_RGB[0]) +
				Math.abs(green - OVERLAY_RGB[1]) +
				Math.abs(blue - OVERLAY_RGB[2]);
			expect(
				distance,
				`slide 2 painted rgb(${red}, ${green}, ${blue}), the transparent overlay's own colour`,
			).toBeGreaterThan(60);
		}
	});

	/** Enter the slide show from slide 1 and let its authored timing run. */
	async function startShowFromSlideOne(page: Page): Promise<void> {
		await loadDeck(page);
		expect(await presentedSlideNumber(page), 'the editor opens on slide 1').toBe(1);
		await page
			.getByRole('button', { name: /^present$|slide show/iu })
			.first()
			.click();
		// Slide 1 is `advTm="10"`; allow generously for fullscreen + first paint.
		await page.waitForTimeout(3000);
	}

	test('a slide that forbids click-advance still advances on its authored timing', async ({
		page,
	}) => {
		await startShowFromSlideOne(page);

		// The whole bug: without the timer this stays on slide 1 for ever, and
		// because `advClick="0"` also swallows every click the show looks dead.
		expect(
			await presentedSlideNumber(page),
			'the show left slide 1 on its authored timing',
		).toBeGreaterThan(1);
	});

	test('clicking keeps the slide show moving', async ({ page }) => {
		await startShowFromSlideOne(page);
		const before = await presentedSlideNumber(page);
		expect(before, 'the show is past slide 1').toBeGreaterThan(1);

		// A click on a slide that DOES allow click-advance must move the show on.
		// The first click can legitimately be consumed by the slide's remaining
		// animation builds, so allow a few before calling it stuck.
		for (let attempt = 0; attempt < 4; attempt += 1) {
			await page.mouse.click(1500, 900);
			await page.waitForTimeout(1400);
			if ((await presentedSlideNumber(page)) > before) {
				break;
			}
		}
		expect(
			await presentedSlideNumber(page),
			'clicking advances the show once past slide 1',
		).toBeGreaterThan(before);
	});

	/**
	 * A morph paints only the DEPARTING slide's paired shapes over the live
	 * incoming stage. If that layer also paints a slide background it covers the
	 * incoming slide for the whole morph, so the viewer watches a static slab and
	 * then a hard cut. Measured on Angular before the fix: a 1920x1080
	 * `rgb(23, 23, 23)` field at z-index 40, opaque on every frame.
	 *
	 * `present-transition-pixels.spec.ts` has a near-flat-fill guard aimed at this
	 * class of bug, but it cannot catch it on THIS deck: the departing slide is
	 * itself a full-bleed video, so the covered frame is richly coloured and never
	 * reads as flat. It just shows the wrong slide. Hence the structural probe.
	 *
	 * Sampling runs inside the page on requestAnimationFrame, because the layer is
	 * mounted only for the morph's duration and round-tripping a few `evaluate`
	 * calls misses it entirely.
	 */
	test('a morph departing layer does not paint a slide background', async ({ page }) => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		// Forget any restored session first, or the deck reopens and the landing
		// dropzone (the only place #file-input exists) never mounts.
		await resetTabSession(page);
		await page.goto('/');
		await page.locator('#file-input').setInputFiles(fixturePath);
		await page
			.locator('[aria-label="Go to slide 14"]')
			.first()
			.waitFor({ timeout: LOAD_TIMEOUT_MS });
		await page.waitForTimeout(1200);
		// Slides 3-14 each carry a `p159:morph`; step 3 -> 4.
		await page.locator('[aria-label="Go to slide 3"]').first().click();
		await page.waitForTimeout(900);
		await page
			.getByRole('button', { name: /^present$|slide show/iu })
			.first()
			.click();
		await page.waitForTimeout(2500);

		// Arm the in-page sampler, then advance.
		await page.evaluate(() => {
			const state: { sawLayer: boolean; opaque: { cls: string; bg: string }[] } = {
				sawLayer: false,
				opaque: [],
			};
			(window as unknown as { __morphProbe: typeof state }).__morphProbe = state;
			const deadline = performance.now() + 2500;
			const sample = (): void => {
				// Scope strictly to the DEPARTING layer. The overlay also holds an
				// incoming layer, whose slide background is legitimate (it is the
				// slide being revealed, and it sits below). React's morph is the
				// exception: it takes a separate branch that emits no
				// `data-pptx-transition-layer` at all, rendering per-shape ghosts and
				// no slide surface, so its overlay root IS the departing layer.
				const layer =
					document.querySelector('[data-pptx-transition-layer="outgoing"]') ??
					document.querySelector('[data-pptx-transition-overlay]');
				if (layer) {
					state.sawLayer = true;
					const stage = layer.getBoundingClientRect();
					const walk = (node: Element): void => {
						const style = getComputedStyle(node);
						const box = node.getBoundingClientRect();
						const colour = style.backgroundColor;
						const alpha = /rgba\([^)]*,\s*([\d.]+)\s*\)/u.exec(colour);
						const isOpaque = colour !== 'transparent' && (!alpha || Number(alpha[1]) > 0.5);
						// Only a background covering essentially the whole stage can
						// occlude the incoming slide; real shapes are far smaller.
						if (isOpaque && box.width >= stage.width * 0.9 && box.height >= stage.height * 0.9) {
							state.opaque.push({ cls: String(node.className ?? '').slice(0, 40), bg: colour });
						}
						for (const child of node.children) {
							walk(child);
						}
					};
					walk(layer);
				}
				if (performance.now() < deadline) {
					requestAnimationFrame(sample);
				}
			};
			requestAnimationFrame(sample);
		});
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(2600);

		const probe = await page.evaluate(
			() =>
				(
					window as unknown as {
						__morphProbe: { sawLayer: boolean; opaque: { cls: string; bg: string }[] };
					}
				).__morphProbe,
		);

		expect(probe.sawLayer, 'the morph mounted a transition overlay').toBeTruthy();
		expect(
			probe.opaque.map((entry) => `${entry.cls}: ${entry.bg}`).slice(0, 3),
			'the departing layer painted an opaque full-stage background over the incoming slide',
		).toEqual([]);
	});
});
