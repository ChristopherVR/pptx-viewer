/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

/**
 * Slide-show fidelity against a REAL PowerPoint deck (issue #106).
 *
 * `anatidae-animation.pptx` was authored in PowerPoint and reported by a user,
 * and it exercises four things a synthetic fixture never did:
 *
 *  1. Its opening click step carries the indefinite gate AND an `onBegin` tie to
 *     the main sequence, i.e. "With Previous" as the first effect on the slide.
 *     It must animate on slide entry, with NO click. The whole deck used to
 *     render its title and credit line hidden until the viewer clicked.
 *  2. Both effects live in one wrapper `p:par`, so their `@delay`s (1s and 2s)
 *     are offsets from the wrapper, not a chain: the credit line starts at 2s,
 *     not at 3.4s.
 *  3. Both carry `p:iterate type="lt"`, so each reveals letter by letter - the
 *     credit line does so even though its `p:bldP` says "by paragraph".
 *  4. Its full-bleed backdrop is `<p:sp useBgFill="1">` over a white slide
 *     background while ALSO carrying an `a:fillRef` to `accent1`. Honouring only
 *     the style reference painted the panel blue.
 *
 * Every assertion below reads the rendered DOM through the framework-neutral
 * contract (`#file-input`, `[data-element-id]`, `[data-anim-id]`), so the same
 * spec runs against all five bindings.
 */

const deck = resolve(fileURLToPath(new URL('./fixtures/anatidae-animation.pptx', import.meta.url)));

/** The deck's authored timings, read straight from its `p:timing`. */
const TITLE_DELAY_MS = 1000;
const CREDIT_DELAY_MS = 2000;
/** Each effect's own duration; the iterate stagger is 10% of it. */
const EFFECT_DURATION_MS = 400;

/** Load the fixture into the demo and wait for the first slide to paint. */
async function loadDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[data-pptx-element="true"], [data-element-id]').first().waitFor();
	await page.waitForTimeout(600);
}

/** Start the slide show from the demo's Present control. */
async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
}

/**
 * The CSS `animation` shorthand of every staged text-build piece on screen,
 * keyed by its sub-animation id (`<elementId>::c0-7`).
 */
async function buildPieces(page: Page): Promise<Record<string, string>> {
	return page.evaluate(() => {
		const out: Record<string, string> = {};
		for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-anim-id]'))) {
			const id = el.dataset.animId;
			if (id) {
				out[id] = el.style.animation;
			}
		}
		return out;
	});
}

/** Parse the delay (ms) out of a CSS `animation` shorthand. */
function delayOf(shorthand: string | undefined): number | undefined {
	const matches = shorthand?.match(/(\d+)ms/gu);
	// The shorthand is `<duration>ms <easing> <delay>ms ...`; take the second.
	return matches && matches.length >= 2 ? Number.parseInt(matches[1], 10) : undefined;
}

/** Pieces belonging to one shape, in document order. */
function piecesFor(pieces: Record<string, string>, shapeSuffix: string): string[] {
	return Object.entries(pieces)
		.filter(([id]) => id.includes(shapeSuffix))
		.map(([, shorthand]) => shorthand);
}

