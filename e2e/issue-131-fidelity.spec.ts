/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for issue #131, run identically against every framework
 * demo.
 *
 * The reporter re-tested the deck from issue #130
 * (`e2e/fixtures/solution-explorer.pptx`) and found five things still wrong.
 * Each `test` below pins one of them against what PowerPoint actually draws
 * (ground truth: the deck exported to PNG via COM), not against our previous
 * output:
 *
 *  1. Morph "wasn't working": every persisting shape was painted in its FINAL
 *     state on frame 1, so only a handful of genuinely new/departing shapes
 *     animated and the slide appeared to cut. The overlay now paints a moving
 *     copy of the outgoing slide, and restyled pairs crossfade.
 *  2. Text-body insets (`a:bodyPr/@lIns` and friends) were lost: React let the
 *     element-level hanging indent pull each first line back out through the
 *     padding, and Angular never applied the padding at all.
 *  3. An authored blank line between a heading and its bullet list collapsed to
 *     zero height, so the vertical spacing disappeared.
 *  4. The title-bar AutoSave toggle did nothing in React: the options-store
 *     sync effect re-ran on every render and reverted the flip.
 *  5. Text inside a scaled `p:grpSp` rendered ~21% small, because the loader
 *     scaled run font sizes by the group scale. PowerPoint scales grouped
 *     geometry only.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)),
);

/** 1-based slide numbers, named for what they demonstrate. */
const SLIDE = {
	/** First morph slide; also carries the scaled group with the centre text. */
	morphFirst: 3,
	/** Inset panel with heading / blank line / bullet list. */
	insetPanel: 13,
} as const;

/** The deck is 5 MB with a real video; give the initial parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(900);
}

/**
 * Metrics for the slide-13 inset panel ("Intervalla"), measured on the largest
 * rendered copy so a slide-rail thumbnail can never win.
 */
async function insetPanelMetrics(page: Page): Promise<{
	leftInsetPx: number;
	blankLineHeights: number[];
} | null> {
	return page.evaluate(() => {
		let host: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.textContent ?? '').includes('Intervalla')) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				host = node;
			}
		}
		if (!host) {
			return null;
		}
		const hostBox = host.getBoundingClientRect();
		// The panel is 262 authored px wide; normalise out the stage scale so the
		// assertions are in slide coordinates whatever the viewport.
		const scale = hostBox.width / 262;

		let glyphLeft = Number.POSITIVE_INFINITY;
		const blankLineHeights: number[] = [];
		for (const node of host.querySelectorAll<HTMLElement>('*')) {
			const box = node.getBoundingClientRect();
			const text = (node.textContent ?? '').trim();
			if (node.children.length === 0 && text.length > 0 && box.width > 0) {
				glyphLeft = Math.min(glyphLeft, box.left);
			}
			// An authored blank line renders as a paragraph whose only child is a
			// <br>: no text, but it must still occupy a line box.
			if (
				text.length === 0 &&
				node.children.length === 1 &&
				node.firstElementChild?.tagName === 'BR'
			) {
				blankLineHeights.push(box.height / scale);
			}
		}
		if (!Number.isFinite(glyphLeft)) {
			return null;
		}
		return { leftInsetPx: (glyphLeft - hostBox.left) / scale, blankLineHeights };
	});
}

