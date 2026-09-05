/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `a:rPr/@u="words"` underlines only the words of a run, leaving the
 * inter-word space unmarked - distinct from `sng`'s continuous line.
 *
 * `packages/shared/src/render/text-run-spacing.ts`'s `splitStyledRun` (with
 * `text-decoration.ts`'s `splitWordsForUnderline`) splits such a run into
 * per-word and per-gap text pieces so only the words carry the CSS
 * `text-decoration-line: underline`. A binding that renders the run as one
 * span underlines the gap too, which is exactly the class of bug this spec
 * pins: it inspects the DOM text NODES rather than assuming any particular
 * span layout, so it holds regardless of how a binding structures its markup.
 *
 * Fixture: `underline-words.pptx` (`ALPHA BETA`, one run, `u="words"`).
 *
 * Run: bunx playwright test underline-words
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { UNDERLINE_WORDS_TEXT } from './fixtures/generate-underline-words-fixture';
import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('underline-words.pptx');

/** One rendered text-node piece and whether it carries the underline decoration. */
interface DecoratedPiece {
	text: string;
	underlined: boolean;
}

/**
 * Walk every text node under the element containing `marker`, and read whether
 * each one's PARENT computes `text-decoration-line: underline`.
 *
 * Framework-agnostic on purpose: whatever a binding's span structure looks
 * like, the underline is a computed style on whichever element wraps each
 * text node, so this makes no assumption about how many spans exist.
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

/** True when every piece that has non-whitespace content is underlined. */
function everyWordUnderlined(pieces: DecoratedPiece[]): boolean {
	return pieces.every((piece) => piece.text.trim().length === 0 || piece.underlined);
}

/** True when at least one piece is PURE whitespace and NOT underlined. */
function someGapUndecorated(pieces: DecoratedPiece[]): boolean {
	return pieces.some((piece) => piece.text.trim().length === 0 && !piece.underlined);
}

/** The full text reconstructed from the pieces, for a sanity check. */
function fullText(pieces: DecoratedPiece[]): string {
	return pieces.map((piece) => piece.text).join('');
}

async function readSlide(page: Page, origin: string): Promise<DecoratedPiece[]> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	await page.waitForTimeout(400);
	return measureDecoration(page, UNDERLINE_WORDS_TEXT);
}

test.describe('u="words" underline', () => {
	test('every binding underlines the words but not the inter-word gap', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			const rendered = fullText(value);
			if (!UNDERLINE_WORDS_TEXT.split('').every((ch) => ch === ' ' || rendered.includes(ch))) {
				problems.push(`renders "${rendered}", expected the fixture's "${UNDERLINE_WORDS_TEXT}"`);
			}
			if (!everyWordUnderlined(value)) {
				const bad = value.filter((p) => p.text.trim().length > 0 && !p.underlined);
				problems.push(
					`word piece(s) not underlined: ${bad.map((p) => JSON.stringify(p.text)).join(', ')}`,
				);
			}
			if (!someGapUndecorated(value)) {
				problems.push(
					'no whitespace-only piece is left undecorated: the inter-word gap is underlined too ' +
						'(the run was rendered as one continuous span rather than split at word boundaries)',
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
