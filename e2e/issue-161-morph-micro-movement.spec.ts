/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Issue #161: a shape a morph is not supposed to touch must not move.
 *
 * Jumping between two of this deck's topic slides, the reporter watched the
 * centre panel - a disc, three lines of wording and an "Explore solution"
 * button - shift and resize by about a pixel for the length of the transition
 * and snap back the moment it ended. The disc and the button are byte-identical
 * on both slides, so nothing about them should have been animated at all.
 *
 * They were. The overlay paints a ghost of every outgoing shape drawn over a
 * crossfading backdrop (issue #131), and each ghost carried keyframes - even
 * one whose from-frame and to-frame were the same identity transform. A running
 * animation is not free: the browser gives the shape its own compositing layer
 * and rasterises that layer on whole device pixels, so a box at a fractional
 * position or size is painted up to a pixel smaller and offset until the
 * animation is removed. Measured on the button: 1.2px narrower, 1px shorter.
 *
 * The fix is to paint an inert pair's ghost STATICALLY - it is a pixel-perfect
 * stand-in for the element underneath, so it needs no animation - while still
 * painting it, since it is what keeps the dissolving backdrop from showing
 * through (issue #144 / #146 are the failure modes of dropping it).
 *
 * This measures both halves of that:
 *   1. the copy a viewer actually sees carries no animation, and
 *   2. its painted EDGES land on the same sub-pixel position they occupy on the
 *      settled slide, which is the reporter's symptom stated physically.
 *
 * The morph is frozen and scrubbed rather than sampled in real time - the show
 * runs it in 1s, far too tight to screenshot reliably.
 *
 * Run: bunx playwright test issue-161-morph-micro-movement
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const deck = resolve(fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)));

/** The 5 MB deck embeds a video; give the parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/** A topic slide, and the wedge on its wheel hyperlinked to the next one. */
const TOPIC_SLIDE = 7;
const NEXT_TOPIC_WEDGE = 'ppt/slides/slide7.xml-shape-1';

/**
 * The "Explore solution" button inside the centre panel's group: identical
 * geometry, fill and wording on both slides, and the shape whose 1px resize the
 * reporter measured. Its high-contrast orange on the panel's dark disc is what
 * makes a sub-pixel edge readable.
 */
const BUTTON = {
	out: 'ppt/slides/slide7.xml-group-0-shape-1',
	in: 'ppt/slides/slide8.xml-group-0-shape-1',
} as const;

/** The panel's disc, also identical on both slides. */
const DISC = {
	out: 'ppt/slides/slide7.xml-group-0-shape-0',
	in: 'ppt/slides/slide8.xml-group-0-shape-0',
} as const;

/**
 * The running show's own stage. Scoping to it is not optional: the editor
 * canvas and the slide rail stay mounted behind the show and carry the SAME
 * element ids at their own scale.
 */
const SHOW_STAGE = '[data-pptx-presenting]';

/** The transition's own layer, which not every binding mounts inside the stage. */
const MORPH_OVERLAY = '[data-pptx-transition-overlay]';

/** Padding around the measured shape, so both its edges and some backdrop are in frame. */
const CLIP_PAD = 6;

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
	// Park the pointer off the wheel: a hovered wedge repaints, and every frame
	// this spec compares has to differ only in what the morph did.
	await page.mouse.move(4, 4);
	await page.waitForTimeout(400);
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
	expect(spot, 'the next topic wedge must be on screen').not.toBeNull();
	await page.mouse.click(spot!.x, spot!.y);

	await page.locator(MORPH_OVERLAY).first().waitFor({ timeout: 5_000 });
	await page.mouse.move(4, 4);
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
 * wait for the frame that paints it.
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

/** Every copy of an element on screen right now, with what is animating it. */
async function copiesOf(
	page: Page,
	elementId: string,
): Promise<{ opacity: number; animation: string }[]> {
	return page.evaluate(
		([stage, overlay, id]) => {
			const escaped = id.replace(/"/gu, '\\"');
			// The address of a copy differs by binding: four re-render the ghost as
			// an ordinary slide element and keep its `data-element-id`; React
			// deliberately does not expose the id twice and marks its overlay copies
			// with `data-pptx-morph-outgoing` / `-lifted` instead.
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
			const out: { opacity: number; animation: string }[] = [];
			for (const node of nodes) {
				// The wrapper a binding stamps the marker on is not always the node
				// carrying the animation, so take the whole subtree's names.
				const subtree = [node, ...node.querySelectorAll('*')];
				const names = subtree
					.map((candidate) => getComputedStyle(candidate).animationName)
					.filter((name) => name.includes('pptx-morph'));
				const painted = subtree.find((candidate) =>
					getComputedStyle(candidate).animationName.includes('pptx-morph'),
				);
				let opacity = 1;
				for (
					let current: Element | null = painted ?? node;
					current && current !== document.documentElement;
					current = current.parentElement
				) {
					opacity *= Number(getComputedStyle(current).opacity || '1');
				}
				const rect = (painted ?? node).getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) {
					continue;
				}
				out.push({ opacity, animation: names.join(' ') });
			}
			return out;
		},
		[SHOW_STAGE, MORPH_OVERLAY, elementId] as const,
	);
}

/** The viewport rectangle to sample an element in, padded so its edges are inside. */
async function clipOf(
	page: Page,
	elementId: string,
): Promise<{
	x: number;
	y: number;
	width: number;
	height: number;
}> {
	const clip = await page.evaluate(
		([stage, id]) => {
			const node = document.querySelector(`${stage} [data-element-id="${id}"]`);
			if (!node) {
				return null;
			}
			const rect = node.getBoundingClientRect();
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		},
		[SHOW_STAGE, elementId] as const,
	);
	expect(clip, 'the measured shape must be on screen').not.toBeNull();
	return {
		x: Math.floor(clip!.x) - CLIP_PAD,
		y: Math.floor(clip!.y) - CLIP_PAD,
		width: Math.ceil(clip!.width) + CLIP_PAD * 2,
		height: Math.ceil(clip!.height) + CLIP_PAD * 2,
	};
}

