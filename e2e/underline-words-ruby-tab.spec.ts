/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `a:rPr/@u="words"` through the two paths a plain run does not exercise:
 * a `a:ruby` run's BASE text, and a run split into tab-separated pieces.
 *
 * `e2e/underline-words.spec.ts` (wave 2) already pins the ordinary per-word
 * sibling-run split. Both paths here render the SAME word/gap distinction
 * through a DIFFERENT mechanism instead:
 *
 *  - A ruby run stays ONE `BuiltRun` (the annotation reads over the whole
 *    base text), so `paragraph-run-build.ts` hands a binding
 *    `underlineWordPieces`: word/gap pieces nested INSIDE that one run's own
 *    span, with the run's own underline stripped so it cannot bleed through
 *    the gap the way a plain ancestor underline would.
 *  - A tab-containing run gets a measured `TabbedRunPiece[]` layout instead of
 *    the per-word split; `text-tab-run-build.ts` gives each tab-separated
 *    PIECE its own nested word/gap sub-pieces (`TabbedRunPiece.words`).
 *
 * Both are read the same framework-agnostic way as the wave-2 spec: walk the
 * DOM text NODES under the element and read whether each one's PARENT
 * computes `text-decoration-line: underline`, without assuming any span
 * structure. Classification is by EXACT marker text rather than "every
 * non-whitespace piece", because the ruby scenario's own annotation reading
 * text sits in the same element and must not be mistaken for a base word.
 *
 * Fixture: `underline-words-ruby-tab.pptx` (a NEW fixture; the wave-2 one is
 * untouched).
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

/** Every piece whose TRIMMED text exactly equals one of `words`. */
function piecesMatching(pieces: DecoratedPiece[], words: readonly string[]): DecoratedPiece[] {
	return pieces.filter((piece) => words.includes(piece.text.trim()));
}

/** Whether some piece between two word pieces is pure whitespace and NOT underlined. */
function hasUndecoratedGap(pieces: DecoratedPiece[]): boolean {
	return pieces.some((piece) => piece.text.trim().length === 0 && !piece.underlined);
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
	test('every binding underlines the words but not the gaps, in both paths', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];

			// Ruby scenario: base-text words ALFA / BETO underlined, the gap
			// between them not. The annotation's own reading text is deliberately
			// NOT asserted on here (it renders through a different run entirely).
			const rubyWords = piecesMatching(value.ruby, ['ALFA', 'BETO']);
			if (rubyWords.length < 2) {
				problems.push(
					`ruby: expected both "ALFA" and "BETO" as separate pieces, found ${rubyWords.length} ` +
						`(${JSON.stringify(value.ruby)})`,
				);
			} else if (!rubyWords.every((p) => p.underlined)) {
				problems.push(
					`ruby: word piece(s) not underlined: ${rubyWords
						.filter((p) => !p.underlined)
						.map((p) => JSON.stringify(p.text))
						.join(', ')}`,
				);
			}
			if (!hasUndecoratedGap(value.ruby)) {
				problems.push('ruby: no undecorated whitespace piece found between "ALFA" and "BETO"');
			}

			// Tab scenario: GAMA / DELTO (before the tab, with an internal gap) and
			// EPSI (the whole piece after the tab) all underlined; the gap between
			// GAMA and DELTO is not.
			const tabWords = piecesMatching(value.tab, ['GAMA', 'DELTO', 'EPSI']);
			if (tabWords.length < 3) {
				problems.push(
					`tab: expected "GAMA", "DELTO" and "EPSI" as separate pieces, found ${tabWords.length} ` +
						`(${JSON.stringify(value.tab)})`,
				);
			} else if (!tabWords.every((p) => p.underlined)) {
				problems.push(
					`tab: word piece(s) not underlined: ${tabWords
						.filter((p) => !p.underlined)
						.map((p) => JSON.stringify(p.text))
						.join(', ')}`,
				);
			}
			if (!hasUndecoratedGap(value.tab)) {
				problems.push('tab: no undecorated whitespace piece found between "GAMA" and "DELTO"');
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
