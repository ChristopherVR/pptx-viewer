/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does every binding honour the `a:bodyPr` text-BODY properties, and the
 * geometry's text rectangle?
 *
 * Each property below was implemented in at most one binding, and three of them
 * in none at all. Run-level parity specs cannot see any of it: a two-column body
 * rendered as one column still paints every run at the right size, and a chevron
 * whose label overflows its arrow points still has identical run metrics. So
 * this spec asserts the LAYOUT FACT in every binding, absolutely, rather than
 * comparing bindings to each other.
 *
 *  1. `a:bodyPr/@numCol` + `@spcCol` - React only. The other four went through
 *     `buildTextBlockStyle`, which had no column branch, so a two-column body
 *     rendered as one. Vanilla even shipped a "Column Spacing" inspector control
 *     whose value its own renderer ignored.
 *  2. `a:tabLst` / `@defTabSz` - React only. A tab fell back to the browser's
 *     8-character default in the other four, so agendas and price lists lost
 *     their columns.
 *  3. `a:bodyPr/@anchorCtr` - NOBODY. Text sat at the left inset instead of
 *     centred on the shape, independently of `@algn`.
 *  4. `a:bodyPr/@vertOverflow="clip"` - NOBODY. An over-long body spilled
 *     outside its shape instead of being clipped.
 *  5. `a:bodyPr/@rot` - React only. A rotated body painted upright elsewhere.
 *  6. The preset text rectangle (`a:rect`) - NOBODY. The core evaluator computed
 *     it and no code read it, so text in a chevron, callout, arrow or wedge was
 *     laid out against the full bounding box. PowerPoint's own measurement (COM)
 *     puts a chevron's text between 0.25 and 0.75 of its width.
 *
 * Run: bunx playwright test text-body-features
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

/** Hand-authored deck: one shape per body property under test. */
const TEXT_BODY = fixture('text-body.pptx');

/** What one measurement of a shape's text body reports. */
interface BodyFacts {
	/** The property values found on the element root or any descendant. */
	columnCount: string;
	columnGap: string;
	tabSize: string;
	alignItems: string;
	overflow: string;
	/** True when some node under the element carries a real 2D rotation. */
	rotated: boolean;
	/** Glyph box of the element's text, as a fraction of the element box. */
	textLeftFraction: number;
	textRightFraction: number;
	/**
	 * True when a node that clips is actually clipping something: its content is
	 * taller than its box.
	 *
	 * The glyph rectangles cannot witness this. `overflow: hidden` is a PAINT
	 * operation, so `Range.getClientRects()` keeps reporting the laid-out line
	 * boxes outside the shape whether or not they are drawn; only the
	 * scroll-versus-client height of the clipping box shows the clip doing work.
	 */
	clipsOverflow: boolean;
}

/**
 * Measure the text body of the element whose text contains `marker`.
 *
 * Deliberately property-driven rather than selector-driven: the five bindings
 * give their text body different class names (and one gives it none), so the
 * element root and all of its descendants are scanned and the first non-initial
 * value of each property is reported. A binding that moved a property onto a
 * different node still passes; one that never emits it cannot.
 */
async function measureBody(page: Page, marker: string): Promise<BodyFacts> {
	return page.evaluate((text) => {
		const root = [...document.querySelectorAll('[data-element-id]')].find((el) =>
			(el.textContent ?? '').includes(text),
		);
		if (!root) {
			throw new Error(`no rendered element contains ${JSON.stringify(text)}`);
		}
		const nodes = [root, ...root.querySelectorAll('*')];
		// `tab-size` INHERITS, and the demos' CSS reset sets it on `<html>`, so
		// every node reports the reset's value whether or not the text body
		// declared one. The page baseline is therefore "not authored here" too,
		// alongside each property's own initial value.
		const pageBaseline = getComputedStyle(document.body);
		const firstOf = (property: string, initial: readonly string[]): string => {
			const inherited = pageBaseline.getPropertyValue(property).trim();
			for (const node of nodes) {
				const value = getComputedStyle(node).getPropertyValue(property).trim();
				if (value && value !== inherited && !initial.includes(value)) {
					return value;
				}
			}
			return '';
		};
		const rotated = nodes.some((node) => {
			const transform = getComputedStyle(node).transform;
			if (!transform || transform === 'none') {
				return false;
			}
			const parts = transform.match(/matrix\(([^)]+)\)/u);
			if (!parts) {
				return false;
			}
			const [a, b] = parts[1].split(',').map((n) => Number(n.trim()));
			// A pure translate/scale has b == 0; any rotation puts a value there.
			return Math.abs(b) > 0.01 && Math.abs(Math.atan2(b, a)) > 0.01;
		});

		const clipsOverflow = nodes.some(
			(node) =>
				getComputedStyle(node).overflow === 'hidden' && node.scrollHeight > node.clientHeight + 1,
		);

		// The painted glyph box, via a Range over the text nodes: an element box
		// says nothing about where the text inside it actually landed.
		const box = root.getBoundingClientRect();
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let left = Number.POSITIVE_INFINITY;
		let right = Number.NEGATIVE_INFINITY;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!(node.textContent ?? '').trim()) {
				continue;
			}
			const range = document.createRange();
			range.selectNodeContents(node);
			for (const rect of range.getClientRects()) {
				if (rect.width === 0 && rect.height === 0) {
					continue;
				}
				left = Math.min(left, rect.left);
				right = Math.max(right, rect.right);
			}
		}
		const measured = Number.isFinite(left) && box.width > 0;
		return {
			columnCount: firstOf('column-count', ['auto']),
			columnGap: firstOf('column-gap', ['normal']),
			tabSize: firstOf('tab-size', ['8']),
			alignItems: firstOf('align-items', ['normal', 'stretch']),
			overflow: firstOf('overflow', ['visible']),
			rotated,
			clipsOverflow,
			textLeftFraction: measured ? (left - box.left) / box.width : -1,
			textRightFraction: measured ? (right - box.left) / box.width : -1,
		};
	}, marker);
}

