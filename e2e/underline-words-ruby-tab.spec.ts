/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `a:rPr/@u="words"` through the two paths a plain run does not exercise:
 * a `a:ruby` run's BASE text, and a run split into tab-separated pieces.
 *
 * PowerPoint draws `u="words"` as one continuous line, gaps included, exactly
 * like `sng` (COM-verified in the 2026-09 limitations wave; see
 * `e2e/underline-words.spec.ts`). Both paths must therefore keep the gap
 * underlined too: the ruby base text stays one underlined run, and every
 * tab-separated piece repeats the run's underline.
 *
 * Read the same framework-agnostic way as the plain spec: walk the DOM text
 * NODES under the element and read whether each one's PARENT computes
 * `text-decoration-line: underline`, without assuming any span structure.
 * Only pieces that belong to the base/tab text are classified, because the
 * ruby annotation's own reading text sits in the same element.
 *
 * Fixture: `underline-words-ruby-tab.pptx`.
 *
 * Run: bunx playwright test underline-words-ruby-tab
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	RUBY_BASE_TEXT,
	TAB_PIECE_TEXT,
	TAB_SECOND_PIECE_TEXT,
} from './fixtures/generate-underline-words-ruby-tab-fixture';
import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('underline-words-ruby-tab.pptx');

/** One rendered text-node piece and whether it carries the underline decoration. */
interface DecoratedPiece {
	text: string;
	underlined: boolean;
}

/**
 * Walk every text node under the element whose OWN text content includes
 * `marker`, and read whether each one's PARENT computes
 * `text-decoration-line: underline`. Framework-agnostic: makes no assumption
 * about how many spans a binding uses.
 */
async function measureDecoration(page: Page, marker: string): Promise<DecoratedPiece[]> {
	return page.evaluate((text) => {
		const root = [...document.querySelectorAll('[data-element-id]')].find((el) =>
			(el.textContent ?? '').includes(text),
		);
		if (!root) {
			throw new Error(`no rendered element contains ${JSON.stringify(text)}`);
		}
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const pieces: DecoratedPiece[] = [];
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const content = node.textContent ?? '';
			if (content.length === 0) {
				continue;
			}
			const parent = node.parentElement;
			if (!parent) {
				continue;
			}
			const decoration = getComputedStyle(parent).textDecorationLine;
			pieces.push({ text: content, underlined: decoration.includes('underline') });
		}
		return pieces;
	}, marker);
}

/** Pieces of `source` (its words or the whitespace between them) that are not underlined. */
function undecoratedWithin(pieces: DecoratedPiece[], source: string): DecoratedPiece[] {
	// Whitespace-only nodes are template formatting (Svelte) outside any run;
	// the real gap has to ride an underlined piece (see the gap check below).
	return pieces.filter(
		(piece) =>
			piece.text.trim().length > 0 && source.includes(piece.text.trim()) && !piece.underlined,
	);
}

/**
 * Whether the space inside `source` rides an underlined piece: either an
 * underlined piece carrying the space next to a word of `source`, or an
 * underlined whitespace-only piece (a binding that splits words and gaps).
 */
function gapUnderlinedWithin(pieces: DecoratedPiece[], source: string): boolean {
	return pieces.some(
		(piece) =>
			piece.underlined &&
			/\s/u.test(piece.text) &&
			(piece.text.trim().length === 0 || source.includes(piece.text.trim().split(/\s+/u)[0] ?? '')),
	);
}

interface ScenarioResult {
	ruby: DecoratedPiece[];
	tab: DecoratedPiece[];
}

async function readSlide(page: Page, origin: string): Promise<ScenarioResult> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	await page.waitForTimeout(300);
	const ruby = await measureDecoration(page, 'ALFA');
	const tab = await measureDecoration(page, 'GAMA');
	return { ruby, tab };
}

test.describe('u="words" through ruby and tab-stop runs', () => {
	test('every binding underlines the words and the gaps, in both paths', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			const describe = (pieces: DecoratedPiece[]) =>
				pieces.map((p) => JSON.stringify(p.text)).join(', ');

			const rubyBad = undecoratedWithin(value.ruby, RUBY_BASE_TEXT);
			if (rubyBad.length > 0) {
				problems.push(`ruby: piece(s) not underlined: ${describe(rubyBad)}`);
			}
			if (!gapUnderlinedWithin(value.ruby, RUBY_BASE_TEXT)) {
				problems.push('ruby: the gap between the base words is not underlined');
			}
			if (!gapUnderlinedWithin(value.tab, TAB_PIECE_TEXT)) {
				problems.push('tab: the gap inside the tab piece is not underlined');
			}
			const tabBad = undecoratedWithin(value.tab, `${TAB_PIECE_TEXT} ${TAB_SECOND_PIECE_TEXT}`);
			if (tabBad.length > 0) {
				problems.push(`tab: piece(s) not underlined: ${describe(tabBad)}`);
			}

			const fullRubyText = value.ruby.map((p) => p.text).join('');
			if (!RUBY_BASE_TEXT.split('').every((ch) => ch === ' ' || fullRubyText.includes(ch))) {
				problems.push(
					`ruby: rendered text "${fullRubyText}" is missing part of "${RUBY_BASE_TEXT}"`,
				);
			}
			const fullTabText = value.tab.map((p) => p.text).join('');
			const expectedTabChars = `${TAB_PIECE_TEXT}${TAB_SECOND_PIECE_TEXT}`;
			if (!expectedTabChars.split('').every((ch) => ch === ' ' || fullTabText.includes(ch))) {
				problems.push(
					`tab: rendered text "${fullTabText}" is missing part of "${expectedTabChars}"`,
				);
			}

			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
