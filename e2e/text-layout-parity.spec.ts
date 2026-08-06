/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings lay out the same TEXT, run for run?
 *
 * `slide-render-parity.spec.ts` compares one dominant text node per element,
 * which is coarse enough that a whole class of divergence renders green. This
 * spec compares every run. It exists because a text-layout audit found real
 * divergences of exactly this shape; those are FIXED (all five bindings build
 * their text-block style from shared `buildTextBlockStyle`, commit 60b9b0d0),
 * and this spec is what keeps them fixed:
 *
 *  1. Autofit (`<a:normAutofit fontScale="70000"/>`): once React-only, so a
 *     shrunk title painted ~43% larger in the other four. Now applied by the
 *     shared text-block style for every binding; the `AutofitTitle` shape of
 *     `text-layout.pptx` pins it via each run's computed `font-size`.
 *  2. `a:bodyPr/@wrap="none"`: once React-only (`white-space: nowrap`), while
 *     the other four hardcoded `pre-wrap` and wrapped the line. Now shared;
 *     the `NoWrapLine` shape pins it, `whiteSpace` being one of the
 *     exactly-compared run properties and `lineCount` catching the wrap.
 *  3. Unset font size / family. The shared text-block style always declares
 *     both (`DEFAULT_FONT_FAMILY` when nothing is authored), and core resolves
 *     the theme's minor font before any binding sees a run. Still compared as
 *     computed size plus MEASURED advance rather than as a family string, so
 *     any future fallback drift (a bullet marker, an inherited run) fails on
 *     its metric consequence no matter which stack produced it.
 *  4. Line height is compared as `line-height / font-size`, so a font-size
 *     drift is reported once rather than counted twice.
 *  5. Run count. A binding that renders three runs where React renders four
 *     (a dropped blank-paragraph `<br>`, a bullet marker fused into its run)
 *     fails naming both run lists.
 *
 * Run: bunx playwright test text-layout-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks, splitReference } from './support/parity';
import { diffTextRuns } from './support/text-run-diff';
import { measureTextRuns } from './support/text-runs';
import type { ElementRunMetrics } from './support/text-runs';

test.use({ viewport: { width: 1440, height: 900 } });

/** Hand-authored deck: one shape per text-layout property under test. */
const TEXT_LAYOUT = fixture('text-layout.pptx');
/** Broad typography coverage, for the same comparison on authored content. */
const TEXT_FEATURES = fixture('text-features.pptx');
/** Real-world deck: inherited placeholder typography. */
const SAMPLE = fixture('sample-deck.pptx');
/** Real-world deck in a non-Latin script, where font fallback bites hardest. */
const CJK = fixture('Japanese_10_Slides_1_8_MB_bbd4090b55.pptx');
/** Real-world deck with authored blank paragraphs and hanging bullets. */
const BLANK_PARAGRAPHS = fixture('solution-explorer.pptx');

/** Load `deck`, show slide `slideNumber`, and measure every run on it. */
async function runsOfSlide(
	page: Page,
	origin: string,
	deck: string,
	slideNumber: number,
): Promise<ElementRunMetrics[]> {
	await loadDeckAt(page, origin, deck);
	await slideStage(page).waitFor();
	const target = thumbnail(page, slideNumber);
	await target.waitFor();
	await target.click();
	// Angular and Svelte stamp the accessibility attributes in a microtask after
	// the nodes exist, and the demos animate the slide change; measuring before
	// that settles reads half a slide.
	await page.waitForTimeout(600);
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	return measureTextRuns(page);
}

/** Assert every binding's runs against React's, as one report. */
function expectRunParity(results: { framework: { name: string }; value: ElementRunMetrics[] }[]) {
	const { reference, candidates } = splitReference(results);
	expect(
		reference.value.length,
		'the reference binding rendered some text to compare against',
	).toBeGreaterThan(0);
	const report = candidates
		.flatMap((candidate) => {
			const problems = diffTextRuns(reference.value, candidate.value);
			const lines = problems.map((problem) => `  - ${problem}`).join('\n');
			return problems.length === 0
				? []
				: [
						`${candidate.framework.name} differs from the reference in ${problems.length} way(s):\n${lines}`,
					];
		})
		.join('\n\n');
	expect(report).toBe('');
}

test.describe('cross-binding text layout', () => {
	test('autofit, wrap="none", default fonts and run splitting agree run for run', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) =>
			runsOfSlide(page, origin, TEXT_LAYOUT, 1),
		);
		expectRunParity(results);
	});

	test('the text-features deck lays out identically run for run', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) =>
			runsOfSlide(page, origin, TEXT_FEATURES, 1),
		);
		expectRunParity(results);
	});

	test('the sample deck lays out identically run for run', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) =>
			runsOfSlide(page, origin, SAMPLE, 1),
		);
		expectRunParity(results);
	});

	test('a real-world CJK deck splits its paragraphs into the same runs', async ({
		browser,
	}, testInfo) => {
		// Non-Latin text is where a per-run family fallback shows up first: a run
		// with no authored typeface picks up whatever the surrounding declaration
		// resolves to, and the bindings do not declare the same thing.
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) =>
			runsOfSlide(page, origin, CJK, 2),
		);
		expectRunParity(results);
	});

	test('an authored blank paragraph and its bullets survive as the same runs', async ({
		browser,
	}, testInfo) => {
		// The slide-13 panel of the issue #131 deck: headings, authored blank
		// paragraphs and hanging bullets in one text body, i.e. every input that
		// can add or drop a run.
		test.setTimeout(180_000);
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) =>
			runsOfSlide(page, origin, BLANK_PARAGRAPHS, 13),
		);
		expectRunParity(results);
	});
});