test.describe('issue #131 - solution-explorer deck fidelity', () => {
	test('the authored text-body inset is painted, not cancelled by the hanging indent', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.insetPanel);

		// `<a:bodyPr lIns="180000" ...>` = 18.9px. The first bullet hangs at the
		// left edge of the CONTENT box, so the leftmost glyph must sit a full
		// inset in from the shape edge. It was rendering at ~0.
		const metrics = await insetPanelMetrics(page);
		expect(metrics, 'found the slide 13 inset panel').not.toBeNull();
		expect(metrics?.leftInsetPx ?? 0).toBeGreaterThan(12);
		expect(metrics?.leftInsetPx ?? 0).toBeLessThan(26);
	});

	test('an authored blank line keeps its line box', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.insetPanel);

		// The deck spaces each heading away from the bullets under it with an
		// empty `<a:p>`. Dropping those paragraphs (or rendering them with no
		// content) collapsed the gaps and ran the whole panel together.
		const metrics = await insetPanelMetrics(page);
		expect(metrics, 'found the slide 13 inset panel').not.toBeNull();
		const heights = metrics?.blankLineHeights ?? [];
		expect(heights.length, 'blank paragraphs are still rendered').toBeGreaterThan(2);
		for (const height of heights) {
			// A 10.5pt body default is a 14px font on a ~1.25 line box.
			expect(height, 'a blank paragraph occupies a line box').toBeGreaterThan(6);
			expect(height, 'a blank paragraph is only one line tall').toBeLessThan(30);
		}
	});

	test('text inside a scaled group keeps its authored point size', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.morphFirst);

		// Slide 3's centre block is a `p:grpSp` scaled to 0.79. PowerPoint scales
		// the child geometry only, so the heading stays 12pt = 16px; scaling the
		// font too rendered it at ~12.7px.
		const sizes = await page.evaluate(() => {
			const out: number[] = [];
			for (const node of document.querySelectorAll<HTMLElement>('*')) {
				if (node.children.length > 0) {
					continue;
				}
				if (!(node.textContent ?? '').includes('Secure Data Movement')) {
					continue;
				}
				const box = node.getBoundingClientRect();
				// Skip the slide-rail thumbnails and the wedge label of the same name.
				if (box.width < 60) {
					continue;
				}
				out.push(Number.parseFloat(getComputedStyle(node).fontSize));
			}
			return out;
		});

		expect(sizes.length, 'found the centre heading').toBeGreaterThan(0);
		// 16px authored; allow sub-pixel rounding but never the 0.79 group scale.
		expect(Math.max(...sizes)).toBeGreaterThan(15);
	});

	test('the AutoSave toggle actually toggles', async ({ page }) => {
		await loadDeck(page);

		const toggle = page.locator('[role="switch"]').first();
		await expect(toggle).toHaveCount(1);
		const before = await toggle.getAttribute('aria-checked');
		await toggle.click({ force: true });
		await expect
			.poll(async () => toggle.getAttribute('aria-checked'), {
				message: 'the AutoSave switch reflects the click',
				timeout: 5000,
			})
			.not.toBe(before);
		// ...and back again, so it is a toggle and not a one-way latch.
		await toggle.click({ force: true });
		await expect
			.poll(async () => toggle.getAttribute('aria-checked'), {
				message: 'the AutoSave switch toggles back',
				timeout: 5000,
			})
			.toBe(before);
	});

	test('a morph paints the outgoing slide and dissolves it into the incoming one', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.morphFirst);

		const slideShow = page.getByRole('button', { name: /^slide show$/iu });
		if ((await slideShow.count()) > 0) {
			await slideShow.last().click();
		} else {
			await page
				.getByRole('button', { name: /present/iu })
				.first()
				.click();
		}
		await page.waitForTimeout(900);
		await page.keyboard.press('PageDown');

		// Slides 3 and 4 are near-duplicates: same wheel, restyled highlight and
		// a different backdrop. Every persisting shape must therefore travel
		// (a `pptx-morph-*` animation on the incoming half) AND have an outgoing
		// ghost painted above the stage, or the slide simply cuts.
		// Bindings differ in WHICH node carries the animation: React puts the
		// outgoing ghost's `animation` on the overlay wrapper it renders around
		// the element, the others scope a rule to the `[data-element-id]` node
		// itself. Scanning every element keeps the assertion binding-neutral.
		const countAnimations = async (): Promise<{ incoming: number; ghosts: number }> =>
			page.evaluate(() => {
				const names: string[] = [];
				for (const node of document.querySelectorAll<HTMLElement>('*')) {
					const name = getComputedStyle(node).animationName;
					if (name.includes('pptx-morph')) {
						names.push(name);
					}
				}
				return {
					incoming: names.filter((name) => /pptx-morph-\d/u.test(name)).length,
					ghosts: names.filter((name) => name.includes('pptx-morph-ghost')).length,
				};
			});

		await expect
			.poll(async () => (await countAnimations()).ghosts, {
				message: 'the outgoing halves are painted above the stage and animated',
				timeout: 8000,
			})
			.toBeGreaterThan(0);
		expect(
			(await countAnimations()).incoming,
			'persisting shapes glide on the incoming slide',
		).toBeGreaterThan(0);
	});
});
