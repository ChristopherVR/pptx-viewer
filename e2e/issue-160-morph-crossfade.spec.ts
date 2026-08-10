/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Issue #160: a morph that replaces wording has to CROSSFADE it.
 *
 * From a topic slide the reporter clicked the wedge for the next one. Both
 * slides draw the same centre panel with that challenge's own title and two
 * paragraphs, and PowerPoint dissolves one wording into the other. pptx-viewer
 * faded the old wording out inside the first quarter and only began the new one
 * at 42%, so the middle of the transition showed an empty panel: "fades out and
 * then in with no overlap".
 *
 * The wording is what makes the two text boxes look unrelated - same place,
 * different words - so the matcher refused to pair them and both halves took
 * the unmatched path. Their groups had already been shown to hold the same cast
 * of shapes, which is what the fix honours.
 *
 * Ground truth, measured off PowerPoint 16's own render of slides 5 -> 6
 * (`CreateVideo`, 62.5fps): every frame of that panel is a blend of the two end
 * states whose weights sum to 1.000 for the whole transition, on
 * `cubic-bezier(0.2, 0, 0.4, 1)`. So this asserts overlap, not merely motion.
 *
 * The morph is frozen and scrubbed rather than sampled in real time - the show
 * runs it in 1s, far too tight to screenshot reliably.
 *
 * Run: bunx playwright test issue-160-morph-crossfade
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const deck = resolve(fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)));

/** The 5 MB deck embeds a video; give the parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/** A topic slide, and the wedge on its wheel that jumps to the next one. */
const TOPIC_SLIDE = 5;

/** "AI Decision Advantage": the wedge hyperlinked to slide 6. */
const NEXT_TOPIC_WEDGE = 'ppt/slides/slide5.xml-shape-2';

/**
 * The running show's own stage. Scoping to it is not optional: the editor
 * canvas and the slide rail stay mounted behind the show and carry the SAME
 * element ids at their own scale.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

/**
 * The transition's own layer, which not every binding mounts inside the show
 * stage: the ghosts live here and the editor canvas behind the show must stay
 * out of every query, since it carries the same element ids at its own scale.
 */
const MORPH_OVERLAY = '[data-pptx-transition-overlay]';

/** The centre panel's wording, which the morph has to cross-dissolve. */
const WORDING = {
	title: {
		out: 'ppt/slides/slide5.xml-group-0-group-0-shape-0',
		in: 'ppt/slides/slide6.xml-group-0-group-0-shape-0',
	},
	body: {
		out: 'ppt/slides/slide5.xml-group-0-group-0-shape-1',
		in: 'ppt/slides/slide6.xml-group-0-group-0-shape-1',
	},
	challenge: {
		out: 'ppt/slides/slide5.xml-group-0-group-0-shape-2',
		in: 'ppt/slides/slide6.xml-group-0-group-0-shape-2',
	},
} as const;

async function startShowOnTopicSlide(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
	await page.locator(`[aria-label="Go to slide ${TOPIC_SLIDE}"]`).first().click();
	await page.waitForTimeout(900);
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(2000);
}

/**
 * Click the wedge and hold the resulting morph open, paused, so it can be
 * scrubbed frame by frame. The freeze is a global `animation-play-state:
 * paused` injected BEFORE the click: pausing from script afterwards is a race
 * nothing can win, and every sample would land on the settled frame, passing
 * vacuously. The overlay's teardown timer is neutralised separately.
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
			return { x: rect.x + rect.width * 0.75, y: rect.y + rect.height * 0.75 };
		},
		[SHOW_STAGE, NEXT_TOPIC_WEDGE] as const,
	);
	expect(spot, 'the AI Decision Advantage wedge must be on screen').not.toBeNull();
	await page.mouse.click(spot!.x, spot!.y);

	await page.locator('[data-pptx-transition-overlay]').first().waitFor({ timeout: 5_000 });
	await page
		.locator(`${SHOW_STAGE} [data-element-id="${WORDING.title.in}"]`)
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
 * wait for the frame that paints it. A sample taken before the repaint reads
 * the PREVIOUS fraction.
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
	await page.waitForTimeout(120);
}

/**
 * How strongly an element is painted right now: the opacity of the node the
 * morph is animating, times every ancestor's, over whichever copy of it shows
 * most.
 *
 * The address of a copy differs by binding and by which layer paints it. Four
 * bindings re-render the ghost as an ordinary slide element and keep its
 * `data-element-id`; React deliberately does not expose the id twice and marks
 * the overlay copy with `data-pptx-morph-outgoing` instead, animating the
 * element container inside that wrapper. Both are accepted here, and the
 * animated node is found by its `pptx-morph*` animation name rather than
 * assumed to be the marker itself.
 *
 * Two bindings also stack whole slide layers, so one id can be in the DOM
 * twice during a morph, and an arriving shape can have its dissolve LIFTED into
 * the overlay with the stage copy held at zero. The visible one is the maximum.
 */
