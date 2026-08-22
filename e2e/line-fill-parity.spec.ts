/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings paint `a:ln` and `a:blipFill/a:tile` the same way?
 *
 * Every case in `line-fill-fidelity.pptx` was a live cross-binding divergence
 * caused by React resolving fill / stroke / effects through a private 470-line
 * copy of the pipeline instead of shared's:
 *
 *  - `a:ln/@cmpd` reached React and Angular only, and even there it was painted
 *    with inset `box-shadow` strands that cannot render the gap between them
 *    (a transparent inset ring paints nothing rather than punching a hole), so
 *    a double line came out as one thicker solid line. It is now
 *    `border-style: double`, which is what CSS has for the job.
 *  - `a:reflection/@stPos` reached everything EXCEPT React, which re-derived
 *    the reflection inline and dropped the hold segment.
 *  - `a:blipFill/a:tile` reached React only; the other four painted a tiled
 *    texture as one stretched copy.
 *  - `a:miter/@lim` reached React only.
 *  - `a:rPr > a:noFill` (hollow / outline-only text) reached everything except
 *    React, whose text-run pipeline is a third private copy and had no branch
 *    for it, so a hollow run painted the colour it had inherited.
 *
 * Asserting the COMPUTED style rather than a screenshot is deliberate: these
 * are exact, unit-free values that every binding must agree on to the character,
 * and a pixel diff would fold in font and antialiasing noise that has nothing
 * to do with the outline.
 *
 * A sixth case rides along here rather than getting its own spec: `a:ln/@algn`
 * (pen alignment). PowerPoint's default, when `@algn` is omitted (as it is on
 * every `a:ln` above), is `ctr` (the stroke straddles the shape's path, half
 * outside the declared box). A `border-box` CSS border cannot straddle
 * anything, so every one of `dbl`/`tri`/`sng` used to render `strokeWidth / 2`
 * too small on each edge; they are now routed through the shared SVG stroke
 * overlay (`buildStrokeOutline` in `stroke-outline.ts`), which zeroes the CSS
 * border WIDTH for those shapes (each binding's Tailwind preflight still
 * reports `border-top-style: solid` at that zero width; that reset value is
 * not the fact under test, the overlay's own `<path>` strands are).
 * `algn-in-control` is the one shape that explicitly declares `algn="in"`,
 * PowerPoint's inset alignment, which is exactly what a `border-box` border
 * already draws, so it is the control that keeps the CSS-border path under
 * test.
 *
 * Run: bunx playwright test line-fill-parity
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const DECK = fixture('line-fill-fidelity.pptx');

/** The style facts each shape must exhibit, keyed by its slide order. */
interface ElementFacts {
	borderTopStyle: string;
	borderTopWidth: string;
	strokeMiterlimit: string;
	/** Whether `-webkit-box-reflect` holds full opacity before it fades. */
	reflectionHolds: boolean;
	backgroundRepeat: string;
	backgroundSize: string;
	backgroundPosition: string;
	/** The deepest text run's paint: `color | -webkit-text-fill-color | stroke`. */
	runPaint: string;
	/**
	 * `stroke-width` (px) of each `<path>` in the shared stroke-outline overlay
	 * (`svg[class*="gradient-outline"]`), in DOM order; `[]` when the element
	 * has no overlay, i.e. its outline (if any) is a plain CSS border.
	 */
	strokeOverlayWidths: number[];
	/** Computed `stroke` of the overlay's first `<path>`, or `''` with no overlay. */
	strokeOverlayColor: string;
	/** Computed `stroke-dasharray` of the overlay's first `<path>`, or `''` with no overlay. */
	strokeOverlayDash: string;
}

test.describe('cross-binding a:ln and a:blipFill/a:tile', () => {
	test('every binding paints compound lines, tiles, miter and reflection alike', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, DECK);
			return page.evaluate(() => {
				const nodes = [
					...document.querySelectorAll('[data-pptx-viewport] [data-element-id]'),
				] as HTMLElement[];
				return nodes.map((node) => {
					const own = getComputedStyle(node);
					// A tiled picture paints as a repeating background LAYER, which a
					// binding may render on the element or on a child in place of the
					// `<img>`; either is fine, the tiling values are what must match.
					const layer = node.querySelector('div[style*="background"]');
					const paint = layer ? getComputedStyle(layer) : own;
					const reflect = own.webkitBoxReflect ?? '';
					// The innermost element carrying text is the run span; a hollow
					// run is the one place where the run's paint differs from the
					// block's, so it must be read off the span and not the box.
					const runs = [...node.querySelectorAll('span')].filter(
						(span) => span.children.length === 0 && (span.textContent ?? '').trim().length > 0,
					);
					const run = runs[runs.length - 1];
					const runCs = run ? getComputedStyle(run) : undefined;
					// The shared stroke-outline overlay is an `<svg>` whose class ends in
					// `-gradient-outline` (`pptx-react-gradient-outline`,
					// `pptx-vue-gradient-outline`, `pptx-ng-gradient-outline`,
					// `pptx-svelte-gradient-outline`, `pptx-vanilla-gradient-outline`); it
					// is absent whenever the element's outline is a plain CSS border.
					const overlaySvg = [...node.querySelectorAll('svg')].find((svg) =>
						/gradient-outline/u.test(svg.getAttribute('class') ?? ''),
					);
					const overlayPaths = overlaySvg ? [...overlaySvg.querySelectorAll('path')] : [];
					const firstOverlayPath = overlayPaths[0];
					const overlayPathCs = firstOverlayPath ? getComputedStyle(firstOverlayPath) : undefined;
					return {
						borderTopStyle: own.borderTopStyle,
						borderTopWidth: own.borderTopWidth,
						strokeMiterlimit: own.strokeMiterlimit,
						// The `@stPos` hold is a second stop at the START opacity; without
						// it the gradient runs straight from the start colour to the end.
						reflectionHolds: /rgba\([^)]*\)\s+\d+px,\s*rgba/u.test(reflect),
						backgroundRepeat: paint.backgroundRepeat,
						backgroundSize: paint.backgroundSize,
						backgroundPosition: paint.backgroundPosition,
						runPaint: runCs
							? `${runCs.color} | ${runCs.webkitTextFillColor} | ${runCs.webkitTextStrokeWidth} ${runCs.webkitTextStrokeColor}`
							: '-',
						strokeOverlayWidths: overlayPaths.map((path) =>
							Number.parseFloat(getComputedStyle(path).strokeWidth),
						),
						strokeOverlayColor: overlayPathCs?.stroke ?? '',
						strokeOverlayDash: overlayPathCs?.strokeDasharray ?? '',
					} satisfies ElementFacts;
				});
			});
		});

		expect(results.length).toBeGreaterThan(1);

		// Every binding must see the same ten elements.
		for (const result of results) {
			expect(result.value, `${result.framework.name} element count`).toHaveLength(10);
		}

		const [reference, ...rest] = results;
		for (const other of rest) {
			expect(other.value, `${other.framework.name} vs ${reference.framework.name}`).toStrictEqual(
				reference.value,
			);
		}

		// And the reference values must be the CORRECT ones, so five bindings
		// agreeing on a wrong answer still fails.
		const [
			dbl,
			tri,
			sng,
			reflectionHold,
			reflectionPlain,
			algnInControl,
			tilePlain,
			tileCentred,
			hollowText,
			solidText,
		] = reference.value;

		// None of `dbl`/`tri`/`sng` declare `a:ln/@algn`, so PowerPoint's default
		// (`ctr`, the stroke centred on the path) applies. A `border-box` CSS
		// border cannot straddle the box edge the way a centred stroke does, so
		// the shared stroke-outline overlay paints these instead and the CSS
		// border WIDTH is suppressed to 0 (each binding's Tailwind preflight
		// still leaves `border-top-style` at its reset value of `solid` even at
		// zero width, which paints nothing and is not the fact under test here;
		// the overlay strand assertions below are).
		expect(dbl.borderTopWidth).toBe('0px');
		expect(tri.borderTopWidth).toBe('0px');
		expect(sng.borderTopWidth).toBe('0px');

		// `sng` -> one overlay strand at the FULL authored width (6 pt = 8 px).
		// `dbl` / `tri` split that same width into two / three parallel strands
		// that sum back to it (the compound line divides the weight, it does not
		// add to it), all painted the outline's own colour with no dash.
		expect(sng.strokeOverlayWidths).toStrictEqual([8]);
		expect(dbl.strokeOverlayWidths).toStrictEqual([4, 4]);
		expect(tri.strokeOverlayWidths).toStrictEqual([2.4, 3.2, 2.4]);
		expect(dbl.strokeOverlayWidths.reduce((a, b) => a + b, 0)).toBe(sng.strokeOverlayWidths[0]);
		expect(tri.strokeOverlayWidths.reduce((a, b) => a + b, 0)).toBe(sng.strokeOverlayWidths[0]);
		expect(sng.strokeOverlayColor).toBe('rgb(192, 0, 0)');
		expect(dbl.strokeOverlayColor).toBe(sng.strokeOverlayColor);
		expect(tri.strokeOverlayColor).toBe(sng.strokeOverlayColor);
		expect(sng.strokeOverlayDash).toBe('none');

		// `algn-in-control` explicitly declares `algn="in"`, PowerPoint's inset
		// alignment, which is exactly what a `border-box` CSS border already
		// draws: no stroke overlay at all, and a real solid border at the
		// authored width.
		expect(algnInControl.strokeOverlayWidths).toStrictEqual([]);
		expect(algnInControl.strokeOverlayColor).toBe('');
		expect(algnInControl.borderTopStyle).toBe('solid');
		expect(algnInControl.borderTopWidth).toBe('8px');

		// `a:miter/@lim="800000"` is 800% -> an SVG ratio of 8 (4 is the default).
		expect(sng.strokeMiterlimit).toBe('8');
		expect(dbl.strokeMiterlimit).toBe('4');

		// `a:reflection/@stPos="50000"` holds the reflection at full opacity for
		// half the fade before ramping out; without it the fade starts at once.
		expect(reflectionHold.reflectionHolds).toBe(true);
		expect(reflectionPlain.reflectionHolds).toBe(false);

		// `a:tile` sx/sy = 25% with the grid anchored top-left, then centred.
		expect(tilePlain.backgroundRepeat).toBe('repeat');
		expect(tilePlain.backgroundSize).toBe('25% 25%');
		expect(tilePlain.backgroundPosition).toBe('0% 0%');
		expect(tileCentred.backgroundPosition).toBe('50% 50%');

		// `a:rPr > a:noFill`: the glyph interior is cleared while the 2px `a:ln`
		// outline still draws the letterform. The control run, identical but for
		// the `a:noFill`, keeps the blue its paragraph `lstStyle` supplies - so a
		// binding that simply ignored the flag would fail on the first of these.
		expect(hollowText.runPaint).toBe('rgba(0, 0, 0, 0) | rgba(0, 0, 0, 0) | 2px rgb(192, 0, 0)');
		expect(solidText.runPaint).toBe('rgb(0, 0, 255) | rgb(0, 0, 255) | 2px rgb(192, 0, 0)');
	});
});