/**
 * Where a filled shape's four edges fall inside a crop, to a fraction of a
 * pixel.
 *
 * The crop is a bright shape on a dark surround, so the mid-luminance crossing
 * along the centre row and column IS the edge, and interpolating between the
 * two samples either side of it resolves the antialiased boundary far finer
 * than the pixel grid. Comparing the same four numbers before and during the
 * morph asks the reporter's question directly: did it move, did it resize.
 */
async function edgesOf(scratch: Page, png: Buffer): Promise<[number, number, number, number]> {
	return scratch.evaluate(async (base64) => {
		const image = await new Promise<HTMLImageElement>((res, rej) => {
			const img = new Image();
			img.onload = () => {
				res(img);
			};
			img.onerror = rej;
			img.src = `data:image/png;base64,${base64}`;
		});
		const canvas = document.createElement('canvas');
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) {
			throw new Error('no 2d canvas context');
		}
		ctx.drawImage(image, 0, 0);
		const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const lum = (x: number, y: number): number => {
			const i = (y * width + x) * 4;
			return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
		};
		// A scan line's crossings of the half-way level between its darkest and
		// brightest sample: the first going up, the last coming down.
		const crossings = (sample: (i: number) => number, count: number): [number, number] => {
			let min = Infinity;
			let max = -Infinity;
			for (let i = 0; i < count; i++) {
				const v = sample(i);
				min = Math.min(min, v);
				max = Math.max(max, v);
			}
			const level = (min + max) / 2;
			const at = (i: number): number => {
				const a = sample(i);
				const b = sample(i + 1);
				return b === a ? i : i + (level - a) / (b - a);
			};
			let first = NaN;
			let last = NaN;
			for (let i = 0; i < count - 1; i++) {
				const rising = sample(i) < level && sample(i + 1) >= level;
				const falling = sample(i) >= level && sample(i + 1) < level;
				if (rising && Number.isNaN(first)) {
					first = at(i);
				}
				if (falling) {
					last = at(i);
				}
			}
			return [first, last];
		};
		const row = Math.floor(height / 2);
		const column = Math.floor(width / 2);
		const [left, right] = crossings((x) => lum(x, row), width);
		const [top, bottom] = crossings((y) => lum(column, y), height);
		return [left, right, top, bottom] as [number, number, number, number];
	}, png.toString('base64'));
}

/**
 * How far the four edges moved. A compositing-rounded layer shifts a whole
 * edge at once, so the worst single edge is the number that matters.
 */
function worstShift(
	before: readonly [number, number, number, number],
	during: readonly [number, number, number, number],
): number {
	return Math.max(...before.map((value, index) => Math.abs(value - during[index])));
}

test.describe('issue #161 - an unchanged shape does not drift during a morph', () => {
	for (const [name, ids] of Object.entries({ button: BUTTON, disc: DISC })) {
		test(`the ${name} is painted by a copy that is not animated`, async ({ page }) => {
			await startShowOnTopicSlide(page);
			await clickWedgeAndFreezeMorph(page);
			await scrubTo(page, 0.5);

			const copies = [...(await copiesOf(page, ids.out)), ...(await copiesOf(page, ids.in))];
			const visible = copies.filter((copy) => copy.opacity > 0.5);

			// Dropping the ghost is NOT a fix: something has to paint the shape, or
			// the dissolving backdrop below shows through where it should be
			// (issues #144 and #146 are exactly that failure).
			expect(visible.length, `the ${name} must still be painted mid-morph`).toBeGreaterThan(0);
			for (const copy of visible) {
				expect(
					copy.animation,
					`the visible ${name} must carry no morph animation, which would composite it`,
				).toBe('');
			}
		});
	}

	test("the button's edges hold their sub-pixel position through the morph", async ({ page }) => {
		// The button is the shape to measure this on: a saturated fill on the
		// panel's flat dark disc, so its boundary is a clean luminance step that
		// resolves to a fraction of a pixel. (The disc itself is measured only by
		// the animation test above - it fills its own crop, so there is no
		// surround to read an edge against.)
		await startShowOnTopicSlide(page);
		const clip = await clipOf(page, BUTTON.out);
		const settled = await page.screenshot({ clip });

		await clickWedgeAndFreezeMorph(page);

		const frames: Buffer[] = [];
		for (const fraction of [0, 0.5, 1]) {
			await scrubTo(page, fraction);
			frames.push(await page.screenshot({ clip }));
		}

		const scratch = await page.context().newPage();
		const reference = await edgesOf(scratch, settled);
		const measured = await Promise.all(frames.map((png) => edgesOf(scratch, png)));
		await scratch.close();

		// The crop must actually contain an edge, or every comparison below is
		// vacuous.
		for (const value of reference) {
			expect(Number.isFinite(value), 'the button must show an edge to measure').toBeTruthy();
		}
		// The defect measured 1.17px (React) to 1.55px (Vue) on this shape. What
		// is left is a static sub-quarter-pixel difference between where the
		// overlay's slide box and the stage's own land (0.00px on React, 0.26px on
		// the other four); it does not vary with the morph's progress, so it is
		// not something a viewer sees move.
		for (const [index, fraction] of [0, 0.5, 1].entries()) {
			expect(
				worstShift(reference, measured[index]),
				`the button must not move or resize at ${fraction * 100}% of the morph`,
			).toBeLessThan(0.5);
		}
	});
});