async function paintedOpacity(page: Page, elementId: string): Promise<number> {
	return page.evaluate(
		([stage, overlay, id]) => {
			const escaped = id.replace(/"/gu, '\\"');
			const markers = [
				`[data-element-id="${escaped}"]`,
				`[data-pptx-morph-outgoing="${escaped}"]`,
				`[data-pptx-morph-lifted="${escaped}"]`,
			];
			const nodes = new Set<Element>();
			for (const scope of [stage, overlay]) {
				for (const marker of markers) {
					for (const node of document.querySelectorAll(`${scope} ${marker}`)) {
						nodes.add(node);
					}
				}
			}
			const animated = (node: Element): Element =>
				[node, ...node.querySelectorAll('*')].find((candidate) =>
					getComputedStyle(candidate).animationName.includes('pptx-morph'),
				) ?? node;
			let strongest = 0;
			for (const node of nodes) {
				const painted = animated(node);
				const rect = painted.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) {
					continue;
				}
				let opacity = 1;
				for (
					let current: Element | null = painted;
					current && current !== document.documentElement;
					current = current.parentElement
				) {
					opacity *= Number(getComputedStyle(current).opacity || '1');
				}
				strongest = Math.max(strongest, opacity);
			}
			return strongest;
		},
		[SHOW_STAGE, MORPH_OVERLAY, elementId] as const,
	);
}

/**
 * The viewport rectangle of the whole wording block, measured from the settled
 * title's own box (the panel keeps all three text boxes stacked under it).
 * Call with the morph scrubbed to its end, where every element is in place.
 */
async function bandOf(page: Page): Promise<{
	x: number;
	y: number;
	width: number;
	height: number;
}> {
	const band = await page.evaluate(
		([stage, id]) => {
			const node = document.querySelector(`${stage} [data-element-id="${id}"]`);
			if (!node) {
				return null;
			}
			const rect = node.getBoundingClientRect();
			return {
				x: Math.round(rect.x),
				y: Math.round(rect.y),
				width: Math.round(rect.width),
				height: Math.round(rect.height * 4),
			};
		},
		[SHOW_STAGE, WORDING.title.in] as const,
	);
	expect(band, 'the arriving wording must settle on screen').not.toBeNull();
	return band!;
}

