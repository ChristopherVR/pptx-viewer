/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Native staged-build + colour-animation PLAYBACK coverage, run identically
 * against every framework demo.
 *
 * The fixture (`animation-builds-color.pptx`) is authored by real PowerPoint
 * (COM) so it carries authentic `p:timing` markup the SDK cannot emit:
 *  - slide 1: a chart entrance built BY SERIES  (`a:bldChart bld="series"`)
 *  - slide 2: a SmartArt entrance built BY NODE (`a:bldDgm  bld="one"`)
 *  - slide 3: a shape fill-colour emphasis      (`p:animClr` -> `fillcolor`)
 *
 * All five bindings now play these through the shared native-timing engine
 * (`PresentationAnimationController`). This spec proves two observable
 * contracts in the live slideshow:
 *  1. the chart's build entrance stays hidden until its click-group is
 *     revealed, then plays (a real CSS animation runs);
 *  2. advancing onto the colour-emphasis shape runs a colour animation - the
 *     construct that, before the `p:attrName` parse fix, never fired for any
 *     real deck.
 *
 * Flakiness posture matches `animations-transitions.spec.ts`: timing-sensitive
 * assertions use `expect.poll`, never a fixed `waitForTimeout` on the pass/fail
 * path, and navigation advances until an anchor title is visible rather than
 * counting keypresses.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/animation-builds-color.pptx', import.meta.url)),
);

const TITLE = {
	chart: 'Chart Build Slide',
	color: 'Color Emphasis Slide',
} as const;
const SHAPE_TEXT = 'COLOR ME';

/**
 * The largest on-screen `[data-element-id]` match - the live presentation stage
 * render, never a smaller slide-thumbnail duplicate or an off-to-the-side
 * editor canvas. Copied from `animations-transitions.spec.ts` (same rationale).
 */
async function primaryMatch(page: Page, locator: Locator, minAreaPx = 5000): Promise<Locator> {
	const viewport = page.viewportSize();
	const token = `primary-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const found = await locator.evaluateAll(
		(elements, args) => {
			let best: Element | undefined;
			let bestArea = -1;
			for (const element of elements) {
				const box = element.getBoundingClientRect();
				const onScreen =
					!args.viewport ||
					(box.right > 0 &&
						box.left < args.viewport.width &&
						box.bottom > 0 &&
						box.top < args.viewport.height);
				const area = box.width * box.height;
				if (onScreen && area >= args.minAreaPx && area > bestArea) {
					best = element;
					bestArea = area;
				}
			}
			best?.setAttribute('data-e2e-primary-match', args.token);
			return Boolean(best);
		},
		{ viewport, minAreaPx, token },
	);
	return found
		? page.locator(`[data-e2e-primary-match="${token}"]`)
		: page.locator(`[data-e2e-primary-match="${token}-missing"]`);
}

async function enterPresentation(page: Page): Promise<void> {
	const slideShowButtons = page.getByRole('button', { name: /^slide show$/iu });
	if ((await slideShowButtons.count()) > 0) {
		await slideShowButtons.last().click();
		return;
	}
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.click();
}

async function openInPresentMode(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[data-element-id]').filter({ hasText: TITLE.chart }).first().waitFor();
	await enterPresentation(page);
	await page.waitForTimeout(700);
}

async function advance(page: Page): Promise<void> {
	await page.keyboard.press('PageDown');
}

/** The live, on-screen node carrying `text`. */
async function liveNode(page: Page, text: string): Promise<Locator> {
	return primaryMatch(page, page.locator('[data-element-id]').filter({ hasText: text }));
}

/** Advance until the slide carrying `title` is the live render (bounded). */
async function advanceToSlide(page: Page, title: string): Promise<void> {
	for (let i = 0; i < 8; i++) {
		const node = await liveNode(page, title);
		if (await node.isVisible().catch(() => false)) {
			return;
		}
		await advance(page);
		await page.waitForTimeout(250);
	}
}

test.describe('staged chart build playback', () => {
	test('chart entrance is hidden until revealed, then plays', async ({ page }) => {
		await openInPresentMode(page);
		await expect(await liveNode(page, TITLE.chart)).toBeVisible();

		// The chart is the largest element on slide 1 (the title text box is far
		// smaller). Its build entrance keeps it hidden before the first click.
		const chart = await primaryMatch(page, page.locator('[data-element-id]'), 20000);
		await expect
			.poll(() =>
				chart.evaluate((el) => {
					const style = getComputedStyle(el);
					return style.visibility === 'hidden' || style.opacity === '0';
				}),
			)
			.toBe(true);

		// The next click reveals the build click-group and the chart plays.
		await advance(page);
		await expect
			.poll(() => chart.evaluate((el) => getComputedStyle(el).visibility))
			.toBe('visible');
		await expect
			.poll(() => chart.evaluate((el) => getComputedStyle(el).animationName))
			.not.toBe('none');
	});
});

test.describe('colour emphasis (animClr) playback', () => {
	test('advancing onto the colour-emphasis shape runs a colour animation', async ({ page }) => {
		await openInPresentMode(page);
		await advanceToSlide(page, TITLE.color);
		await expect(await liveNode(page, TITLE.color)).toBeVisible();

		// The shape is an emphasis target: visible from the start, no animation yet.
		await expect(await liveNode(page, SHAPE_TEXT)).toBeVisible();

		// The next click plays the fill-colour emphasis: a CSS animation runs on
		// the shape wrapper (the `p:animClr` colour keyframe). Regression guard for
		// the target-attribute parse fix - this never fired for real decks before.
		//
		// Re-query the shape inside the poll rather than capturing it up front:
		// Vanilla replaces the shape wrapper wholesale when the emphasis begins, so
		// a pre-captured node handle goes stale. Among all matches, read the
		// largest (the live stage render, not a thumbnail-rail duplicate).
		await advance(page);
		const shapeMatches = page.locator('[data-element-id]').filter({ hasText: SHAPE_TEXT });
		await expect
			.poll(
				() =>
					shapeMatches.evaluateAll((els) => {
						let best = 'none';
						let bestArea = -1;
						for (const el of els) {
							const box = el.getBoundingClientRect();
							const area = box.width * box.height;
							if (area > bestArea) {
								bestArea = area;
								best = getComputedStyle(el).animationName;
							}
						}
						return best;
					}),
				{ timeout: 5000 },
			)
			.not.toBe('none');
	});
});
