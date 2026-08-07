/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for issue #130, run identically against every framework
 * demo.
 *
 * The reporter's deck (`e2e/fixtures/solution-explorer.pptx`, a media-slimmed
 * copy of the attachment - every XML part is byte-identical, only the image
 * payloads and the 172 MB embedded video were shrunk) exposed six distinct
 * defects at once. Each `test` below pins one of them, asserting on what
 * actually broke rather than on a screenshot:
 *
 *  1. Morph transitions never played. The deck writes `<p159:morph/>` as a
 *     DIRECT child of `p:transition` inside `mc:Choice Requires="p159"`, and
 *     the parser only looked for the `p:extLst` form, so the transition was
 *     dropped entirely - not even the `mc:Fallback` fade survived.
 *  2. A shape inside a `p:grpSp` kept its `a:hlinkClick` in the model but the
 *     whole group subtree rendered `pointer-events: none`, so in-group
 *     navigation buttons were dead.
 *  3. Text with no `a:solidFill` on the run resolved to black instead of the
 *     white supplied by the shape's `<p:style><a:fontRef>`: `p:defaultTextStyle`
 *     was winning over the shape's own style reference.
 *  4. Paragraphs of small runs inside a larger-defaulting body were laid out on
 *     the BODY's line boxes, so line spacing ran visibly loose and overflowed.
 *  5. A `buChar` with no `buSzPct`/`buSzPts` was sized from the body default
 *     instead of the paragraph's first run (a 2.2x oversized bullet).
 *  6. A 1px selection border on every element consumed 2px of its content box,
 *     leaving unstroked shapes 2px small and 1px off-origin - visible as a gap
 *     between two 40px buttons that PowerPoint draws flush.
 *
 * Ground truth for the geometry/colour numbers below is PowerPoint's own render
 * of the same deck (exported via COM), not our previous output.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/solution-explorer.pptx', import.meta.url)),
);

/** 1-based slide numbers used below, named for what they demonstrate. */
const SLIDE = {
	/** First morph slide; also carries the black-on-orange "Explore solution" button. */
	morphFirst: 3,
	/** Grouped, individually-hyperlinked callout boxes. */
	groups: 12,
	/** Bullet list with mixed run sizes and two bullet fonts. */
	bullets: 14,
} as const;

/** The deck is 5 MB with a real video; give the initial parse room on CI. */
const LOAD_TIMEOUT_MS = 60_000;

/**
 * Slide-navigation affordances differ per binding, but every one of them
 * exposes an accessible "Go to slide N" control in the slide rail.
 */
async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(600);
}