test.describe('issue #160 - replaced wording crossfades', () => {
	for (const [name, ids] of Object.entries(WORDING)) {
		test(`the ${name} is a crossfade, not a fade out then in`, async ({ page }) => {
			await startShowOnTopicSlide(page);
			await clickWedgeAndFreezeMorph(page);

			// PowerPoint's own render holds old + new at a constant total of 1.000
			// for the whole transition. Ours rides one measured curve and its
			// complement, so the sum is exact; the tolerance is for rounding and
			// for a binding that also animates an ancestor.
			for (const fraction of [0.3, 0.5, 0.7]) {
				await scrubTo(page, fraction);
				const [outgoing, incoming] = [
					await paintedOpacity(page, ids.out),
					await paintedOpacity(page, ids.in),
				];
				expect(
					outgoing,
					`the old ${name} must still be painting at ${fraction * 100}%`,
				).toBeGreaterThan(0.05);
				expect(
					incoming,
					`the new ${name} must already be painting at ${fraction * 100}%`,
				).toBeGreaterThan(0.05);
				expect(
					outgoing + incoming,
					`the two halves of the ${name} must sum to one at ${fraction * 100}%`,
				).toBeGreaterThan(0.85);
			}
		});
	}

	test('the arriving wording is really painted, not just animated', async ({ page }) => {
		// An element can carry a perfect dissolve and be painted by nobody: the
		// overlay is a flat layer above the stage, and this panel's unchanged disc
		// is one of the ghosts it paints, opaque, for the whole morph. Pairing the
		// wording (which is the fix) also took it out of the set of ARRIVALS the
		// overlay lifts above that disc, and it went straight back to being
		// invisible until the overlay came down - while passing every opacity
		// assertion above, and any comparison against a "settled" frame that is
		// itself taken with the overlay still up.
		//
		// So this measures INK, with no reference frame at all: type on the panel
		// gives the band a spread of luminance that a bare disc does not have.
		await startShowOnTopicSlide(page);
		await clickWedgeAndFreezeMorph(page);

		await scrubTo(page, 1);
		const clip = await bandOf(page);
		const frames: Buffer[] = [];
		for (const fraction of [0, 0.5, 0.9, 1]) {
			await scrubTo(page, fraction);
			frames.push(await page.screenshot({ clip }));
		}

		const scratch = await page.context().newPage();
		const [start, middle, late, end] = await Promise.all(
			frames.map((png) => inkSpread(scratch, png)),
		);
		await scratch.close();

		expect(start, 'the outgoing wording must be on screen at 0%').toBeGreaterThan(8);
		expect(middle, 'the panel must still carry wording halfway through').toBeGreaterThan(
			start * 0.5,
		);
		expect(late, 'the arriving wording must be painted at 90%').toBeGreaterThan(start * 0.7);
		expect(end, 'the arriving wording must be painted when the morph lands').toBeGreaterThan(
			start * 0.8,
		);
	});

	test('the panel is never blank mid-morph', async ({ page }) => {
		await startShowOnTopicSlide(page);
		await clickWedgeAndFreezeMorph(page);

		await scrubTo(page, 1);
		const clip = await bandOf(page);

		// The old wording used to be gone by 23% and the new one to start at 42%,
		// so this window was a still frame of an empty panel. A crossfade is
		// moving throughout it.
		await scrubTo(page, 0.28);
		const early = await page.screenshot({ clip });
		await scrubTo(page, 0.38);
		const later = await page.screenshot({ clip });

		const scratch = await page.context().newPage();
		const changed = await meanDiff(scratch, early, later);
		await scratch.close();
		expect(
			changed,
			'the wording must keep changing through the middle of the morph',
		).toBeGreaterThan(1);
	});
});

/**
 * How much ink a band carries: the standard deviation of its luminance.
 *
 * A reference-free measure of "is there type here". The panel behind the
 * wording is a flat dark disc, so an empty one reads near zero however the
 * transition got it there, while any wording - old, new, or both at half
 * strength - spreads the histogram.
 */
async function inkSpread(scratch: Page, png: Buffer): Promise<number> {
	return scratch.evaluate(async (base64) => {
		const image = await new Promise<HTMLImageElement>((res, rej) => {
			const img = new Image();
			img.onload = () => {
				res(img);
			};
			img.onerror = rej;
			img.src = `data:image/png;base64,${base64}`;
		});
		const w = 200;
		const h = 120;
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const context = canvas.getContext('2d', { willReadFrequently: true })!;
		context.drawImage(image, 0, 0, w, h);
		const pixels = context.getImageData(0, 0, w, h).data;
		let sum = 0;
		let sumSquares = 0;
		for (let p = 0; p < pixels.length; p += 4) {
			const luma = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
			sum += luma;
			sumSquares += luma * luma;
		}
		const count = pixels.length / 4;
		const mean = sum / count;
		return Math.sqrt(Math.max(sumSquares / count - mean * mean, 0));
	}, png.toString('base64'));
}

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
			const w = 200;
			const h = 120;
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