/** Load the fixture and read every shape's body facts in one page visit. */
async function readSlide(page: Page, origin: string): Promise<Record<string, BodyFacts>> {
	await loadDeckAt(page, origin, TEXT_BODY);
	await slideStage(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	// The bindings stamp their accessibility attributes and settle their slide
	// transition asynchronously; measuring before that reads half a slide.
	await page.waitForTimeout(600);
	return {
		columns: await measureBody(page, 'Column body text'),
		tabs: await measureBody(page, 'Item'),
		anchorCtr: await measureBody(page, 'Centred box'),
		clip: await measureBody(page, 'vertOverflow clip'),
		rotated: await measureBody(page, 'Rotated body'),
		chevron: await measureBody(page, 'Chevron label wrapping'),
	};
}

/**
 * Assert `check` for every binding, reporting all failures at once.
 *
 * A per-binding `expect` inside the loop stops at the first failure and hides
 * how many of the five are actually broken, which is the fact that matters when
 * a feature reached only one of them.
 */
function expectEveryBinding(
	results: { framework: { name: string }; value: Record<string, BodyFacts> }[],
	what: string,
	check: (facts: Record<string, BodyFacts>) => string | undefined,
): void {
	const failures = results.flatMap((result) => {
		const problem = check(result.value);
		return problem ? [`${result.framework.name}: ${problem}`] : [];
	});
	expect(failures.join('\n'), `${what} must hold in every binding`).toBe('');
}

test.describe('text-body properties', () => {
	test('every binding honours numCol, tabs, anchorCtr, vertOverflow, rot and the text rect', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		// 1. `numCol="2" spcCol="228600"` (0.25in = 24px at 9525 EMU/px).
		expectEveryBinding(results, 'a two-column body renders in two columns', (facts) =>
			facts.columns.columnCount === '2'
				? undefined
				: `column-count is "${facts.columns.columnCount}", expected "2"`,
		);
		expectEveryBinding(results, 'the authored column spacing is applied', (facts) =>
			facts.columns.columnGap === '24px'
				? undefined
				: `column-gap is "${facts.columns.columnGap}", expected "24px"`,
		);

		// 2. A single authored `a:tab` at 1828800 EMU = 192px is used verbatim.
		expectEveryBinding(results, 'a tab advances by the authored stop', (facts) =>
			facts.tabs.tabSize === '192px'
				? undefined
				: `tab-size is "${facts.tabs.tabSize}", expected "192px"`,
		);

		// 3. `anchorCtr="1"` centres the text bounding box on the shape.
		expectEveryBinding(results, 'anchorCtr centres the text bounding box', (facts) =>
			facts.anchorCtr.alignItems === 'center'
				? undefined
				: `align-items is "${facts.anchorCtr.alignItems}", expected "center"`,
		);

		// 4. `vertOverflow="clip"` keeps the overflow inside the shape.
		expectEveryBinding(results, 'a vertOverflow="clip" body clips', (facts) =>
			facts.clip.overflow === 'hidden' && facts.clip.clipsOverflow
				? undefined
				: `overflow is "${facts.clip.overflow}" and the clipping box ${
						facts.clip.clipsOverflow ? 'has' : 'has no'
					} content to clip`,
		);

		// 5. `rot="2700000"` (45 degrees) rotates the body.
		expectEveryBinding(results, 'a:bodyPr/@rot rotates the text body', (facts) =>
			facts.rotated.rotated ? undefined : 'no node under the element carries a rotation',
		);

		// 6. The chevron's `a:rect`. Its notch depth is the SHORT side times the
		// 50000 default adjustment, so on the fixture's 384x96 box the rectangle
		// is 0.125 .. 0.875 of the width; the body insets pull the glyphs a little
		// further in again. Without the rectangle the wrapped paragraph fills the
		// whole box (0.025 .. 0.975) and runs straight over both arrow points, so
		// the 0.10 / 0.90 bounds separate the two cases with room to spare.
		expectEveryBinding(results, 'a chevron insets its label into the text rectangle', (facts) =>
			facts.chevron.textLeftFraction >= 0.1 && facts.chevron.textRightFraction <= 0.9
				? undefined
				: `the label spans ${facts.chevron.textLeftFraction.toFixed(3)}..${facts.chevron.textRightFraction.toFixed(
						3,
					)} of the shape, expected to stay within 0.10..0.90`,
		);
	});
});