async function loadDeck(page: Page): Promise<void> {
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 14"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

test.describe('issue #130 - solution-explorer deck fidelity', () => {
	test('morph transition is recognised and plays per-element (not dropped)', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.morphFirst);

		// Enter the show, then advance into the next morph slide.
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

		// The morph engine attaches a `pptx-morph-*` keyframe animation to the
		// elements that persist across the two slides. Before the parser fix the
		// transition resolved to `cut` and NOTHING was animated at all.
		await expect
			.poll(
				async () =>
					page.evaluate(
						() =>
							[...document.querySelectorAll<HTMLElement>('[data-element-id]')].filter((node) =>
								getComputedStyle(node).animationName.includes('pptx-morph'),
							).length,
					),
				{ message: 'elements carry per-element morph animations', timeout: 8000 },
			)
			.toBeGreaterThan(0);
	});

	test('a hyperlink on a shape INSIDE a group is clickable', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.groups);

		// The two callout boxes on slide 12 are `p:grpSp` children carrying their
		// own `a:hlinkClick` slide-jump. Whichever way a binding exposes it, the
		// element must not be inert: it needs pointer events of its own.
		const clickable = await page.evaluate(() => {
			const nodes = [...document.querySelectorAll<HTMLElement>('[data-element-id]')];
			return nodes.filter((node) => {
				const text = node.textContent ?? '';
				if (!text.includes('Possumus') && !text.includes('Turpe improbe')) {
					return false;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height < 2000) {
					return false;
				}
				// Either the node itself or an ancestor up to the slide root must
				// accept pointer events for the link to be reachable.
				return getComputedStyle(node).pointerEvents !== 'none';
			}).length;
		});

		expect(clickable, 'grouped hyperlink targets accept pointer events').toBeGreaterThan(0);
	});

	test('run text with no solidFill inherits white from the shape style fontRef', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.morphFirst);

		// "Explore solution" sits on an orange (#E74011) button whose runs carry no
		// `a:solidFill`; its colour comes from
		// `<p:style><a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>`,
		// which resolves through the theme to white. It rendered pure black.
		// Matched on the run element itself, not on its `[data-element-id]` host:
		// the host also contains the binding's link chrome (React appends the
		// hyperlink target and a "Ctrl+Click to follow link" hint), so its
		// `textContent` is never just the button label. The area floor skips the
		// same run inside a slide-rail thumbnail.
		const colours = await page.evaluate(() => {
			const out: string[] = [];
			for (const node of document.querySelectorAll<HTMLElement>('[data-element-id] *')) {
				if (node.children.length > 0) {
					continue;
				}
				if ((node.textContent ?? '').trim() !== 'Explore solution') {
					continue;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height < 200) {
					continue;
				}
				out.push(getComputedStyle(node).color);
			}
			return out;
		});

		expect(colours.length, 'found the "Explore solution" button text').toBeGreaterThan(0);
		for (const colour of colours) {
			expect(colour, 'fontRef-derived text is white, not the default black').toBe(
				'rgb(255, 255, 255)',
			);
		}
	});

	test('a paragraph of small runs is not laid out on the body font-size line box', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.bullets);

		// Slide 14's body runs are 8pt (10.67px) inside a text body defaulting to
		// 10.5pt (14px). The paragraph's own line box must follow its runs; while
		// it followed the body default the block ran ~30% tall and overflowed.
		const worst = await page.evaluate(() => {
			let ratio = 0;
			for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
				if (!(node.textContent ?? '').includes('Genus pro gaudere')) {
					continue;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height < 2000) {
					continue;
				}
				for (const paragraph of node.querySelectorAll<HTMLElement>('p, div')) {
					const text = paragraph.textContent ?? '';
					if (!text.includes('Genus pro gaudere')) {
						continue;
					}
					const style = getComputedStyle(paragraph);
					const lineHeight = Number.parseFloat(style.lineHeight);
					const fontSize = Number.parseFloat(style.fontSize);
					if (Number.isFinite(lineHeight) && Number.isFinite(fontSize) && fontSize > 0) {
						ratio = Math.max(ratio, lineHeight / fontSize);
					}
				}
			}
			return ratio;
		});

		expect(worst, 'found the bullet paragraph').toBeGreaterThan(0);
		// PowerPoint's single spacing is ~1.2x; anything at/above 1.5 means the
		// strut is still coming from a larger ancestor font-size.
		expect(worst, 'paragraph line box tracks its own runs').toBeLessThan(1.5);
	});

	test('an unsized bullet glyph matches its first run, not the body default', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.bullets);

		// Slide 14 mixes a Wingdings `buChar` and an Arial one, neither with
		// `buSzPct`/`buSzPts`. PowerPoint draws both at 100% of the paragraph's
		// first run, so they are the same size on screen. The Wingdings ones were
		// rendering at the 18pt body default: 24px against the Arial one's 13px.
		const sizes = await page.evaluate(() => {
			const out: number[] = [];
			for (const node of document.querySelectorAll<HTMLElement>('*')) {
				if (node.children.length > 0) {
					continue;
				}
				const text = (node.textContent ?? '').trim();
				if (text.length > 2 && !/[§•▪■]/u.test(text)) {
					continue;
				}
				if (!/[§•▪■]/u.test(text)) {
					continue;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height < 20) {
					continue;
				}
				out.push(Number.parseFloat(getComputedStyle(node).fontSize));
			}
			return out;
		});

		expect(sizes.length, 'found bullet glyphs on the slide').toBeGreaterThan(1);
		const largest = Math.max(...sizes);
		const smallest = Math.min(...sizes);
		// All three bullets derive from 8-10pt runs, so they must be within a
		// stone's throw of each other - never the ~2x spread the bug produced.
		expect(largest / smallest, 'bullet glyphs are consistently sized').toBeLessThan(1.6);
		expect(largest, 'bullet is sized from its run, not the 18pt body default').toBeLessThan(20);
	});

	test('an element occupies exactly its authored box (no selection-border inset)', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.bullets);

		// Slide 14's top-left has two 40x40 icons authored flush: the home glyph
		// at x=0 and the up-arrow at x=40. A 1px border with
		// `box-sizing: border-box` shrank each to 38px and shifted it 1px,
		// opening a 2px gap PowerPoint does not draw.
		//
		// Addressed by their core-assigned element ids rather than by "the
		// leftmost pair of smallish boxes": the slide-rail thumbnails render the
		// same slide, so a geometric guess picks up a thumbnail's copy in the
		// bindings whose thumbnails keep the `data-element-id` marker (React's
		// static renderer does not, which is the only reason a positional
		// heuristic appeared to work there). Among the copies of one id, the
		// largest is the live canvas render.
		const gap = await page.evaluate(() => {
			const largest = (elementId: string): DOMRect | null => {
				let best: DOMRect | null = null;
				for (const node of document.querySelectorAll<HTMLElement>(
					`[data-element-id="${elementId}"]`,
				)) {
					const box = node.getBoundingClientRect();
					if (!best || box.width * box.height > best.width * best.height) {
						best = box;
					}
				}
				return best;
			};
			const home = largest('ppt/slides/slide14.xml-pic-1');
			const arrow = largest('ppt/slides/slide14.xml-pic-2');
			if (!home || !arrow) {
				return null;
			}
			// Same row, and the arrow starts where the home glyph ends.
			if (Math.abs(home.top - arrow.top) > 1) {
				return null;
			}
			return arrow.left - home.right;
		});

		expect(gap, 'found the two icon buttons').not.toBeNull();
		// Authored flush: allow only sub-pixel rounding, never a whole border.
		expect(Math.abs(gap ?? 99), 'adjacent buttons render flush').toBeLessThan(1);
	});
});
