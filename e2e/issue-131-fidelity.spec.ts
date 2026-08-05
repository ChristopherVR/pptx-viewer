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

	test('a slide jumped to from an on-slide hyperlink still morphs', async ({ page }) => {
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

		// This deck is a menu: every wheel wedge is a hyperlink to its topic
		// slide, so clicking one is the ONLY way most of it is ever navigated.
		// React treated a jump as transition-less, so the deck's own navigation
		// never morphed while PageDown did (issue #131). Addressed by the
		// core-assigned element id, which every binding stamps identically.
		const wedge = page
			.locator('[data-element-id="ppt/slides/slide3.xml-shape-19"]')
			.filter({ hasText: 'Training' })
			.last();
		await expect(wedge).toHaveCount(1);
		const box = await wedge.boundingBox();
		expect(box, 'the wedge hyperlink is on screen').not.toBeNull();
		await page.mouse.click(
			(box?.x ?? 0) + (box?.width ?? 0) / 2,
			(box?.y ?? 0) + (box?.height ?? 0) / 2,
		);

		await expect
			.poll(
				async () =>
					page.evaluate(() => {
						let n = 0;
						for (const node of document.querySelectorAll<HTMLElement>('*')) {
							if (getComputedStyle(node).animationName.includes('pptx-morph')) {
								n += 1;
							}
						}
						return n;
					}),
				{ message: 'the jump plays the destination slide transition', timeout: 8000 },
			)
			.toBeGreaterThan(0);
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

	// ── Issue #131, follow-up report (2026-07-30 comment) ────────────────────
	//
	// The reporter's annotated slide-13 comparison called out three remaining
	// defects, all reproduced and fixed against PowerPoint ground truth (COM
	// `TextRange2` line bounds; single-spaced lines are exactly 1.2x the font
	// size, and a blank paragraph takes its `a:endParaRPr` size):
	//  - "Tiny/significant indent after first line": the bullet marker was an
	//    inline glyph, so the first line's text started right after it instead
	//    of on the `marL` indent stop where the wrapped lines sit.
	//  - "Gap (much) bigger" after headings: blank paragraphs rendered on the
	//    body-default strut instead of their authored `endParaRPr` size, and
	//    the default line-height was the browser-ish 1.25 instead of
	//    PowerPoint's 1.2, so the error accumulated down the panel.

	/** Line-start x positions (client px) for the first two lines of the
	 * paragraph containing `needle`, plus the panel host box. */
	async function paragraphLineStarts(
		page: Page,
		needle: string,
	): Promise<{ hostWidth: number; lineLefts: number[]; lineTops: number[] } | null> {
		return page.evaluate((marker) => {
			let host: HTMLElement | undefined;
			let bestArea = 0;
			for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
				if (!(node.textContent ?? '').includes(marker)) {
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
			// Walk the paragraph's text character by character; a jump in the
			// rect top starts a new visual line. Neutral across bindings: only
			// text nodes and Ranges, no per-framework DOM structure.
			const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
			const lineLefts: number[] = [];
			const lineTops: number[] = [];
			let started = false;
			let prevTop: number | null = null;
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				const text = n.textContent ?? '';
				if (!started && !text.includes(marker.slice(0, 12))) {
					continue;
				}
				started = true;
				const range = document.createRange();
				for (let i = 0; i < text.length; i++) {
					range.setStart(n, i);
					range.setEnd(n, i + 1);
					const rect = range.getBoundingClientRect();
					if (rect.width === 0 && rect.height === 0) {
						continue;
					}
					if (prevTop === null || rect.top - prevTop > 3) {
						lineLefts.push(rect.left - hostBox.left);
						lineTops.push(rect.top - hostBox.top);
						prevTop = rect.top;
					}
				}
				if (lineLefts.length >= 2) {
					break;
				}
			}
			return { hostWidth: hostBox.width, lineLefts, lineTops };
		}, needle);
	}

	test('a hanging bullet tabs its first line to the indent stop (marL), aligned with wrapped lines', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.insetPanel);

		// "Naturam grata delectant..." wraps to 3 lines. PowerPoint starts the
		// FIRST line's text at `marL` (the same x the wrapped lines start at);
		// the marker fills the hang. Rendering the marker as a plain inline
		// glyph put the first line's text ~7px left of its own wrapped lines
		// ("tiny indent after first line" in the reporter's annotation) and
		// gave the first line extra width, wrapping it one word later than
		// PowerPoint.
		const starts = await paragraphLineStarts(page, 'Naturam');
		expect(starts, 'found the Naturam paragraph').not.toBeNull();
		const scale = (starts?.hostWidth ?? 262) / 301.29;
		const lefts = starts?.lineLefts ?? [];
		expect(lefts.length, 'paragraph wraps to at least two lines').toBeGreaterThanOrEqual(2);
		// First line = the marker at marL+indent; its TEXT box is the second
		// caret stop... the first caret rect is the marker glyph itself, which
		// PowerPoint also draws at the content-left edge. What must line up is
		// line 2+ against the first line's TEXT. The marker occupies the full
		// 18px hang, so first-line text x == marL == wrapped-line x. In client
		// px both sit at (18.9 inset + 18 marL) * scale from the host edge.
		const expectedTextX = (18.9 + 18) * scale;
		expect(
			Math.abs(lefts[1] - expectedTextX),
			`wrapped line starts on the marL indent stop (got ${lefts[1]}, want ~${expectedTextX})`,
		).toBeLessThan(3 * scale + 1.5);
		// The annotated defect itself: first-line text no longer sits left of
		// its own wrapped lines.
		expect(
			Math.abs(lefts[0] - lefts[1]),
			`first-line text aligns with the wrapped lines (first ${lefts[0]}, wrapped ${lefts[1]})`,
		).toBeLessThan(2.5);
	});

	/** Visual line texts inside the panel containing `needle` (largest copy). */
	async function panelLineTexts(page: Page, needle: string): Promise<string[]> {
		return page.evaluate((marker) => {
			let host: HTMLElement | undefined;
			let bestArea = 0;
			for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
				if (!(node.textContent ?? '').includes(marker)) {
					continue;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height > bestArea) {
					bestArea = box.width * box.height;
					host = node;
				}
			}
			if (!host) {
				return [];
			}
			const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
			const lines: string[] = [];
			let current = '';
			let prevTop: number | null = null;
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				const text = n.textContent ?? '';
				const range = document.createRange();
				for (let i = 0; i < text.length; i++) {
					range.setStart(n, i);
					range.setEnd(n, i + 1);
					const rect = range.getBoundingClientRect();
					if (rect.width === 0 && rect.height === 0) {
						continue;
					}
					if (prevTop === null) {
						prevTop = rect.top;
					} else if (rect.top - prevTop > 3) {
						lines.push(current);
						current = '';
						prevTop = rect.top;
					}
					current += text[i];
				}
			}
			if (current) {
				lines.push(current);
			}
			return lines;
		}, needle);
	}

	test('a knife-edge bullet wraps where PowerPoint wraps it, not a word later', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.insetPanel);

		// COM ground truth (`TextRange.Lines`): the first bullet of the slide-13
		// panel breaks after "compositis" ("Summis solido quantus compositis /
		// synephebos acuti ruant."). PowerPoint's GDI-compatible metrics measure
		// the line ~0.5% wider than the browser's fractional advances, so without
		// the shared per-run tracking (POWERPOINT_METRIC_TRACKING) the browser
		// squeezed "synephebos" onto the first line and the paragraph wrapped a
		// word later than PowerPoint (the reporter's last remaining slide-13
		// delta on issue #131).
		const lines = await panelLineTexts(page, 'Summis');
		const firstIndex = lines.findIndex((line) => line.includes('Summis'));
		expect(firstIndex, 'found the Summis line').toBeGreaterThanOrEqual(0);
		const first = lines[firstIndex] ?? '';
		const second = lines[firstIndex + 1] ?? '';
		expect(
			first.trim().endsWith('compositis'),
			`line 1 breaks after "compositis" (got "${first.trim()}")`,
		).toBe(true);
		expect(
			second.trimStart().startsWith('synephebos'),
			`line 2 starts at "synephebos" (got "${second.trim()}")`,
		).toBe(true);
	});

	async function enterSlideShow(page: Page): Promise<void> {
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
	}

	/** The `animation-name`s currently running on nodes with `data-element-id`. */
	async function animationNamesFor(page: Page, elementId: string): Promise<string[]> {
		return page.evaluate((id) => {
			const names: string[] = [];
			for (const node of document.querySelectorAll<HTMLElement>(`[data-element-id="${id}"]`)) {
				if (node.getBoundingClientRect().width < 40) {
					continue;
				}
				names.push(getComputedStyle(node).animationName);
			}
			return names;
		}, elementId);
	}

	test('the centre DISSOLVES when only one slide groups it, and morphs when both do', async ({
		page,
	}) => {
		// The reporter: "still issues with how the middle part transition works for
		// different clicks around the circle. They are not behaving 1:1."
		//
		// This deck keeps its centre disc top-level as `!!Content` on the overview
		// slide and nests the identical `!!Content` inside a `!!Circle` GROUP on
		// every topic slide. PowerPoint matches a morph level by level and only
		// descends into a group once the group itself has paired, so:
		//
		//   overview -> topic  the centre has no counterpart and DISSOLVES. Frames
		//                      of the real transition (PowerPoint 16, sampled 25ms
		//                      apart) read RGB 39,40,42 at the disc's centre at 0ms,
		//                      174,194,204 (the artwork BEHIND it) from 324ms to
		//                      449ms, and 39,40,42 again by 983ms.
		//   topic -> topic     the two `!!Circle` groups pair, so their contents do
		//                      too and the same pixel holds 39,40,42 throughout.
		//
		// Pairing the shape with the group instead held the centre solid across the
		// first hop, so it popped instead of dissolving.
		await loadDeck(page);
		await gotoSlide(page, SLIDE.morphFirst);
		await enterSlideShow(page);

		// 3 -> 4. PageDown rather than a wedge click: a wedge is a curved pie slice
		// whose bounding-box CENTRE lands on its neighbour, so clicking it
		// navigates somewhere unpredictable.
		await page.keyboard.press('PageDown');

		// The arriving `!!Circle` group dissolves in AS A WHOLE...
		await expect
			.poll(
				async () => (await animationNamesFor(page, 'ppt/slides/slide4.xml-group-0')).join(' '),
				{
					message: 'the ungrouped-on-the-other-side centre dissolves in as one object',
					timeout: 8000,
				},
			)
			.toContain('pptx-morph-fadein');
		// ...so its `!!Content` child must NOT be animating on its own.
		expect(
			(await animationNamesFor(page, 'ppt/slides/slide4.xml-group-0-shape-0')).filter((name) =>
				name.includes('pptx-morph'),
			),
			'the nested !!Content does not pair across the grouping boundary',
		).toStrictEqual([]);

		await page.waitForTimeout(1400);

		// 4 -> 5: both slides group the centre, so now the contents DO pair.
		await page.keyboard.press('PageDown');
		await expect
			.poll(
				async () =>
					(await animationNamesFor(page, 'ppt/slides/slide5.xml-group-0-shape-0')).join(' '),
				{
					message: 'two paired !!Circle groups carry their !!Content through',
					timeout: 8000,
				},
			)
			.toMatch(/pptx-morph-\d/u);
	});

	test('heading rhythm matches PowerPoint down the slide-13 panel (1.2 line height + endParaRPr blank lines)', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.insetPanel);

		// PowerPoint (COM line bounds): "Intervalla" tops the panel at the
		// 18.9px inset, "Luberet" 75.6px below it, "Efficiendi" 199.2px below
		// it. Before the fix the drift reached ~+10px at "Efficiendi"
		// ("gap much bigger" in the reporter's annotation).
		const measure = async (needle: string): Promise<number> => {
			const starts = await paragraphLineStarts(page, needle);
			expect(starts, `found the "${needle}" paragraph`).not.toBeNull();
			return (starts?.lineTops[0] ?? 0) / ((starts?.hostWidth ?? 262) / 301.29);
		};

		const intervalla = await measure('Intervalla');
		const luberet = await measure('Luberet');
		const efficiendi = await measure('Efficiendi');

		// PP: paragraphs 1 -> 5 span 56.4pt = 75.2px; 1 -> 12 span 199.2pt... in
		// px: Luberet top - Intervalla top = (246.86-190.46)pt * 4/3 = 75.2px,
		// Efficiendi - Intervalla = (389.66-190.46)pt * 4/3 = 265.6px.
		expect(Math.abs(luberet - intervalla - 75.2), 'Luberet offset matches PowerPoint').toBeLessThan(
			6,
		);
		expect(
			Math.abs(efficiendi - intervalla - 265.6),
			'Efficiendi offset matches PowerPoint (the pre-fix drift was ~+10px)',
		).toBeLessThan(6);
	});
});
