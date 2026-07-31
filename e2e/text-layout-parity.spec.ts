/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Do the five bindings lay out the same TEXT, run for run?
 *
 * `slide-render-parity.spec.ts` compares one dominant text node per element,
 * which is coarse enough that a whole class of divergence renders green. This
 * spec compares every run, and pins the five defects a text-layout audit
 * confirmed:
 *
 *  1. Autofit is React-only. `computeAutoFitTextStyle()` (shared) is called by
 *     `packages/react/src/viewer/utils/text-utils.tsx` and nowhere else, and
 *     React additionally scales each run by `autoFitFontScale`, so a title
 *     authored `<a:normAutofit fontScale="70000"/>` paints ~43% larger in the
 *     other four than in React (and than in PowerPoint).
 *  2. `a:bodyPr/@wrap="none"` is React-only. React emits `white-space: nowrap`;
 *     Vue, Angular, Vanilla and Svelte hardcode `pre-wrap` in their text-block
 *     style and never read `textStyle.textWrap`, so the line wraps.
 *  3. Unset font size / family fall back differently. React always declares a
 *     size and a family; the others omit the property and inherit. Compared as
 *     computed size plus MEASURED advance, never as a family string: the
 *     fallback stacks legitimately differ, only their metrics have to agree.
 *     A run authored with no `sz` and no `a:latin` no longer diverges (core
 *     resolves the theme's minor font before any binding sees it), but a
 *     BULLET MARKER, which no deck authors a typeface for, still does.
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