test.describe('anatidae deck: real-PowerPoint slide-show fidelity', () => {
	test('opening builds play on slide entry, with no click', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);
		// Sampled inside the title's own 1s delay: the pieces must already be
		// mounted and scheduled, which is what "no click needed" looks like.
		await page.waitForTimeout(400);

		const pieces = await buildPieces(page);
		const ids = Object.keys(pieces);
		expect(ids.length).toBeGreaterThan(50);
		expect(ids.every((id) => pieces[id].length > 0)).toBeTruthy();
	});

	test('the two effects keep their authored offsets instead of chaining', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);
		await page.waitForTimeout(400);

		const pieces = await buildPieces(page);
		const delays = Object.values(pieces)
			.map(delayOf)
			.filter((value): value is number => value !== undefined)
			.sort((left, right) => left - right);

		// The title's first letter is the earliest thing on the slide.
		expect(delays[0]).toBe(TITLE_DELAY_MS);
		// The credit line starts at its own 2s offset. Chaining it off the end of
		// the title's ripple would push it past 3.4s.
		expect(delays).toContain(CREDIT_DELAY_MS);
		const beforeCredit = delays.filter((value) => value < CREDIT_DELAY_MS);
		expect(beforeCredit.length).toBeGreaterThan(0);
	});

	test('both shapes reveal letter by letter', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);
		await page.waitForTimeout(400);

		const pieces = await buildPieces(page);
		// Per-character ids are `::c<paragraph>-<index>`.
		const charIds = Object.keys(pieces).filter((id) => /::c\d+-\d+$/u.test(id));
		expect(charIds.length).toBeGreaterThan(100);

		// Two distinct shapes animate, and each has many characters: the credit
		// line used to arrive as one block because its `p:bldP` said "by paragraph"
		// and the effect's `p:iterate type="lt"` was ignored.
		const shapes = new Set(charIds.map((id) => id.split('::')[0]));
		expect(shapes.size).toBe(2);
		for (const shape of shapes) {
			expect(piecesFor(pieces, `${shape}::c`).length).toBeGreaterThan(20);
		}
	});

	test('the letters ripple rather than arriving together', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);
		await page.waitForTimeout(400);

		const pieces = await buildPieces(page);
		const titleDelays = Object.entries(pieces)
			.filter(([id]) => /::c0-\d+$/u.test(id))
			.map(([, shorthand]) => delayOf(shorthand))
			.filter((value): value is number => value !== undefined);

		const distinct = new Set(titleDelays);
		expect(distinct.size).toBeGreaterThan(10);
		// The stagger is 10% of the effect duration, so consecutive letters differ.
		expect(Math.max(...titleDelays)).toBeGreaterThan(TITLE_DELAY_MS + EFFECT_DURATION_MS / 10);
	});

	test('a useBgFill backdrop paints the slide background, not the theme accent', async ({
		page,
	}) => {
		await loadDeck(page);

		// The full-bleed panel is the deck's first shape. Its slide background is
		// white; the `a:fillRef` it also carries points at the blue accent.
		// Scoped to the main canvas: in two bindings the document-order-first
		// `[data-element-id]` is the THUMBNAIL rail's copy of the shape, which
		// could keep this green even if the canvas mispainted.
		const fill = await page.evaluate(() => {
			const box = document.querySelector<HTMLElement>('[data-pptx-viewport] [data-element-id]');
			return box ? getComputedStyle(box).backgroundColor : '';
		});
		expect(fill).toBe('rgb(255, 255, 255)');
	});

	test('stepping back onto a slide shows its builds already complete', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);
		// Let slide 1 finish building before leaving it.
		await page.waitForTimeout(7000);

		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(1200);
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(900);

		const pieces = await buildPieces(page);
		const shorthands = Object.values(pieces);
		expect(shorthands.length).toBeGreaterThan(50);
		// Fully built and static: PowerPoint does not replay a slide you step back
		// onto. Every piece is visible with no animation attached.
		expect(shorthands.every((value) => value === '')).toBeTruthy();

		const hidden = await page.evaluate(
			() =>
				Array.from(document.querySelectorAll<HTMLElement>('[data-anim-id]')).filter(
					(el) => el.style.visibility === 'hidden',
				).length,
		);
		expect(hidden).toBe(0);
	});

	test('a further back press replays the slide from the start', async ({ page }) => {
		await loadDeck(page);
		await startShow(page);
		await page.waitForTimeout(7000);

		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(1200);
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(900);
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(400);

		const pieces = await buildPieces(page);
		const animating = Object.values(pieces).filter((value) => value.length > 0);
		expect(animating.length).toBeGreaterThan(50);
	});
});
